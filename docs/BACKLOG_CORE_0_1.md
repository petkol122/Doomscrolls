# docs/BACKLOG_CORE_0_1.md — Core Build 0.1 Backlog

## Purpose

This backlog defines the implementation order for Doomscrolls Core Build 0.1.

Core 0.1 is complete when a real user can register, log in, create a character, enter rooms, move, fight, die, respawn, loot items, use inventory/equipment/flask systems and reconnect with persistent state.

---

## Task Order

### Task 001 — Repository Foundation

Create monorepo, docs skeleton, package scripts and CI.

### Task 002 — Shared Types

Add IDs, account/profile/settings, character/stats/death, item/inventory/equipment, room state and protocol types.

### Task 003 — Localization Foundation

Add English source locale and localization key resolver. No language selector yet.

Status: implemented as `packages/localization` with `en` as the only active Core 0.1 locale. Future languages are deferred until real locale files exist.

### Task 004 — Content Registry

Add content package, content definitions and validation.

Status: implemented as `packages/content` with modular Core 0.1 data files, typed registry lookups and cross-reference/localization validation. Loot rolling, combat logic, server rooms, auth endpoints and database persistence remain intentionally deferred to later tasks.

Initial content:

```text
sewer_dweller
nightvision
gravewalker
heavy_strike
trashboar_runt
nightmarket
blackwire_sewers
starter_pipe
sewer_jacket
starter_blood_flask
blackwire_scrap
```

### Task 005 — Local Infrastructure

Add Docker Compose for PostgreSQL and Redis local development services.

Status: implemented as local-only Docker Compose in `infra/compose/docker-compose.local.yml` with `postgres:16-alpine`, `redis:7-alpine`, healthchecks and `infra/compose/.env.example`. This task intentionally does not add server/client containers, Prisma schema, database models, auth endpoints, gameplay or server rooms.

### Task 006 — Server Foundation

Add Fastify + Colyseus server shell, health endpoint, env validation, structured logger, content validation on startup, Redis startup check and graceful shutdown.

Status: implemented in `apps/server` with no auth endpoints, no Prisma/database schema, no database connection, no gameplay rooms, no fake rooms and no gameplay systems. Redis is required for runtime startup.

### Task 007 — Client Foundation

Add Phaser/Vite client foundation, auth screens, profile/settings screen and character select/create screen.

Status: completed early and accepted as the current Vite + Phaser client shell. It does not implement account UI, character selection, inventory, combat, map, player or enemy simulation.

### Task 008 — Prisma Schema and Migration

Add Prisma schema and first migration for:

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

Status: implemented as the Prisma schema/tooling foundation in `apps/server/prisma/schema.prisma`, with Prisma Client bootstrap in `apps/server/src/persistence/prisma.ts` and server Prisma scripts for generate, development migrations, deploy migrations and Studio. The first real Prisma migration was generated and applied against local PostgreSQL as `20260602144151_init_core_0_1`. Auth endpoints, repositories and gameplay persistence/business logic remain intentionally deferred. Migration files must be generated only when PostgreSQL is reachable; do not fake migrations.

### Task 009 — Repository Layer

Add repository classes around Prisma Client.

### Task 010 — Auth

Implement username/password registration, login, sessions and `/me`.

No guest auth.

### Task 011 — Profile and Settings

Implement public profile and functional settings.

Core settings:

```text
masterVolume
musicVolume
sfxVolume
showFpsCounter
```

### Task 012 — Character Creation

Implement character creation, character name validation, origin/class validation, starting stats/passives, inventory/equipment initialization.

### Task 013 — Room Authentication

Authenticated room joins with character ownership validation.

### Task 014 — TownRoom

Implement The Nightmarket with player presence.

### Task 015 — CombatRoom

Implement Blackwire Sewers room with player entity state.

### Task 016 — Movement

Implement server-authoritative click-to-move.

### Task 017 — Enemy Spawn and AI

Spawn Trashboar Runt from content and implement AI v1.

### Task 018 — Basic Combat

Implement Heavy Strike, damage/armor/death and tests.

### Task 019 — Corpse and Respawn

Implement player death, corpse creation, safe respawn, corpse retrieval and forced recovery with durability foundation.

### Task 020 — Grid Inventory

Implement 10x6 grid inventory, item placement validation and persistence.

### Task 021 — Equipment and Stat Modifiers

Implement equipment slots, equip/unequip, stat recalculation and persistence.

### Task 022 — Flask

Implement Starter Blood Flask in flask_1 slot with server-validated healing/charges.

### Task 023 — XP and Level

Implement XP gain and level 1-10 data-driven progression.

### Task 024 — Loot and Pickup

Implement server-side loot generation, room loot entity and pickup into free grid space.

### Task 025 — Reconnect

Implement reload/reconnect flow preserving account, character, XP, inventory, equipment and active corpse state.

### Task 026 — Core 0.1 End-to-End Test

Run and document the full manual Core 0.1 scenario.

---

## Anti-Scope-Creep

Do not implement before Core 0.1 is complete:

```text
second origin
second class
bosses
quests
trading
crafting
guilds
friends
PvP
procedural dungeons
mobile app
Google login
email recovery
full Czech map
monetization
admin panel
```
