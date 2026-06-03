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

Status: implemented as `apps/server/src/persistence/repositories` plus safe DTO mappers in `apps/server/src/persistence/mappers`. The layer wraps Prisma Client for users, sessions, profiles, functional settings, characters, inventories, item instances and corpses. It intentionally does not implement auth endpoints, password hashing, `/me`, gameplay rooms, combat, loot rolling, inventory placement, equip/unequip behavior or corpse recovery logic.

### Task 010 — Auth

Implement username/password registration, login, sessions and `/me`.

No guest auth.

Status: Auth domain service layer implemented at `apps/server/src/auth/`. HTTP endpoints implemented at `apps/server/src/http/routes/auth.routes.ts` with Bearer token authentication middleware at `apps/server/src/http/middleware/authenticate.ts` and error mapping at `apps/server/src/http/errors/httpErrorMapper.ts`. Request validation uses zod. `passwordHash` and `tokenHash` are never returned. Cookies, refresh tokens, OAuth, Google login, email login and password reset are not implemented.

### Task 010A — Auth Registration Transaction Safety

Make registration atomic. User, UserProfile, UserSettings and Session must be created inside a single Prisma transaction so no partial account state remains on failure.

Status: Resolved. `AuthService.register()` now creates user/profile/settings/session inside `prisma.$transaction`. Repositories already accepted `Prisma.TransactionClient`. The shared `PrismaDatabaseClient` type was updated to include `Prisma.TransactionClient`. Raw session token is generated before the transaction and returned only on success. HTTP endpoints are implemented. Gameplay remains deferred.

### Task 011B — Client Auth UI Foundation

Add the first real client-side auth flow using the real backend auth API:

```text
AuthScene
register form
login form
POST /auth/register
POST /auth/login
GET /me with Bearer token
localStorage token persistence for Core 0.1
authenticated account shell
logout
```

Status: Implemented as the first real client auth UI foundation. `BootScene -> PreloadScene -> AuthScene`; successful auth starts `AccountShellScene`. The client stores the returned session token in `localStorage` under `doomscrolls.sessionToken`, calls `/me` after register/login and on startup when a token exists, clears invalid tokens, and shows safe errors. The account shell displays real `/me` account/profile data and the real character list only. Fake users, fake characters, gameplay rooms, inventory/equipment UI and gameplay are not implemented.

### Task 015.5 — Client Character UI Docs Only

Document runtime verification of the client character list/create flow. This is a documentation-only task and must not change code, add features, add gameplay, add rooms or add seed data.

Status: documented after local runtime verification. `AccountShellScene` shows real characters from `/me`, can create a character through the real authenticated `POST /characters` endpoint, refreshes real account state after create, and resumes the character list through `/me` after browser refresh or logout/login. Core 0.1 create options are currently limited to `sewer_dweller` / Sewer Dweller origin and `gravewalker` / Gravewalker class. Duplicate character name on the same account shows a safe error from the real `409 Conflict` response. There is still no character select/play behavior, no rooms/gameplay, no seed character data and no fake characters.

Runtime verification summary:

```text
registered test account clientchar_1780480193
created character Karel
POST /characters returned 201
refresh restored character through /me
duplicate Karel returned 409
logout/login preserved character visibility
no fake character data appeared
```

### Task 016.5 — Character Selection Docs Only

Document runtime verification of selected character state/persistence. This is a documentation-only task and must not change code, add a play button, add room joins, add gameplay, add seed data or add fake characters.

Status: documented after local runtime verification. `AccountShellScene` supports selected character state for real account characters. The first real character is selected by default, the user can select another real character, and the selected character ID persists in `localStorage` under `doomscrolls.selectedCharacterId`. Stored selection is restored only when it belongs to the current account's real `/me` characters. Logout clears selected character storage. There is still no play button, no room join and no gameplay.

Runtime verification summary:

```text
account verify0164_1780482330
created PersistOne and PersistTwo
selected PersistTwo
refresh preserved PersistTwo
logout cleared selected character storage
login restored valid selected character
no play button, room join or gameplay added
```

### Task 017.5 — Room Join Validation Docs Only

Document the new `RoomJoinValidationService` and its runtime verification. This is a documentation-only task and must not change code, register any Colyseus room, perform any real client room connection, or add gameplay.

Status: documented after local runtime verification against the real local PostgreSQL. `RoomJoinValidationService` exists at `apps/server/src/realtime/RoomJoinValidationService.ts` and re-exports its types from `apps/server/src/realtime/index.ts`. It verifies the selected character's ownership through `CharacterService.getCharacterForUser` before any future room join, validates the requested `roomKind` (only `town` and `combat` are accepted) and the optional `zoneId` (empty string is rejected), and returns a safe `RoomJoinFailureReason` code on failure. The service does not register any Colyseus room, does not perform any real join, and does not start gameplay. Shared room join contracts live in `packages/shared/src/room/RoomJoinTypes.ts` and are re-exported from `packages/shared/src/index.ts`.

Runtime verification summary:

```text
owned character     -> success
missing character   -> character_not_owned
not-owned character -> character_not_owned
invalid room kind   -> invalid_room_kind
empty zoneId        -> invalid_zone
explicit combat zone-> success
temp users cleaned up
no temp script remains
```

This validation service now backs the empty TownRoom join gate. No client room connection is implemented yet. No movement, combat, loot, inventory, equipment, flask, XP, corpse or reconnect behavior is implemented yet.

### Task 018.5 — TownRoom Docs Only

Document empty `TownRoom` registration and valid join runtime verification. This is a documentation-only task and must not add code, player entities, room state schema, maps, movement, combat, gameplay, client UI connection or fake room behavior.

Status: documented after local runtime verification. `TownRoom` is registered as the Colyseus room name `town`. It validates joins with a real `sessionToken` plus `characterId`, and a valid owned character can join. Invalid join cases were checked earlier through the room join validation flow. The room remains an empty shell: no player entity, no room state schema, no map, no movement, no combat, no gameplay and no client UI connection.

Runtime verification summary:

```text
health returned 200
user townjoin_1780491898776
character TownJoin91898776
valid Colyseus join to "town" succeeded
temp user/script cleaned up
git status clean after test
```

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

Status: Character domain service foundation implemented at `apps/server/src/character/` and exposed through authenticated Fastify HTTP routes in `apps/server/src/http/routes/character.routes.ts`. `GET /characters`, `POST /characters` and `GET /characters/:characterId` require Bearer auth, call `CharacterService`, and return safe owner-scoped character DTOs. The service supports character name validation/normalization, per-account duplicate name checks, content-registry origin/class validation, allowed origin/class enforcement, server-calculated starting stats, origin-defined starting passive/zone and empty Core 0.1 inventory initialization. Character names are unique only within the owning account. Frontend character UI, gameplay rooms, movement, combat, loot, starting items, inventory placement and equipment logic remain deferred.

Runtime verification: passed locally for the implemented Character API routes. Verified outcomes: `GET /characters` returns `200`, `POST /characters` returns `201`, `GET /characters/:characterId` returns `200`, duplicate same-account character name returns `409`, the same character name on a second account returns `201`, invalid origin returns `400`, missing Bearer token returns `401`, and responses do not expose `passwordHash` or `tokenHash`. This task status is documentation-only and does not add frontend character UI, gameplay rooms, seed data or gameplay behavior.

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

### Task 020.1 — Enter World Button Wiring

Wire the existing Enter World button to call the real RealtimeClient.joinTownRoom.

Status: Implemented. `AccountShellScene` now enables the Enter World button only when a character is selected. On click, it calls `RealtimeClient.joinTownRoom(sessionToken, selectedCharacterId)`. On success it shows `"Connected to The Nightmarket."` and a Leave button. On failure it shows `"Could not enter world."` in red. The room reference is stored in client memory only (`this.room`). No map, player entity, movement, combat, room state schema, inventory/equipment UI or fake gameplay was added. Typecheck and build pass on the client.

### Task 020.2 — Enter World Docs Only

Document the Enter World button wiring. This is a documentation-only task and must not change code.

Status: documented after typecheck and build verification. The Enter World button calls the real town room join method, requires a selected character, shows `"Connected to The Nightmarket."` on success with a Leave button, shows `"Could not enter world."` on failure, and stores the room reference in client memory only. All four docs (README, ARCHITECTURE, BACKLOG, CODING_RULES) were updated to reflect the current state. No map, player, movement, combat, room state schema, inventory/equipment UI or fake gameplay was added.

### Task 021.4 — TownRoom State Docs Only

Document current minimal TownRoom state shown after Enter World. This is a documentation-only task and must not change code.

Status: documented after reading source files and running validation checks. `TownRoom` now exposes a minimal Colyseus schema state (`TownRoomState`) containing `roomKind` (always `"town"`), `zoneId` (currently `"nightmarket"`), and `connectedPlayerCount` (tracked on join/leave). The client renders these fields as read-only info lines after successful join via `formatTownRoomState()`. No player entity list, no map, no movement, no combat, no gameplay state exists yet.

`AccountShellScene` was refactored to extract DOM helpers (`accountShellDom.ts`), character list view (`characterListView.ts`), character create form (`characterCreateFormView.ts`), and world entry view (`worldEntryView.ts`) into separate modules under `apps/client/src/game/scenes/accountShell/`. This avoids god-file growth. The code-size rule is documented: scene files must not grow into monoliths; extract view/helper modules as the scene accumulates functionality.

All four docs (README, ARCHITECTURE, BACKLOG, CODING_RULES) were updated. TECH_DEBT was reviewed — no new debt entries needed. Validation checks (`pnpm lint`, `pnpm test`) passed.

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
