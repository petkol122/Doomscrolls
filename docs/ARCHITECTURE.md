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

The Prisma schema foundation exists, and the server validates `DATABASE_URL` so configuration is explicit. The current runtime still does not execute database queries on startup and does not implement auth endpoints, repository classes, room persistence, inventory logic, corpse recovery logic or gameplay business logic.

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

The auth service layer does not implement HTTP endpoints yet. `/auth/register`, `/auth/login` and `/me` routes are deferred to a later task.

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
