# Doomscrolls

**Doomscrolls** is a browser-first and mobile-ready online 2D isometric ARPG.

The game is inspired by Diablo 2 pacing, loot, atmosphere and click-to-move combat, but it is set in a modern dark-fantasy world starting in the Czech Republic.

This repository is not a throwaway prototype. It is a production-minded foundation for a small but real online game.

---

## Current Milestone

```text
Core Build 0.1
```

Core Build 0.1 goal:

```text
register account
login
create profile/settings
create character
enter hub
enter combat zone
move
attack
kill enemy
gain XP
drop loot
pick up loot
persist inventory
corpse death/respawn foundation
disconnect/reconnect
continue with saved state
```

No fake mechanics. No client-only gameplay outcomes. No hardcoded game content inside systems.

---

## Game Summary

- **Genre:** Online 2D isometric ARPG
- **Platforms:** Web first, Android/iOS through Capacitor later
- **Combat:** Diablo 2-like click-to-move and click-to-attack
- **World:** Earth, starting in the Czech Republic
- **Tone:** Modern dark fantasy with dry black humor
- **Main antagonistic force:** Moloch
- **Architecture:** server-authoritative, room-based, data-driven

---

## Core 0.1 Locked Content

- First Origin: **Sewer Dweller**
- First Passive: **Nightvision**
- First Class: **Gravewalker**
- First Hub: **The Nightmarket**
- First Combat Zone: **Blackwire Sewers**
- First Enemy: **Trashboar Runt**

---

## Technology Stack

### Client

```text
Phaser
TypeScript
Vite
```

### Server

```text
Node.js
TypeScript
Colyseus
Fastify
```

### Database

```text
PostgreSQL
Prisma ORM
Prisma Client
Prisma Migrate
```

### Realtime / Cache

```text
Redis
```

### Infrastructure

```text
Docker
Docker Compose
GitHub
GitHub Actions
```

---

## Development Setup

Requirements:

```text
Node.js
pnpm
Docker
Docker Compose
Git
```

Install dependencies:

```bash
pnpm install
```

Run checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Exact commands may evolve as the repository is implemented. If commands change, update this README.

Run the browser client during local development:

```bash
cp apps/client/.env.example apps/client/.env
pnpm dev:client
```

The client must be opened at `http://localhost:5173`. Its local `.env` sets `VITE_API_URL=http://localhost:2567` so browser API calls target the local server.

The client is a Vite + Phaser foundation. It boots:

```text
BootScene -> PreloadScene -> AuthScene
```

`AuthScene` provides the first real browser auth UI foundation. It calls the real backend auth API at `VITE_API_URL`:

```text
POST /auth/register
POST /auth/login
GET  /me
```

After a successful register/login, the client stores the returned session token in `localStorage` under `doomscrolls.sessionToken`, calls `/me` with `Authorization: Bearer <token>`, and starts `AccountShellScene`. On startup, an existing local token is checked with `/me`; invalid or expired tokens are cleared and the client returns to `AuthScene`. Logout clears the local token.

`localStorage` token storage is acceptable for the local/Core 0.1 client foundation. Cookies, refresh tokens and hardened production session storage may be revisited later.

If `VITE_API_URL` is missing, the client shows a clear auth error and does not fake success. `VITE_WS_URL` is safely read for future realtime work but is not used yet.

The authenticated `AccountShellScene` displays only real account data returned by `/me`: display name, username, avatar key and the real character list. It can create a Core 0.1 character through the real authenticated `POST /characters` endpoint, using the currently locked create options only:

```text
origin: sewer_dweller / Sewer Dweller
class:  gravewalker / Gravewalker
```

After successful creation, the client refreshes real account state and resumes the character list from `/me`. Browser refresh also restores the authenticated account shell and character list through `/me` when the stored session token is still valid. Duplicate character names on the same account show a safe error from the real `409 Conflict` response.

`AccountShellScene` supports selected character state for real account characters. The first real character is selected by default, and the user can select another real character from the list. The selected character ID persists in `localStorage` under `doomscrolls.selectedCharacterId`; stored selection is restored only if that ID belongs to the current account's real `/me` characters. Logout clears selected character storage together with the local session token.

The authenticated `AccountShellScene` now has a working **Enter World** button. It is enabled only when a character is selected. On click, it calls `RealtimeClient.joinTownRoom(sessionToken, selectedCharacterId)`. On successful join, the status shows `"Connected to The Nightmarket."` and a Leave button appears. On failure, it shows a safe error `"Could not enter world."`. The room reference is stored in client memory only. There is no map, no player entity, no movement, no combat, no room state schema, no inventory/equipment UI, no seed data and no fake gameplay yet. If the real `characters` array is empty, the shell shows `No characters yet.`

Client character list/create runtime verification passed locally:

```text
registered test account clientchar_1780480193
created character Karel
POST /characters returned 201
refresh restored character through /me
duplicate Karel returned 409
logout/login preserved character visibility
no fake character data appeared
```

Selected character state runtime verification passed locally:

```text
account verify0164_1780482330
created PersistOne and PersistTwo
selected PersistTwo
refresh preserved PersistTwo
logout cleared selected character storage
login restored valid selected character
Enter World button only enabled for selected character
```

Run the Node.js server foundation during local development:

```bash
cp infra/compose/.env.example infra/compose/.env
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env up -d
cp apps/server/.env.example apps/server/.env
pnpm dev:server
curl http://localhost:2567/health
```

Required server environment variables:

```text
NODE_ENV
SERVER_PORT
CLIENT_ORIGIN
REDIS_URL
DATABASE_URL
SESSION_SECRET
```

The server uses Fastify with configured CORS, validates environment variables on startup, validates the `@doomscrolls/content` registry on startup, checks Redis with `PING`, initializes a Colyseus shell, registers `TownRoom` as the Colyseus room name `town`, and exposes `GET /health` with a safe non-secret payload. Redis is required for startup. `DATABASE_URL` is used by Prisma CLI tooling and runtime account/character validation.

The server currently does not implement profile routes, player entities, room state schema, maps, movement, combat, loot, enemy spawning, gameplay, fake users, fake characters or fake inventory.

A server-side `RoomJoinValidationService` now exists at `apps/server/src/realtime/RoomJoinValidationService.ts`. It is a safe validation helper for the future Colyseus room join flow. It verifies that a selected character belongs to the authenticated user through the existing `CharacterService.getCharacterForUser` ownership lookup, and it validates the requested `roomKind` (only `town` and `combat` are accepted) and the optional `zoneId` (empty string is rejected). On success it returns the validated `CharacterDetails` together with the resolved `roomKind` and resolved `zoneId`; on failure it returns a safe `RoomJoinFailureReason` code from `packages/shared/src/room/RoomJoinTypes`. The service does not register any Colyseus room, does not perform any actual join, and does not start gameplay. Its input/result types live in `apps/server/src/realtime/RoomJoinValidationTypes.ts` and are re-exported from `apps/server/src/realtime/index.ts`.

Room join validation runtime verification has passed locally against the real local PostgreSQL:

```text
owned character            -> success
missing character          -> character_not_owned
not-owned character        -> character_not_owned
invalid room kind          -> invalid_room_kind
empty zoneId               -> invalid_zone
explicit combat zone       -> success
temp users cleaned up
no temp script remains
```

`TownRoom` is now registered as `town`. It is intentionally empty and validates joins with a real `sessionToken` plus `characterId` before allowing entry. A valid owned character can join the `town` room; invalid join cases were checked earlier through the room join validation service and returned safe failure reasons. There is no player entity yet, no room state schema yet, no map, movement, combat or gameplay yet, and no client UI connection yet.

TownRoom valid-join runtime verification passed locally:

```text
health returned 200
user townjoin_1780491898776
character TownJoin91898776
valid Colyseus join to "town" succeeded
temp user/script cleaned up
git status clean after test
```

Auth HTTP endpoints are now implemented:

```text
POST /auth/register  - Create a new account (201 Created)
POST /auth/login     - Login with credentials (200 OK)
GET  /me             - Get authenticated account state (200 OK)
```

Auth routes use Bearer token authentication via the `Authorization` header. Cookies, refresh tokens, OAuth, Google login, email login and password reset are not implemented yet. `passwordHash` and `tokenHash` are never returned in API responses. The raw session token is only returned to the client after successful register or login.

The auth domain service layer exists at `apps/server/src/auth/` and provides:

```text
username/password registration and login logic
password hashing with argon2id
session token generation (cryptographically random)
session token hashing (SHA-256 for DB storage)
username validation and normalization
display name validation
safe auth response DTOs (no passwordHash exposure)
atomic registration via Prisma $transaction
```

Registration is atomic: User, UserProfile, UserSettings and Session are created inside a single Prisma `$transaction`. If any step fails, no partial account state remains. The raw session token is returned only on success; it is never stored in the database.

The auth service layer provides HTTP endpoints at `POST /auth/register`, `POST /auth/login` and `GET /me`, registered in `apps/server/src/http/routes/auth.routes.ts` with reusable authentication middleware at `apps/server/src/http/middleware/authenticate.ts`. Request validation uses zod. Error mapping to safe HTTP responses uses `apps/server/src/http/errors/httpErrorMapper.ts`.

The server-side character domain service now exists at `apps/server/src/character/`. It provides character listing, per-user character lookup and character creation business logic. Authenticated HTTP character routes are registered in `apps/server/src/http/routes/character.routes.ts`:

```text
GET  /characters              - List authenticated user's character summaries (200 OK)
POST /characters              - Create a character for the authenticated user (201 Created)
GET  /characters/:characterId - Get authenticated-user-owned character details (200 OK)
```

All character routes require `Authorization: Bearer <session-token>` and use the existing auth middleware. Missing, malformed, invalid or expired tokens return `401 Unauthorized`. Route handlers validate request shape with zod and call `CharacterService`; they do not query Prisma directly.

Character creation is server-owned and uses the `@doomscrolls/content` registry to validate origin/class IDs and allowed origin/class combinations. Character names are trimmed, normalized case-insensitively and unique only within the owning account through `characterNameNormalized`; the same character name is allowed on a different account. Starting primary stats are calculated from origin base stats plus class base stats; derived stats are calculated server-side; starting passives and starting zone come from the origin content definition. A Core 0.1 empty inventory is initialized as one 10x6 page and returned as safe character detail data.

Character creation persists Character, CharacterStats, CharacterPassive and Inventory records atomically via the repository layer. No starting items, frontend character UI, gameplay rooms, movement, combat, loot, inventory placement or equipment logic are implemented yet.

Character API runtime verification has passed locally:

```text
GET  /characters              -> 200 OK
POST /characters              -> 201 Created
GET  /characters/:characterId -> 200 OK
duplicate same-account name   -> 409 Conflict
same name on second account   -> 201 Created
invalid origin                -> 400 Bad Request
missing token                 -> 401 Unauthorized
```

Verified responses do not expose `passwordHash` or `tokenHash`. This verification covers the server HTTP Character API only; there is still no frontend character UI and no gameplay/room implementation.

Generate Prisma Client for the server:

```bash
pnpm --filter @doomscrolls/server prisma:generate
```

Create a development migration after local PostgreSQL is running:

```bash
pnpm --filter @doomscrolls/server prisma:migrate:dev -- --name init_core_0_1
```

Apply committed migrations in staging/production:

```bash
pnpm --filter @doomscrolls/server prisma:migrate:deploy
```

The Core 0.1 Prisma schema now lives at `apps/server/prisma/schema.prisma` and defines the database foundation for users, sessions, profiles, functional settings, characters, stats, passives, inventory, item instances and corpses. `apps/server/src/persistence/prisma.ts` provides a minimal Prisma Client bootstrap, and `apps/server/src/persistence/repositories` contains the first typed Prisma repository layer for future auth/profile/settings/character/inventory/item/corpse services.

Repository methods wrap Prisma Client access only. They do not implement auth endpoints, `/auth/register`, `/auth/login`, `/me`, password hashing, gameplay rooms, combat, loot rolling, inventory placement, equipment rules or corpse recovery logic. Public DTO mappers live in `apps/server/src/persistence/mappers`; they must not expose sensitive fields such as `passwordHash` and must not invent gameplay data.

Run local PostgreSQL and Redis infrastructure:

```bash
cp infra/compose/.env.example infra/compose/.env
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env up -d
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env ps
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env down
```

See `docs/LOCAL_INFRASTRUCTURE.md` for service details, logs commands and local-only scope boundaries. The local Compose stack provides PostgreSQL and Redis only; it does not add auth, server rooms, gameplay systems or production deployment.

---

## Repository Structure

```text
doomscrolls/
  apps/
    client/
    server/
  packages/
    shared/
    content/
    localization/
  infra/
    compose/
    docker/
    migrations/
    scripts/
  docs/
  prompts/
  .github/
```

---

## Required Reading Before Coding

Read these before implementing tasks:

```text
AGENTS.md
docs/ARCHITECTURE.md
docs/GAME_DESIGN.md
docs/BACKLOG_CORE_0_1.md
docs/CODING_RULES.md
docs/LOCAL_INFRASTRUCTURE.md
```

---

## Current Priority

Do not start with combat or graphics.

Start with foundation:

```text
repo
workspace
CI
shared types
localization
content registry
local infrastructure
server foundation
Prisma schema
auth
profile
settings
character creation
```

Only then implement rooms, movement, combat, loot, inventory and corpse/death.

---

## Localization

English is the default/source language for Doomscrolls.

Core Build 0.1 is localization-ready but English-only:

- active locale: `en`
- localization package: `packages/localization`
- user-facing text should use localization keys instead of hardcoded strings
- no language selector exists yet
- future languages must not be exposed until real locale files and validation exist

---

## Content Registry

Core Build 0.1 content definitions live in `packages/content` and are data-driven.

The package currently defines the locked foundation content for:

- Sewer Dweller origin and Nightvision passive
- Gravewalker class and Heavy Strike skill definition
- The Nightmarket and Blackwire Sewers zones
- Trashboar Runt enemy definition
- starter pipe, sewer jacket, starter blood flask and blackwire scrap items
- Core 0.1 equipment slots, starter sewer loot table and level 1-10 XP table

Gameplay systems must read these definitions through the content registry instead of hardcoding content values in systems.

`packages/content` exposes:

```ts
contentRegistry.origins.get("sewer_dweller");
contentRegistry.classes.get("gravewalker");
contentRegistry.items.get("starter_pipe");
validateContentRegistry(contentRegistry);
assertValidContentRegistry(contentRegistry);
```

Content validation checks cross-references, Core 0.1 equipment slots, stat modifier targets, loot table entries, level thresholds and English localization keys.

Loot rolling, combat execution, rooms, auth and database persistence are intentionally not implemented by the content package.
