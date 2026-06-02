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

The client is a Vite + Phaser foundation. It boots `BootScene`, `PreloadScene` and `ShellScene`, then displays only:

```text
Doomscrolls client booted
```

No account UI, character selection, inventory, combat, map, player or enemy simulation exists yet. If `VITE_API_URL` is configured, the client performs a real `/health` request for observability only; it does not pretend login or gameplay works. `VITE_WS_URL` is safely read for future realtime work but is not used yet.

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

The server currently does not implement auth endpoints, profile routes, character routes, gameplay rooms, combat, loot, enemy spawning, fake users, fake characters or fake inventory.

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

The Core 0.1 Prisma schema now lives at `apps/server/prisma/schema.prisma` and defines the database foundation for users, sessions, profiles, functional settings, characters, stats, passives, inventory, item instances and corpses. `apps/server/src/persistence/prisma.ts` provides a minimal Prisma Client bootstrap only. Auth endpoints, repository classes and gameplay/database business logic are intentionally not implemented yet.

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
