# Doomscrolls

**A browser-first, server-authoritative 2D isometric ARPG.**

Doomscrolls takes the pacing, loot, and click-to-move combat of games like Diablo 2 and drops them into a modern dark-fantasy version of Earth, starting in the Czech Republic. It's built as a real online game from the ground up — not a prototype — with every gameplay outcome decided by the server and every piece of content driven by data.

```text
Core Build 0.33
```

---

## What makes this project different

- **Server-authoritative, always.** Movement, combat, loot, and progression are all resolved server-side. The client sends intents and renders synced state — it never fakes an outcome locally.
- **Data-driven content.** Classes, origins, zones, enemies, items, and skills are defined in a dedicated content package (`packages/content`) and validated at startup, not hardcoded into game systems.
- **Real persistence from day one.** Accounts, characters, inventory, and equipment are backed by PostgreSQL via Prisma — no mock data, no client-only state pretending to be permanent.
- **Built to scale as a monorepo.** Client, server, and shared packages are independently typed, linted, and tested, with a shared content/localization layer consumed by both.

---

## Gameplay snapshot

| Area | Status |
|---|---|
| Auth & accounts | Register/login, session tokens, authenticated account shell |
| Characters | Creation, selection, persistence, per-account uniqueness |
| Classes / origins | Gravewalker & Ironclad classes, Sewer Dweller origin, Nightvision passive |
| Zones | Blackwire Sewers, Static Yard, Cinderworks, Saltmere Docks, The Nightmarket (real-world Plzeň-grounded map) |
| Combat | Click-to-move, targeted basic attacks and skills, enemy AI (idle/aggro/chase/attack/leash/respawn), dodge, healing flask |
| Progression | Server-owned XP/leveling, equipment-derived stat recalculation |
| Loot & inventory | Rarity tiers up to epic, world loot pickup, equip/unequip, shared loot containers |
| World | Room-based multiplayer presence, room-local and persisted global chat, building collision, real-world map foundation |

This list reflects shipped, verified functionality — not aspirational scope. See [`CHANGELOG.md`](CHANGELOG.md) for a per-version history, or [`docs/`](docs/) (`CORE_BUILD_0_<N>_RELEASE_NOTES.md` per milestone) for full build-by-build detail.

---

## Tech stack

| Layer | Stack |
|---|---|
| Client | Phaser · TypeScript · Vite |
| Server | Node.js · TypeScript · Colyseus · Fastify |
| Database | PostgreSQL · Prisma ORM / Client / Migrate |
| Realtime / cache | Redis |
| Infrastructure | Docker · Docker Compose · GitHub Actions |

**Visual direction:** the runtime is Phaser 2D, and the current world view is a temporary top-down debug projection. The target presentation is a fixed isometric/2.5D ARPG camera with depth sorting, shadows, and layered sprite art — there is no plan to switch engines or move to a free 3D camera.

---

## Getting started

### Requirements

- Node.js
- pnpm
- Docker & Docker Compose
- Git

### Setup

```bash
pnpm install

copy infra\compose\.env.example infra\compose\.env
copy apps\server\.env.example apps\server\.env
copy apps\client\.env.example apps\client\.env
```

### Run everything

```bash
pnpm dev:all
```

This brings up local Docker infrastructure (if `infra/compose/.env` exists), then runs the server and client together with prefixed logs via `concurrently`. Local-dev only — no production deployment behavior.

| Service | URL |
|---|---|
| Client | http://localhost:5173 |
| Backend health | http://localhost:2567/health |

### Run client and server separately

```bash
# Server (requires local Postgres/Redis via Docker Compose)
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env up -d
pnpm dev:server

# Client (binds to 0.0.0.0 for local-network / Tailscale access)
pnpm --filter @doomscrolls/client dev -- --host 0.0.0.0
```

### Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

---

## Repository structure

```text
doomscrolls/
  apps/
    client/       Phaser + Vite browser client
    server/       Fastify + Colyseus + Prisma backend
  packages/
    shared/       Types and contracts shared by client and server
    content/      Data-driven game content registry (classes, zones, items, enemies, skills)
    localization/ Localization keys and strings
  infra/
    compose/      Docker Compose stacks
    docker/
    migrations/
    scripts/
  docs/           Architecture, design, per-build plans and release notes
```

---

## Documentation

Start here before contributing:

- [`AGENTS.md`](AGENTS.md) — contributor/agent working agreement
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture
- [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) — game design and world vision
- [`docs/CODING_RULES.md`](docs/CODING_RULES.md) — coding standards
- [`docs/LOCAL_INFRASTRUCTURE.md`](docs/LOCAL_INFRASTRUCTURE.md) — local Docker/Postgres/Redis setup
- [`docs/BACKLOG_CORE_0_1.md`](docs/BACKLOG_CORE_0_1.md) — original Core 0.1 backlog
- [`docs/TECH_DEBT.md`](docs/TECH_DEBT.md) — known tech debt, kept current
- [`docs/POST_CORE_0_1_ROADMAP.md`](docs/POST_CORE_0_1_ROADMAP.md) — longer-term roadmap

For what's actively being worked on right now, check `docs/TECH_DEBT.md` and the most recent `docs/CORE_BUILD_0_<N>_PLAN.md` / `_RELEASE_NOTES.md` pair rather than this README.

---

## Localization

English is the default and currently only supported language. User-facing text is expected to use localization keys from `packages/localization` rather than hardcoded strings, so additional languages can be added later without a rewrite.

---

## Content registry

Game content is defined as pure data in `packages/content` and validated at startup — cross-references, equipment slots, stat modifiers, loot tables, level thresholds, and localization keys are all checked before the server accepts them.

```ts
contentRegistry.origins.get("sewer_dweller");
contentRegistry.classes.get("gravewalker");
contentRegistry.items.get("starter_pipe");
validateContentRegistry(contentRegistry);
```

Gameplay systems read content through this registry instead of embedding game values directly — new classes, zones, enemies, or items should be added as content, not code.
