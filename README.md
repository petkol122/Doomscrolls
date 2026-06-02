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
pnpm --filter @doomscrolls/client dev
```

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

The authenticated account shell displays only real account data returned by `/me`: display name, username, avatar key and whether characters exist. Character creation is not implemented yet. If the real `characters` array is empty, the shell shows `No characters yet.` It does not show fake users, fake characters, inventory, combat, map, player or enemy simulation.

Run the Node.js server foundation during local development:

```bash
cp .env.example .env
pnpm --filter @doomscrolls/server dev
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

The server uses Fastify with configured CORS, validates environment variables on startup, validates the `@doomscrolls/content` registry on startup, checks Redis with `PING`, initializes a Colyseus shell with no rooms registered, and exposes `GET /health` with a safe non-secret payload. Redis is required for startup. `DATABASE_URL` is used by Prisma CLI tooling and validated by the server config, but the server does not open a PostgreSQL connection or run database queries during startup yet.

The server currently does not implement profile routes, character routes, gameplay rooms, combat, loot, enemy spawning, fake users, fake characters or fake inventory.

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

The server-side character domain service now exists at `apps/server/src/character/`. It provides character listing, per-user character lookup and character creation business logic only; HTTP character routes, frontend character UI, gameplay rooms, movement, combat, inventory placement and equipment UI are not implemented yet.

Character creation is server-owned and uses the `@doomscrolls/content` registry to validate origin/class IDs and allowed origin/class combinations. Character names are trimmed, normalized case-insensitively and unique only within the owning account through `characterNameNormalized`. Starting primary stats are calculated from origin base stats plus class base stats; derived stats are calculated server-side; starting passives and starting zone come from the origin content definition. A Core 0.1 empty inventory is initialized as one 10x6 page.

Character creation persists Character, CharacterStats, CharacterPassive and Inventory records atomically via the repository layer. No starting items are added in this task.

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
