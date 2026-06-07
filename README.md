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

Visual direction lock:

```text
target presentation: fixed isometric / 2.5D ARPG camera
runtime engine: Phaser 2D
current world view: temporary top-down debug projection
no free 3D camera
no engine switch
future visual language: depth sorting, shadows, layered objects, pre-rendered / 2D sprite assets
```

---

## Zone Classification

Zones have a classification field: `safe_hub` / `combat` / `test_hybrid`. The Nightmarket is `test_hybrid` for Core 0.1 because it has enemies despite being a town room. Long-term towns/villages should be `safe_hub` with no enemy spawns.

---

## Core 0.1 Locked Content

- First Origin: **Sewer Dweller**
- First Passive: **Nightvision**
- First Class: **Gravewalker**
- First Hub: **The Nightmarket** (test_hybrid zone)
- First Combat Zone: **Blackwire Sewers**
- First Enemy: **Trashboar Runt**
- First Vendor Placeholder: **Suspicious Vendor** (non-hostile town service NPC; trading not available yet, no shop UI/prices/stock/spending/reputation)

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

Create local environment files from the committed examples:

```bash
copy infra\compose\.env.example infra\compose\.env
copy apps\server\.env.example apps\server\.env
copy apps\client\.env.example apps\client\.env
```

One-command local development startup:

```bash
pnpm dev:all
```

`pnpm dev:all` starts local Docker Compose infrastructure first when `infra/compose/.env` exists, then runs the backend and client together with visible prefixed logs using `concurrently`. This is intended for local development only and does not add any production deployment behavior.

Local URLs:

```text
backend health: http://localhost:2567/health
client:         http://localhost:5173
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
pnpm --filter @doomscrolls/client dev -- --host 0.0.0.0
```

The client binds to `0.0.0.0` for local-network/Tailscale access. You can open it at `http://localhost:5173` on the dev machine or at your Tailscale IP from another device. Keep `apps/client/.env` local to the machine you are testing from.

For Tailscale local-dev access, `apps/client/.env.example` uses:

```env
VITE_API_URL=http://100.101.190.70:2567
VITE_WS_URL=ws://100.101.190.70:2567
```

For local-only browser testing on the same machine, you may still point `VITE_API_URL` / `VITE_WS_URL` at `localhost` instead.

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

`AccountShellScene` supports selected character state for real account characters. The first real character is selected by default, and the user can select another real character from the list. The selected character ID persists in `localStorage` under `doomscrolls.selectedCharacterId`; stored selection is restored only if that ID belongs to the current account's real `/me` characters. Logout clears selected character storage together with the local session token. `AccountShellScene` is the authenticated account/character shell only: it owns account info, the real character list, character creation and character selection before any room connection exists.

The authenticated `AccountShellScene` now has a working **Enter World** button. It is enabled only when a character is selected. On click, it calls `RealtimeClient.joinTownRoom(sessionToken, selectedCharacterId)`. On successful join, the client switches into `WorldSessionScene`, which is the connected room shell only. On failure, it shows a safe error `"Could not enter world."`. The room reference is stored in client memory only.

The client now renders the minimal `TownRoom` state after successful join: `roomKind` (`"town"`), `zoneId` (currently `"nightmarket"`), and `connectedPlayerCount`. `WorldSessionScene` presents this as a temporary server-synced debug shell with grouped room info, player presence and movement-debug sections. Additionally, a helper module (`townRoomPresence.ts`) extracts player presence from the Colyseus schema state so the connected-room overlay can show each player's display name, character ID and already-synced debug fields. This is not final gameplay UI.

The current `WorldSessionScene` area view is also a temporary top-down debug projection only. Doomscrolls still targets a fixed Diablo-like isometric / 2.5D presentation, but the runtime remains Phaser 2D. No free 3D camera, no 3D engine switch, and no visual conversion layer are introduced in the current batch. Later visual tasks may add depth sorting, shadows, layered objects and pre-rendered / 2D sprite assets while keeping the game on the 2D runtime.

If the real `characters` array is empty, the shell shows `No characters yet.`

`AccountShellScene` was refactored to extract DOM helpers into `accountShell/accountShellDom.ts`, shared account header rendering into `accountShell/accountShellAccountHeader.ts`, character list view into `accountShell/characterListView.ts`, character create form into `accountShell/characterCreateFormView.ts`, and world entry view into `accountShell/worldEntryView.ts`. This keeps the scene file lean and avoids god-file growth. The rule is: `AccountShellScene` remains the account/character shell, while `WorldSessionScene` remains the connected room shell; shared tiny DOM pieces should be extracted before either scene starts drifting into a god file.

The current basic attack slice now includes a minimal synced enemy death state. When fixed server-owned damage reduces a synced placeholder enemy to 0 HP, the server clamps HP at 0, marks the enemy as defeated, and keeps that enemy in the room state instead of removing it. Further attacks against a defeated enemy are safely rejected. On the client, defeated enemies render in a muted/disabled style and show safe feedback (`Enemy defeated.`) only. There is still no loot, XP, corpse system, respawn, enemy AI, player damage, death animation or persistence in this slice.

The current temporary Notice Board objective is intentionally narrow: objective definitions now live in content, and the Notice Board reads the `cull_trashboars` objective from content when interaction starts a session-temporary `Cull Trashboars 0/3` objective. Completing that objective grants XP once for that session objective only. There is still no quest log, persistence, dialogue system, multiple-objective support or other quest flow yet.

A dedicated client helper (`apps/client/src/net/townRoomPresence.ts`) now extracts player presence data from the Colyseus `TownRoomState` schema at runtime. It returns `connectedPlayerCount` plus an array of `{ sessionId, characterId, displayName, spawnPointId?, position? }` entries. When the server-side `PlayerPresence` entry carries a `spawnPointId` (currently the resolved `nightmarket_spawn` for TownRoom joins), the helper passes it through so `worldEntryView.ts` can show it next to the player's display name. Presence rendering logic is kept out of `AccountShellScene` — the scene only calls `getTownRoomPresence()` via the view module.

The TownRoom presence helper also forwards `movementSpeed` when the synced `PlayerPresence` schema carries it. The current connected-world debug shell may show this speed value together with spawn/position debug text, and it may show the last click target the client sent if available. Synced position display still comes only from Colyseus room state; the click target is debug intent text only and does not fake arrival or local movement. This remains debug state only — not gameplay HUD, not prediction, and not client-owned movement.

### Spawn point foundation (Core 0.1)

The Core 0.1 spawn point foundation is in place but intentionally limited to data flow, not gameplay:

```text
SpawnPointDefinition lives in @doomscrolls/shared (zoneId, id, x, y, optional labelKey)
SpawnPointContentDefinition lives in @doomscrolls/content
Core 0.1 ships exactly one spawn point: nightmarket_spawn (zoneId = "nightmarket")
TownRoom.resolveTownSpawnPoint() resolves the spawnPointId from content on join
PlayerPresence stores spawnPointId only (no x/y, no active position)
client can display spawnPointId in the presence list (PlayerPresenceEntry.spawnPointId?)
x/y are content data only and are not used as an active gameplay position yet
no movement, no map, no combat, no gameplay behavior
```

The x/y fields on `SpawnPointDefinition` are stored in the content registry as static data. On TownRoom join the server copies them into the player's `PlayerPresence` as the initial world position, but the server does not update them after join. They are not an active gameplay position yet and must not be presented as such. Movement, map rendering, scene-based entity placement and gameplay are deferred to later Core 0.1 tasks.


### Player position foundation (Core 0.1)

The Core 0.1 player position foundation is in place but intentionally limited to data flow, not movement:

```text
PlayerPosition type lives in @doomscrolls/shared (reuses Vector2: { x, y })
PlayerPresence Colyseus schema now stores x and y as number fields
TownRoom.buildTownPlayerPresence() copies the resolved spawn point x/y into the presence entry on join
x/y are copied from content once on join and are never updated after join
client getTownRoomPresence() exposes position?: { x, y } per player
client worldEntryView shows x/y next to each player's display name as debug info only
no movement input, no movement simulation, no pathfinding, no combat, no map, no player sprite, no gameplay loop
```

The `x` and `y` fields on `PlayerPresence` are copied from the resolved spawn point at join time. They are not an active gameplay position yet: there is no movement input handler, no server-side movement simulation, no pathfinding, no facing/direction interpolation, and no updates after join. They are visible on the client only as debug `(x=..., y=...)` suffixes next to the player's display name. Movement, map rendering, scene-based entity placement, combat, and gameplay are deferred to later Core 0.1 tasks.

### Client world area bounds from content (Core 0.1)

The client "world area" click-to-move input panel now resolves its zone bounds from the content registry instead of hardcoded values:

```text
resolveWorldAreaBounds(zoneId)  - client helper at apps/client/src/game/scenes/accountShell/resolveWorldAreaBounds.ts
bounds are read from ZoneContentDefinition.bounds in @doomscrolls/content
fallback safety: 800x600 if content entry is missing
bounds are placeholder movement constraints — NOT collision geometry or map size
no map rendering, pathfinding, collision, or speed checks yet
```

The client depends on `@doomscrolls/content` for these bounds. This is safe because the content package contains only pure TypeScript data and types — no Node-only runtime APIs such as Prisma, Fastify, Colyseus, or PostgreSQL.

### Movement intent + movement step foundation (Core 0.1)

The Core 0.1 movement intent and movement-step foundation is in place. The network contract, server-side validation shell, server-owned target storage, server tick stepping and the first WorldSession visual layer are implemented. It is still intentionally limited and is not full gameplay movement yet.

```text
RequestMoveClientMessage          - shared client intent: type "request_move", targetX, targetY, optional clientTime
RequestMoveRejectedReason         - server-owned rejection codes: invalid_shape | non_finite_target | out_of_range
RequestMoveRejectedServerMessage  - server-to-client rejection message
validateMovementIntent()          - server helper that validates intent shape + range (apps/server/src/realtime/rooms/movementIntentValidation.ts)
applyMovementIntent()             - server helper that stores validated targetX/targetY on PlayerPresence (apps/server/src/realtime/rooms/applyMovementIntent.ts)
stepTownRoomMovement()            - server helper that advances x/y toward the stored target every simulation tick (apps/server/src/realtime/rooms/stepTownRoomMovement.ts)
TownRoom.onMessage("request_move", ...) - validates intents, on accept stores the movement target via applyMovementIntent(); Colyseus schema sync broadcasts later x/y changes from the server tick
TownRoom.setSimulationInterval()  - runs every 50 ms and steps authoritative x/y toward the latest stored target
sendMovementIntent()              - client helper that sends request_move through an already-joined Colyseus room (apps/client/src/net/movementIntentClient.ts)
WorldSessionScene                 - connected-room scene that renders the current visual layer
worldSessionAreaView.ts          - extracted rendering/input helper for the world area, kept separate to avoid scene god-file growth
worldSessionOverlayView.ts       - extracted DOM overlay helper for grouped room/presence/movement debug sections
worldSessionPlayerPlaceholderView.ts - extracted player shape view (circle body + triangle marker + ellipse shadow)
worldSessionAreaView draws content-derived zone bounds and a player placeholder from synced TownRoom presence x/y only
the direction marker (triangle) rotates to point toward the last movement target / click direction
click/tap inside the world area sends a real request_move intent through the joined room; a newer click replaces the previous target
client does not fake local movement; the placeholder changes only after synced room-state updates arrive
no collision, no pathfinding, no speed stats, no client interpolation/smoothing, no combat coupling, no persistence yet
no sprites, no map art, no animation system, no inventory UI
```

`TownRoom` is intentionally kept as a thin Colyseus shell. The movement intent validator and position applicator live in dedicated helper modules (`movementIntentValidation.ts`, `applyMovementIntent.ts`) so the room file does not become monolithic. On the client, the rendering/input helper lives in its own module (`worldSessionAreaView.ts`) so `WorldSessionScene` stays orchestration-focused rather than growing into a god file.

When the server accepts a `request_move` intent, it calls `applyMovementIntent()` which stores the validated `targetX` / `targetY` on the player's authoritative `PlayerPresence` movement-target fields. On join, `TownRoom` resolves a runtime `movementSpeed` from the selected character's derived stats and stores that speed in the joined `PlayerPresence`. The room simulation tick then runs every 50 ms and `stepTownRoomMovement()` advances each player's synced `x` / `y` toward the stored target using that player's own synced `movementSpeed`. If a player's stored speed is missing or invalid at runtime, the step helper falls back to a safe server constant (`TOWN_MOVEMENT_SPEED_FALLBACK_UNITS_PER_SECOND`) rather than trusting bad state. If the player clicks again before arrival, the new `request_move` replaces the previously stored target. Colyseus schema synchronization broadcasts the authoritative x/y updates to clients. On the client, `WorldSessionScene` listens for room `onStateChange`, refreshes `worldSessionAreaView`, redraws the content-derived zone bounds and repositions the player placeholder from synced `TownRoom` presence x/y only. The client does not predict, interpolate or invent local movement. This is still not full gameplay movement: there is no collision detection, no pathfinding, no combat coupling, and no persistence.

In the current WorldSession visual layer, click/tap inside the rendered world area uses the existing `sendMovementIntent()` helper to dispatch a real `request_move` intent through the already-joined Colyseus room. The area bounds come from content, and the player placeholder updates only from synced room state after the server accepts the target and the server tick gradually steps the authoritative position toward it. The player body remains server-synced only; the direction marker rotates toward the last click target as a visual-only facing indicator. The connected-room overlay explicitly labels itself as temporary server-synced debug state, groups room info/player presence/movement debug into readable sections, keeps synced x/y and movementSpeed visible, and may show the last click target sent by the client when available. This remains a visual/network layer only: collision, pathfinding, stat-driven speed, interpolation/smoothing, combat, inventory UI and persistence are still deferred to later Core 0.1 tasks.

Movement runtime sanity verification passed locally:

```text
account movecheck044
character Mover044
server-synced movement advanced gradually, not as an instant local teleport
second click retargeting worked before arrival
roomKind display bug fixed by reading roomKind from synced room state
still no map art, collision, pathfinding, combat, persistence, or real gameplay loop
```

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

### Interactable object foundation (Core 0.1)

The Core 0.1 interactable object foundation is in place but intentionally limited to world object rendering and basic interaction messaging:

```text
InteractableObject type lives in @doomscrolls/shared (fields: id, type, label, x, y)
Colyseus schema Interactable class with @type decorators for all fields
TownRoomState holds interactables as MapSchema<Interactable>
RequestInteractClientMessage protocol message: type "request_interact", objectId
InteractResponseServerMessage protocol message: type "interact_response", objectId, message
initializeTownInteractables() server helper initializes zone-specific objects (apps/server/src/realtime/rooms/initializeTownInteractables.ts)
validateInteractIntent() server helper validates objectId existence and distance <= 50 units (apps/server/src/realtime/rooms/interactValidation.ts)
getInteractableResponseMessage() server helper returns safe response text per object
TownRoom.onMessage("request_interact", ...) validates requests and sends InteractResponseServerMessage to requesting client
sendInteractIntent() client helper dispatches request_interact through joined Colyseus room (apps/client/src/net/interactIntentClient.ts)
registerInteractResponseListener() client helper listens for interact_response messages (apps/client/src/net/interactResponseClient.ts)
worldSessionInteractablesView.ts client rendering helper that draws object shapes + labels and handles click detection
WorldSessionScene listens for interact_response and displays message for 3 seconds
Core 0.1 Nightmarket has one visible interactable: notice board at world coords (120, 140)
notice board responds with safe message: "The notice board hums quietly."
no quests, loot, inventory, NPC dialogue, combat, collision detection, persistence or fake rewards
no character level, stat scaling or gameplay-affecting behavior
```

Interactable objects are intentionally limited. They have no active gameplay behavior, no rewards, no persistence, no collision and no rich dialogue. The server validates distance (50-unit radius from player) and returns safe text responses only. The client renders simple placeholder shapes (gold rectangles with labels) as standin visuals, handles click-to-interact input, and displays the server response message in the center of the screen for 3 seconds before clearing. This is a network + rendering layer only: quests, rewards, loot, inventory effects, NPC dialogue, combat coupling, collision geometry, and persistence are deferred to later Core 0.1 tasks.

### Targeted actions, enemy AI, player HP / downed, dodge, healing flask, loot pickup, progression, equipment-derived stats, and HUD (Core 0.1 — checkpoint)

Recent gameplay slices introduced the following server-authoritative, data-driven foundations. They are intentionally narrow and limited; full simulation polish, stat scaling, pathfinding, projectiles, multiple enemy types, equipment UI, drag/drop inventory UI and final HUD art are still out of scope.

```text
Targeted action approach:
  - Far clicks move the player closer first, then attack / interact / pick up
  - The server uses the same click target as a movement target; once the player is in range of the target, the original action intent (attack / interact / pickup) is processed server-side
  - The client does not decide whether the action succeeded; it only sends intents and renders synced room state

Server-authoritative movement:
  - click-to-move remains server-authoritative; the client sends only request_move target intents
  - TownRoom stores the authoritative movement target and advances synced x/y on its simulation tick
  - newer clicks replace older movement targets; the client never teleports or predicts arrival locally

Enemy AI (Trashboar Runt placeholder):
  - content-driven spawn zones define enemy type, count and bounding rectangle per zone
  - Nightmarket currently spawns 3 Trashboar Runt placeholders from one spawn zone
  - deterministic server RNG (seeded mulberry32) chooses initial spawn positions inside the spawn zone
  - idle: enemies wander near their spawn point at reduced speed
  - aggro: enemy targets the closest alive player within aggro range
  - chase: while aggroed, the enemy moves toward its current target player using a server tick
  - attack: in melee range the enemy hits the player on its own attack cooldown, subtracting server-owned damage
  - leash: if the player runs far enough away, the enemy breaks aggro and walks back to its spawn position
  - defeat: when server-owned damage reduces HP to 0, the enemy becomes defeated and stops acting
  - respawn: after a short delay, the enemy picks a new random position inside the same spawn zone and resets to full HP so the loop is repeatable
  - still no collision, no pathfinding, no rarity tiers, no enemy packs, no persistence

Player HP / downed / respawn foundation:
  - Each player has server-owned current HP and max HP stored on PlayerPresence
  - Enemy hits reduce HP server-side; HP updates reach the client only through synced room state
  - When HP reaches 0, the player is marked as downed; movement and combat are disabled while downed
  - The player may then request respawn; the server restores HP, clears the downed state, restores flask state and places the player at a server-resolved safe location (last in-zone persisted position or content spawn point)
  - No XP loss, no item durability loss, no corpse inventory, no recovery flow yet

Progression and equipment-derived stats:
  - defeated enemies can grant real server-owned XP through the Core 0.1 level table
  - level-ups recalculate derived stats server-side and raise max HP through the per-level HP reward
  - equipment stat modifiers are included in that same recalculation and can change derived stats such as max HP, damage and movement speed
  - the current client debug UI shows these derived/runtime values from real synced/account state rather than inventing local values

Dodge and healing flask:
  - dodge is a server-authoritative short displacement with direction validation and a fixed cooldown; it can also cancel an in-flight enemy telegraph if the player leaves range in time
  - the starter healing flask is server-authoritative, uses fixed charges/cooldown, heals only living players, and is restored on join/respawn
  - Q (flask) and Space (dodge) input helpers share focus filtering so gameplay hotkeys do not fire while text-entry style UI focus is active
  - there is still no stamina system, no mana/resource system, no vendor refill flow and no advanced consumable system

Camera / world input projection rules:
  - world rendering uses the live world-container offset derived from synced player position
  - world clicks/hit testing must use the same active projection and live offset as rendering so visible targets and input stay aligned
  - actionable targets resolve before fallback ground movement when hit candidates overlap
  - top-down click-to-move input is allowed only in the current debug projection; projection preview modes must not fake gameplay input

  Loot drops, pickup, inventory persistence, inventory summary/detail, equipment checkpoint:
   - Loot dropped by defeated enemies exists as a synced world-loot entry in room state (id, itemId, label, x, y)
   - The client sends only a worldLootId pickup intent; the server validates ownership, distance and that the loot still exists
    - On success the server removes the synced room-state loot and persists the picked-up item as a real inventory item through the persistence layer
    - Copper currency also drops via world loot: `rollCurrencyLoot()` rolls the enemy's `currencyDrop` range, server spawns a `WorldLoot` with `currencyCopper > 0` and `itemId = ""`, pickup increments `Character.moneyCopper` atomically via `CharacterRepository.incrementMoneyCopper()`, and a `currency_picked_up` message is sent back to the client
    - the current client slice exposes real inventory summary data plus a read-only inventory detail view from persisted account state rather than fake client-only loot
    - equip moves a real item from inventory into the selected equipment slot
    - unequip moves that real equipped item back into the first free inventory slot
    - drag/drop, stat recalculation, item comparison, XP, salvage, full inventory UI polish and vendor/shop/trading systems are still deferred

HUD (temporary debug vs. future default):
  - The current connected-room overlay is a temporary server-synced HUD/resource placeholder and debug shell only
  - The future default HUD will use Diablo-like orbs (health globe + mana / resource globe) in the bottom corners
  - An optional WoW-like framed bars mode may be added later behind a setting; the orbs are still the default
```

These slices are still narrow checkpoint flows. They are not full combat, not full AI, not full loot/inventory/equipment, and not final HUD art. The server still owns every gameplay outcome; the client only sends intents and renders synced state. Equipment/inventory currently means: pickup writes a real inventory item, inventory detail is read-only, equip moves an item from inventory to a slot, and unequip moves it back to the first free inventory slot. Still missing in this milestone: XP, quests, inventory drag/drop, stat recalculation, item comparison, vendor/stash, a full death/corpse recovery system, and the final Diablo-orb HUD.

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

### Shared Loot Container Foundation (Core 0.1)

The Core 0.1 shared loot container foundation is in place but intentionally limited to data flow and room-instance lifecycle, not persistence:

```text
one shared Nightmarket crate exists
crate opens once per room instance
server rolls loot and spawns world loot near crate
opened state syncs to clients
not persisted yet
no stealing/crime/locks/respawn timers yet
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

This command loads `DATABASE_URL` from the root `.env.development` file (ignored by Git). Do not commit `.env.development`.

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
