# docs/ARCHITECTURE.md — Doomscrolls Technical Architecture

## Purpose

This document defines the technical architecture of Doomscrolls.

Doomscrolls is a browser-first and mobile-ready online 2D isometric ARPG with Diablo 2-like pacing, server-authoritative multiplayer, persistent characters, loot, progression, profiles, settings and scalable room-based world architecture.

---

## Architecture Summary

```text
Web / Android / iOS Client
        |
        | HTTPS REST
        | WebSocket
        v
Node.js / Fastify / Colyseus Server
        |
        |------------------|
        v                  v
PostgreSQL + Prisma       Redis
Persistent truth          Presence/cache/realtime support
```

---

## Principles

### Server authority

The client sends intent. The server owns gameplay truth.

### Data-driven gameplay

Origins, classes, passives, skills, enemies, items, loot tables, zones and level tables must be content definitions, not hardcoded system logic.

### Room-based world

Doomscrolls scales by rooms and instances, not one giant global simulation.

Initial room types:

```text
TownRoom
CombatRoom
DungeonRoom later
BossRoom later
```

### No fake features

Placeholder art is allowed. Placeholder mechanics are not.

---

## Database Access Architecture

Doomscrolls uses:

```text
PostgreSQL
Prisma ORM
Prisma Client
Prisma Migrate
```

Prisma schema location:

```text
apps/server/prisma/schema.prisma
```

Migrations location:

```text
apps/server/prisma/migrations/
```

Core 0.1 schema foundation:

```text
User
Session
UserProfile
UserSettings
Character
CharacterStats
CharacterPassive
Inventory
ItemInstance
Corpse
```

The schema stores content references such as origins, classes, passives, zones, equipment slots and item definitions as content IDs. These are not database relations because gameplay content remains data-driven in `packages/content`.

Rules:

- all schema changes require Prisma migration files
- migrations must be committed
- use `pnpm --filter @doomscrolls/server prisma:migrate:dev` during development
- use `pnpm --filter @doomscrolls/server prisma:migrate:deploy` in staging/production
- do not manually edit production schema
- do not use raw SQL unless explicitly justified
- keep Prisma usage behind repositories/services rather than scattering queries through routes
- do not return `passwordHash` to clients in auth/profile work
- public persistence mappers must exclude secrets and must not invent fake gameplay/profile data

Repository layer location:

```text
apps/server/src/persistence/repositories/
apps/server/src/persistence/mappers/
```

The first repository layer wraps Prisma Client for users, sessions, profiles, settings, characters, inventories, item instances and corpses. It is intentionally data-access focused: it does not implement HTTP routes, registration, login, `/me`, password hashing, auth middleware, gameplay rooms, combat, loot rolling, inventory placement, equipment rules or corpse recovery logic. Business validation and endpoint behavior come in later service/route tasks.

Current Prisma scripts:

```text
pnpm --filter @doomscrolls/server prisma:generate
pnpm --filter @doomscrolls/server prisma:migrate:dev
pnpm --filter @doomscrolls/server prisma:migrate:deploy
pnpm --filter @doomscrolls/server prisma:studio
```

`apps/server/src/persistence/prisma.ts` provides a minimal Prisma Client bootstrap, exports the shared Prisma Client instance, and exports the `PrismaDatabaseClient` type (`PrismaClient | Prisma.TransactionClient`). Repositories accept either a full `PrismaClient` or a transaction-scoped `Prisma.TransactionClient`, enabling services to wrap multiple repository calls inside `prisma.$transaction` for atomicity. It avoids logging secrets such as `DATABASE_URL`; graceful disconnect/shutdown integration can be expanded later when runtime database usage is wired into services.

Local development infrastructure for PostgreSQL is defined in:

```text
infra/compose/docker-compose.local.yml
```

The local `postgres` service uses `postgres:16-alpine`, a named Docker volume and a healthcheck. Development migrations should be generated against this local PostgreSQL service with Prisma Migrate; do not use `prisma db push` as the committed workflow.

---

## Redis Architecture

Redis is planned for presence, cache and realtime coordination support.

Local development infrastructure for Redis is defined in:

```text
infra/compose/docker-compose.local.yml
```

The local `redis` service uses `redis:7-alpine` and a `redis-cli ping` healthcheck. Redis has no local volume by default because PostgreSQL remains the persistent source of truth for Core 0.1 account, character, inventory and progression data.

The first server foundation requires `REDIS_URL` and performs a Redis connect + `PING` check during startup. Startup fails if Redis is unavailable because Redis is required local infrastructure for realtime/cache/presence foundations.

---

## Server Foundation

The current server foundation lives in `apps/server` and provides:

```text
Fastify HTTP server
configured CORS from CLIENT_ORIGIN
structured Fastify logger with secret redaction
environment validation with zod
GET /health
content registry validation on startup
Redis connection check on startup
Colyseus server shell attached to the HTTP server
graceful SIGINT/SIGTERM shutdown
```

`GET /health` returns only a safe service payload and does not expose secrets or internal stack traces.

The Colyseus shell intentionally registers no rooms. `TownRoom`, `CombatRoom`, room authentication, movement, combat, enemy spawning, loot and gameplay messages are deferred to later Core 0.1 tasks.

The Prisma schema foundation exists, and the server validates `DATABASE_URL` so configuration is explicit. The current runtime still does not execute database queries on startup and does not implement repository classes, room persistence, inventory logic, corpse recovery logic or gameplay business logic.

Auth HTTP endpoints (`POST /auth/register`, `POST /auth/login`, `GET /me`) are now registered in the Fastify app via `registerAuthRoutes`. Character HTTP endpoints (`GET /characters`, `POST /characters`, `GET /characters/:characterId`) are registered via `registerCharacterRoutes`. Auth and character routes use request validation with zod, a reusable Bearer token authentication middleware and centralized safe error-to-HTTP mapping. No frontend auth or character UI is implemented by the server.

---

## Auth Domain Service

The auth domain service layer lives at:

```text
apps/server/src/auth/
```

Core components:

```text
AuthService.ts        - Registration, login, session validation logic
PasswordService.ts    - Password hashing (argon2id) and verification
SessionTokenService.ts - Session token generation and hashing
UsernameService.ts    - Username validation and normalization
AuthErrors.ts         - Typed auth error codes and safe error messages
AuthTypes.ts          - Input/output types for auth service
index.ts              - Public API exports
```

Auth service rules:

- no guest accounts
- username/password registration and login only
- username is public, unique, visible and used for login
- usernameNormalized is used for uniqueness and login (case-insensitive)
- displayName is public, flexible and non-unique
- avatarKey uses predefined/default value
- session token is returned only after successful register/login
- raw session token is never stored in DB
- tokenHash is stored in DB
- passwordHash is stored in DB
- passwordHash is never returned to clients
- raw session token is cryptographically random (32 bytes)
- session token hashing uses SHA-256 for deterministic lookup

Username validation rules:

```text
min length: 3
max length: 24
allowed characters: a-z, 0-9, underscore, dot
must start with a letter or number
no spaces
no consecutive dots
no leading/trailing dot
case-insensitive unique through usernameNormalized
reserved names blocked case-insensitively
```

Reserved usernames:

```text
admin, administrator, moderator, mod, support, staff, system, root,
api, auth, login, register, me, profile, settings, doomscrolls, moloch
```

Password validation rules:

```text
min length: 8
max length: 128
must not be whitespace-only
```

Display name validation rules:

```text
min length: 1
max length: 32
trim leading/trailing whitespace
allow spaces
reject empty/whitespace-only
reject unsafe control characters
```

Password hashing approach:

```text
algorithm: argon2id
memoryCost: 65536 (64 MB)
timeCost: 3
parallelism: 4
```

Session token approach:

```text
raw token: 32 bytes (256 bits) cryptographically random, hex-encoded
token hash: SHA-256 of raw token, stored in DB
session expiry: 30 days
```

### Transaction safety

Registration (`AuthService.register()`) creates User, UserProfile, UserSettings and Session records inside a single Prisma `$transaction`. If any step fails, no partial account state remains. Validation and password hashing happen outside the transaction to avoid holding a database connection during expensive operations. The username uniqueness pre-check is an optimization; the database unique constraint on `usernameNormalized` is the authoritative guard. Prisma unique constraint violations (P2002) are caught and mapped to a safe `USERNAME_TAKEN` error.

The raw session token is generated before the transaction. Only `tokenHash` is stored inside the transaction. The raw token is returned to the caller only if the transaction succeeds. If the transaction fails, the raw token is never returned.

Login does not currently use a transaction; session creation and `lastSeenAt` update are sequential. This is acceptable for login because there is no risk of partial account state.

The auth service layer provides HTTP endpoints via Fastify routes:

```text
POST /auth/register  - Create a new account (201 Created)
POST /auth/login     - Login with credentials (200 OK)
GET  /me             - Get authenticated account state (200 OK)
```

Auth routes use Bearer token authentication via the `Authorization: Bearer <token>` header. Cookies, refresh tokens, OAuth, Google login, email login and password reset are not implemented yet. `passwordHash` and `tokenHash` are never returned in API responses. The raw session token is only returned to the client after successful register or login.

Auth HTTP route files:

```text
apps/server/src/http/routes/auth.routes.ts       - Route handlers for register, login, me
apps/server/src/http/middleware/authenticate.ts   - Reusable Bearer token authentication
apps/server/src/http/errors/httpErrorMapper.ts    - Auth error to HTTP status/response mapping
```

Request validation uses zod schemas defined in the route handlers. The `/me` endpoint uses the `authenticateRequest` middleware which extracts the Bearer token, calls `AuthService.getAccountStateFromToken`, and returns appropriate error responses for invalid/expired/revoked sessions.

---

## Character Domain Service

The character domain service layer lives at:

```text
apps/server/src/character/
```

Core components:

```text
CharacterService.ts      - Character listing, per-user lookup and creation logic
CharacterNameService.ts  - Character name trimming, validation and normalization
CharacterStatsService.ts - Core 0.1 starting stat calculation
CharacterErrors.ts       - Safe character error codes and messages
CharacterTypes.ts        - Character service input/output/config types
index.ts                 - Public API exports
```

Character service rules:

- authenticated HTTP character routes expose list/create/get behavior through `CharacterService`
- route handlers must not query Prisma directly
- no frontend character UI is implemented yet
- no gameplay rooms, movement, combat, loot, inventory placement or equipment logic is implemented yet
- character names are unique only within the owning account
- duplicate checks use case-insensitive `characterNameNormalized`
- origin/class lookup uses `@doomscrolls/content`
- allowed origin/class combinations are enforced from origin content definitions
- starting passives and starting zone come from origin content definitions
- starting stats are calculated on the server
- Core 0.1 inventory is initialized as 1 page, 10 columns and 6 rows

Character HTTP routes:

```text
GET  /characters              - authenticated list for the current account
POST /characters              - authenticated character creation
GET  /characters/:characterId - authenticated owner-scoped detail lookup
```

All character routes require `Authorization: Bearer <session-token>`. Missing, malformed, invalid or expired tokens return `401 Unauthorized`. Request validation in routes checks only JSON/body/path shape (`characterName`, `originId`, `classId`, `characterId` strings); detailed character-name and content validation remains in `CharacterService`. Character errors are mapped safely: invalid character name/origin/class/origin-class combination to `400`, duplicate account-local character name to `409`, missing/not-owned character to `404`, and internal character errors to `500`. Raw Prisma errors and stack traces must not be exposed.

Runtime verification status: implemented and locally verified. The verified Character API behavior is:

```text
GET  /characters              -> 200 OK
POST /characters              -> 201 Created
GET  /characters/:characterId -> 200 OK
duplicate same-account name   -> 409 Conflict
same name on second account   -> 201 Created
invalid origin                -> 400 Bad Request
missing token                 -> 401 Unauthorized
```

Runtime verification also confirmed that `passwordHash` and `tokenHash` are not exposed in Character API responses. This does not add or imply frontend character UI, gameplay rooms, movement, combat, loot, seed data, inventory placement or equipment logic.

### Character creation transaction safety

`CharacterService.createCharacter()` validates input before persistence, then delegates atomic creation to `CharacterRepository.createCharacterWithInitialState()`. The repository uses Prisma nested writes inside `$transaction` when a full `PrismaClient` is available, creating `Character`, `CharacterStats`, `CharacterPassive` and `Inventory` together. If the nested create fails, no partial character initialization should remain. Prisma unique constraint violations are mapped to the safe `CHARACTER_NAME_TAKEN` error and raw Prisma errors are not leaked. Character details include the persisted empty inventory grid configuration, but no starting items, placement behavior or equipment logic are implemented in this route task.

---

## Core 0.1 Runtime Scope

Core 0.1 must support:

```text
register/login
profile/settings
character creation
room auth
TownRoom
CombatRoom
server-authoritative movement/combat
grid inventory
equipment
loot
XP
corpse death/respawn/recovery
reconnect
```

Deferred systems:

```text
guilds
friends
trading
crafting
PvP
procedural dungeons
Capacitor app
admin panel
```
