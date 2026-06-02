# docs/DEVELOPMENT_PLAN.md — Doomscrolls Development Plan

## Strategy

Build a small real game foundation before expanding.

Do not build fake demos.

Do not overbuild future systems before the Core 0.1 loop works.

---

## Phase 0 — Repository Foundation

- initialize GitHub repository
- initialize pnpm monorepo
- add TypeScript strict mode
- add docs skeleton
- add CI

---

## Phase 1 — Shared Foundation

- shared IDs/types
- account/profile/settings DTOs
- character/stat/death DTOs
- inventory/equipment/item DTOs
- room state and protocol message types

---

## Phase 2 — Content Foundation

- localization package or structure
- content registry
- content validation
- first content definitions

---

## Phase 3 — Infrastructure and Database

- Docker Compose local environment
- PostgreSQL
- Redis
- Prisma schema
- Prisma migrations
- repository layer

---

## Phase 4 — Auth/Profile/Settings

- username/password registration
- login
- sessions
- `/me`
- profile
- functional settings only

---

## Phase 5 — Character System

- character creation
- character name validation
- origin/class validation
- starting stats/passives
- inventory/equipment initialization

---

## Phase 6 — Rooms

- authenticated room join
- TownRoom
- CombatRoom
- room transition

---

## Phase 7 — Movement and Combat

- click-to-move
- enemy spawn
- enemy AI v1
- Heavy Strike
- damage/armor/death

---

## Phase 8 — Inventory, Equipment, Loot

- grid inventory
- equipment
- item stat modifiers
- server-side loot
- pickup
- persistence

---

## Phase 9 — Flask and Death

- starter flask
- corpse creation
- respawn
- corpse retrieval
- forced recovery penalty

---

## Phase 10 — Core 0.1 Completion

End-to-end manual test:

```text
register
login
create character
enter Nightmarket
enter Blackwire Sewers
move
fight Trashboar Runt
die and respawn
recover corpse
kill enemy
gain XP
loot item
equip item
use flask
reconnect
state persists
```
