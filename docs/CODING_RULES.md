# docs/CODING_RULES.md — Doomscrolls Coding Rules

## Development Mode

Doomscrolls may be developed with AI-assisted coding, including Cline, ChatGPT, Claude or other coding agents, but the codebase must remain maintainable, scalable and production-minded.

---

## Task Behavior

Tasks that affect architecture, database schema, auth/session model, network protocol, room lifecycle, combat authority, inventory persistence, deployment, security or shared contracts require a plan first.

Small contained tasks may be coded directly, but the final report must explain what changed and how it was verified.

---

## TypeScript

Use strict TypeScript.

Avoid `any`. Prefer `unknown` and validate it.

Shared types belong in `packages/shared`.

Content definitions belong in `packages/content`.

---

## Visual Projection Rules

Doomscrolls targets a fixed isometric / 2.5D ARPG presentation.

Rules:

- runtime remains Phaser 2D
- do not switch the client to a 3D engine for Core 0.1 projection work
- do not add a free 3D camera, camera orbit, camera rotation or perspective-camera feature
- current top-down world/session rendering is temporary debug visualization only and must be documented as such
- projection-direction prep may add tiny constants/helpers such as `worldProjection = "debug_top_down"` and `futureTargetProjection = "isometric_2_5d"`
- such prep must not perform real visual conversion by itself
- later visual tasks may implement depth sorting, shadows, layered objects and pre-rendered / 2D sprite assets on the existing 2D runtime
- do not present placeholder top-down debug rendering as the final visual identity

---

## Prisma

Doomscrolls uses PostgreSQL + Prisma.

Rules:

- schema changes require Prisma migrations
- migrations must be committed
- use `pnpm --filter @doomscrolls/server prisma:generate` after schema changes
- use `pnpm --filter @doomscrolls/server prisma:migrate:dev` for development migrations
- use `pnpm --filter @doomscrolls/server prisma:migrate:deploy` for staging/production migration deployment
- normal application logic uses Prisma repositories/services
- routes must not scatter raw Prisma queries; add repository/service methods instead
- public Prisma mappers must exclude `passwordHash` and other secrets
- repository methods may support future services, but business-heavy auth/gameplay rules belong in service layers
- do not introduce another ORM
- do not use raw SQL unless explicitly justified
- do not use `prisma db push` as the normal committed workflow
- do not log `DATABASE_URL` or return sensitive fields such as `passwordHash`

---

## Auth Service Rules

The auth domain service layer exists at `apps/server/src/auth/` and provides username/password registration, login, session validation, password hashing, session token generation and validation rules.

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

Password hashing approach:

- algorithm: argon2id
- memoryCost: 65536 (64 MB)
- timeCost: 3
- parallelism: 4

Session token approach:

- raw token: 32 bytes (256 bits) cryptographically random, hex-encoded
- token hash: SHA-256 of raw token, stored in DB
- session expiry: 30 days

The auth service layer provides HTTP endpoints at `POST /auth/register`, `POST /auth/login` and `GET /me`. Auth routes use Bearer token authentication via the `Authorization: Bearer <token>` header. Cookies, refresh tokens, OAuth, Google login, email login and password reset are not implemented yet. Request validation uses zod. Auth error codes are mapped to safe HTTP responses via `apps/server/src/http/errors/httpErrorMapper.ts`. The `/me` endpoint uses reusable authentication middleware at `apps/server/src/http/middleware/authenticate.ts`.

Registration is atomic: `AuthService.register()` creates User, UserProfile, UserSettings and Session inside a single Prisma `$transaction`. No partial account state should remain on failure. Services that create multiple related records in one logical operation must use `$transaction`.

## Character Service Rules

The character domain service layer exists at `apps/server/src/character/` and currently provides server-side character listing, per-user lookup and creation business logic only.

Character service rules:

- character HTTP routes may expose `CharacterService` through authenticated Fastify handlers only
- character HTTP route handlers must not query Prisma directly
- do not implement frontend character UI until an explicit client task
- do not implement rooms, movement, combat, loot, inventory placement or equipment UI in the character service
- validate and normalize character names before persistence
- character names are unique only within the owning account through `characterNameNormalized`
- validate origin and class IDs through `@doomscrolls/content`
- enforce origin/class combinations through origin content definitions
- starting stats must be calculated server-side, never accepted from the client
- starting passives and starting zone must come from content definitions, not hardcoded content IDs
- character creation must create Character, CharacterStats, CharacterPassive and Inventory atomically where practical
- do not add starting items unless a dedicated task implements real item persistence/placement rules

Implemented character HTTP routes:

```text
GET  /characters
POST /characters
GET  /characters/:characterId
```

All require `Authorization: Bearer <session-token>`. Routes validate request shape with zod and leave detailed character-name/content validation to `CharacterService`. Character names are unique only within the owning account, and missing/not-owned characters return `404` without exposing other users' data.

Character API runtime verification has passed for the implemented server routes:

```text
GET  /characters              -> 200 OK
POST /characters              -> 201 Created
GET  /characters/:characterId -> 200 OK
duplicate same-account name   -> 409 Conflict
same name on second account   -> 201 Created
invalid origin                -> 400 Bad Request
missing token                 -> 401 Unauthorized
```

Verified responses must not expose `passwordHash` or `tokenHash`. Character API documentation must continue to state that no frontend character UI, gameplay rooms, movement, combat, loot, seed data, inventory placement or equipment logic exists until those are implemented by explicit dedicated tasks.

Core 0.1 starting stat formulas:

```text
primary stats = origin base stats + class base stats
maxHp = 20 + toughness * 5
damage = 1 + power
armor = 0
moveSpeed = 1 + speed * 0.02
attackCooldownMs = max(500, 1100 - speed * 25)
```

Client auth UI rules:

- client auth forms must call the real backend API; no fake login, fake registration or fake users
- `/me` must use `Authorization: Bearer <token>`
- Core 0.1 client token persistence uses `localStorage` key `doomscrolls.sessionToken`
- logout must remove the local token
- startup may try `/me` when a local token exists
- invalid or expired tokens must be cleared and return the user to auth UI
- account shell must show the real character list from `/me`; empty real character arrays must display `No characters yet.`
- client character creation may call only the real authenticated `POST /characters` endpoint; it must not create local-only/fake characters
- current Core 0.1 client create options are `sewer_dweller` / Sewer Dweller and `gravewalker` / Gravewalker only
- after successful character creation, the client must refresh real account state rather than locally inventing the resulting character list
- browser refresh/session resume must restore character visibility through `/me`
- duplicate same-account character names must show a safe backend error, such as the real `409 Conflict` response
- selected character state may only reference real characters from the current `/me` account state
- if real characters exist and no valid stored selection exists, the first real character is selected by default
- users may select another real character from the current account character list
- selected character ID persistence uses `localStorage` key `doomscrolls.selectedCharacterId`
- stored selected character IDs must be restored only when they belong to the current account's real characters
- logout must remove both `doomscrolls.sessionToken` and `doomscrolls.selectedCharacterId`
- play buttons, room joins, gameplay, rooms, inventory and equipment UI require separate real backend-supported tasks
- the Enter World button must only be enabled when a character is selected
- on click, the Enter World button must call RealtimeClient.joinTownRoom(sessionToken, selectedCharacterId)
- on success, the UI must show "Connected to The Nightmarket." and a Leave button
- on failure, the UI must show the safe error "Could not enter world."
- the room reference must be stored in client memory only, not in localStorage or any persistent storage
- the Leave button must call room.leave() and reset to the pre-join UI state
- client UI documentation must explicitly state when no fake characters, rooms, gameplay or seed data were added
- `AccountShellScene` must stay the authenticated account/character shell; it owns account info, real character list/create/select flows and pre-join world entry only
- `WorldSessionScene` must stay the connected room shell; it owns the active joined-room view and leave-world flow after a real server-approved join
- if either client scene starts growing, extract only obvious tiny shared helpers or view modules under `apps/client/src/game/scenes/accountShell/` before the scene becomes a god file
- WorldSession debug UI must stay clearly labeled as temporary server-synced debug state, not final gameplay UI
- the player placeholder is a simple visual-only shape (circle body + triangle marker + ellipse shadow) rendered from synced server x/y only
- the direction marker (triangle) rotates toward the last movement target / click direction as a facing indicator only
- the player body position must come from server-synced PlayerPresence x/y only; no local prediction, no movement animation, no combat animation
- world rendering must use the live `worldContainer` offset derived from the synced player position rather than a stale or separately-tracked camera value
- enemy, loot and interactable hit testing must use the same world projection and live container offset as rendering so clicks resolve against the visible world state
- input priority must resolve actionable targets before fallback ground-movement clicks when multiple hit candidates overlap
- avoid rebuilding overlay DOM on every state tick; update stable overlay UI incrementally where practical
- player placeholder visual rules apply only when the server syncs PlayerPresence with position data; if position is missing, the placeholder must be hidden
- no final art, sprite animation, or gameplay-coupled facing system is implemented in placeholder tasks
- basic attack placeholder UX may show safe client text such as "Attack sent.", "Attack confirmed." or "Too far away.", but enemy HP must still update only from synced room state and never from local client mutation
- the current basic attack slice must keep fixed server-owned damage of 1 until a dedicated combat task changes the formula and documents the new authority rules
- placeholder enemy death state may mark synced enemies as `defeated` when server-owned HP reaches 0; dedicated respawn-loop tasks may keep that defeated state briefly and then reset the same synced placeholder enemy back to full HP at the same static position through a server-owned timer. Such tasks still must not add loot, XP, corpse behavior, enemy AI, enemy attacks, player damage, death animation or persistence
- defeated enemies may grant only real server-owned XP; any resulting level-up must be resolved server-side from the real level table
- level-up max HP reward and all other derived-stat changes must come from server recalculation only; the client must not invent level-up outcomes locally
- equipped item stat modifiers must feed the same server-side derived-stat recalculation used for progression/runtime joins; client UI may only display the resulting real derived/runtime values
- current debug/account UI may show derived stats, runtime HP/flask state and equipment outcomes only from real synced room state or persisted account state
- combat reward feedback includes: enemy defeat notice, loot/currency drop notices, rare drop feedback, and level-up notice with new level and max HP gain; XP/level remains server-owned; no stat allocation, skill points or talent tree exist yet
- Q (healing flask) and Space (dodge) world hotkeys must share the same focus-filtering helper so they do not fire while text-entry style focus is active
- projection preview modes must not keep click-to-move world input enabled when that would misrepresent the active world projection
- WorldSession overlay mount points for interactive controls must stay stable across state updates
- do not replace interactive panel root elements during overlay/state refreshes; update their contents in place
- the inventory panel must capture and consume its own clicks so world-targeting input does not leak through interactive inventory UI
- world target hit testing must use the same rendered projection and live offset used by the current world view so visible targets and click resolution stay aligned
- enemy placeholder views must not be destroyed solely because they are currently off-screen or visually overlapped; visibility/cleanup must follow real synced entity lifetime instead
- defeated and respawn visuals must follow synced server state only; the client must not locally invent defeat, removal, or respawn transitions
- live HP and valid location must be saved on leave/disconnect through real server-owned persistence
- a room join must restore saved valid HP/location when that persisted state exists and is valid
- `/me` is persisted account state only and must not be treated as live combat/runtime room state
- passive overlay containers must use `pointer-events: none`
- real interactive controls inside those overlays must explicitly use `pointer-events: auto`
- live combat HUD must read room-synced `PlayerPresence`; inventory/equipment panels must read persisted `/me` account state

## Zone Classification Rules

Zones have a `classification` field: `safe_hub` / `combat` / `test_hybrid`.

- `safe_hub`: intended for towns/villages; no enemy spawns long-term
- `combat`: active combat zones with enemy spawns
- `test_hybrid`: temporary Core 0.1 classification — town room that still has enemies (e.g. Nightmarket)
- Long-term towns/villages should be `safe_hub` with no enemy spawns
- Neutral ambient creatures (rats, pigs, chickens) are allowed in any classification

## Vendor Placeholder Panel Rules

The Suspicious Vendor (nightmarket_vendor_01) is a neutral vendor placeholder interactable:

- non-hostile, town service style
- `kind: "vendor"` in world props; `type: "vendor"` in interactable state
- rendered as a purple 24×32 rectangle (visually distinct from gold props and red enemies)
- on interact, opens a compact dismissible DOM overlay panel showing: vendor name, "Trading is not available yet." with current money snapshot from `/me` character
- panel is non-blocking: Close button + click-anywhere dismiss
- panel module: `apps/client/src/game/scenes/worldSession/vendorInteractionPanel.ts`
- no shop UI, prices, vendor stock, buying, selling, spending or reputation
- no vendor inventory, no money spending

## Interactable Object Rules

Interactable objects are simple world elements that respond to click-to-interact with server-validated safe text messages. Forbidden scope is strict:

- no quests, quest tracking, quest completion, or any quest state
- no loot, inventory, item drops, or item acquisition
- no NPC dialogue, conversation state, or multi-step interaction flows
- no combat triggers, enemy spawning, or combat coupling
- no collision geometry, movement blocking, or pathfinding obstacles
- no persistence across room resets
- no character levels, stat scaling, or gameplay-affecting behavior
- no rewards of any kind (XP, items, account progress, cosmetics, achievements)
- the server validates that the object exists and the player is within 50 units distance
- the server returns only safe text messages; no game-state modifications
- the client renders objects as simple placeholder shapes (rectangles or circles) with labels
- the client does not predict, animate, or fake any interaction outcomes
- responses display as temporary messages for 3 seconds then clear
- the session-only Notice Board objective sequence is the current exception to the no-reward rule for simple interactables: objective definitions live in `packages/content`, the Notice Board offers `Cull Trashboars` first and `Break the Brute` second, one active objective at a time, rewards are XP + copper with per-objective duplicate reward guard
- it still must not add objective persistence, a quest log, NPC dialogue, multi-step conversation state, selection UI, map markers, or multiple-objective support

---

## Server Authority

The client sends intent. The server decides outcomes.

Forbidden client authority:

```text
damage
kills
XP
loot
inventory ownership
equipment state
corpse recovery
level-up
quest completion
```

### Server foundation scope

Server foundation work may add Fastify routes for infrastructure observability such as `GET /health`, environment validation, logger configuration, Redis checks and Colyseus infrastructure. It must not add fake auth, fake account state, fake characters, fake inventory, fake rooms or gameplay outcomes to make the client appear functional.

Production CORS must use configured origins rather than arbitrary wildcards. Logs must not include secrets such as session secrets, database URLs or Redis URLs.

## Room Join Validation Rules

The room join validation layer lives at `apps/server/src/realtime/`. It currently exposes only a safe pre-join validator. It does not register any Colyseus room, does not perform any actual join, and does not start gameplay.

Room join validation rules:

- `RoomJoinValidationService` may only be called from server-side code; client code must never decide whether a join is valid
- ownership is checked through `CharacterService.getCharacterForUser(characterId, userId)` so only characters owned by the authenticated user can be joined
- the only `roomKind` values accepted by the validator are `"town"` and `"combat"`; any other value must be rejected with `invalid_room_kind`
- an explicitly empty `zoneId` string must be rejected with `invalid_zone`; a missing `zoneId` is resolved from the persisted character record
- any ownership/lookup failure must be reported as `character_not_owned` to avoid leaking the existence of other users' characters
- the service must never leak Prisma error details or stack traces; unknown failures must be mapped to the safe `room_unavailable` reason
- the service must never accept client-sent damage, kills, XP, loot, inventory changes, equipment changes, level-up or quest completion; those remain out of scope
- shared room join contracts (`SelectedCharacterRoomJoinRequest`, `RoomJoinAuthPayload`, `RoomJoinFailureReason`) must live in `packages/shared/src/room/RoomJoinTypes.ts` and be re-exported from `packages/shared/src/index.ts`
- Colyseus room registration, real client room connection, and any gameplay behavior must not be added to this layer

## TownRoom Rules

`TownRoom` is registered as the Colyseus room name `town`. It exposes a Colyseus schema state (`TownRoomState`) with:

```text
roomKind: "town"
zoneId: varies (currently "nightmarket")
playerPresence: MapSchema<PlayerPresence> keyed by Colyseus sessionId
  each entry: { sessionId, characterId, displayName, spawnPointId }
connectedPlayerCount: derived from playerPresence.size on join/leave
```

No player entity list, no map, no movement, no combat, no gameplay state exists yet.

Town hostility checkpoint:

- towns/hubs should not have hostile mobs long-term
- neutral ambient creatures are allowed in towns/hubs
- hostile Trashboars in Nightmarket are temporary Core 0.1 test content only; the Runt, Skitter and Brute variants are content-only and share the existing AI / render pipeline

TownRoom rules:

- join options must include a real `sessionToken` and `characterId`
- the server must validate the session token and selected character ownership before allowing the join
- a valid owned character may join `town`
- invalid join cases must fail safely and must not leak another user's character data
- invalid join cases were checked earlier through the room join validation flow and must remain covered as join behavior evolves
- client code must not decide room access or claim join success without the server
- the server creates a `PlayerPresence` entry on `onJoin` with `sessionId`, `characterId`, `characterName` (as `displayName`), the resolved `spawnPointId`, initial x/y and runtime `movementSpeed`
- the server removes the `PlayerPresence` entry on `onLeave`
- `connectedPlayerCount` must derive from `playerPresence.size` on join/leave, never be set independently
- `TownRoomState` may include an `enemies` `MapSchema<EnemyPresence>` for synced placeholder enemies spawned from content-driven spawn zones
- `SpawnZoneDefinition` content data defines enemy type, count and bounding rectangle per zone; the content registry exposes `contentRegistry.spawnZones`
- `initializeTownEnemies()` spawns enemies from spawn zone definitions using deterministic server RNG (seeded mulberry32) so the same zone always produces the same initial layout
- `respawnTownEnemies()` picks a new random position inside the same spawn zone via the same seeded RNG when a defeated enemy's respawn timer elapses
- `applyWanderMovement()` makes idle enemies wander near their spawn point at reduced speed with periodic random target pick-up
- Core 0.1 currently ships multiple Nightmarket `Trashboar Runt` placeholder enemies (spawned from `nightmarket_trashboar_zone` with count 3) with synced `id`, `enemyId`, `label`, `x`, `y`, `hp`, `maxHp`, `defeated`, `state`, `spawnX`, `spawnY`; additional Trashboar-family content variants `trashboar_skitter` (lower HP, faster, lower XP) and `trashboar_brute` (tougher, deeper, heavy attack) share the same AI / loot / XP / render pipeline and use placeholder visuals
- Core 0.1 basic attack intent may target only synced `TownRoomState.enemies` entries; the server validates player presence, enemy existence, non-defeated status and simple distance <= 64 before subtracting fixed damage, clamping hp at 0 and marking `defeated` when hp reaches 0
- the client renders roomKind, zoneId and connectedPlayerCount from room state; additionally it may extract player presence via a dedicated helper (`getTownRoomPresence`) to display connected player names
- client enemy extraction must live in a separate helper module (`apps/client/src/net/townRoomEnemies.ts`), not inside `WorldSessionScene` or `AccountShellScene`
- client presence extraction must live in a separate helper module (`apps/client/src/net/townRoomPresence.ts`), not inside `AccountShellScene`
- defeated enemies may render differently on the client and show safe feedback text only; the client must not invent local death, loot, XP or removal from state
- synced placeholder world loot may be created by the server on real enemy defeat using content-driven loot tables; client rendering may show only server-synced placeholder drops (`id`, `itemId`, `label`, `x`, `y`) and must not add pickup success, inventory changes, persistence, currency, XP, or client-side loot rolls without a dedicated follow-up task
- placeholder loot pickup may send only a synced `worldLootId` to the server; `TownRoom` must validate player presence, loot existence and short pickup range server-side before removing the synced room-state entry
- placeholder loot pickup success may return only safe feedback and synced loot removal; it must not write inventory, award equipment, stack items, grant currency, grant XP, persist rewards or fake local pickup success before room-state removal sync arrives
- do not add enemy AI, aggro, enemy attacks, player hp damage, loot, XP, corpse/death handling beyond the synced `defeated` flag, persistence, rewards, collision, pathfinding, or combat animations to this basic attack foundation without a dedicated task
- do not add a player entity list, map, movement, combat, loot, XP, inventory, equipment, corpse behavior, gameplay messages or client UI gameplay connection to `TownRoom` without a dedicated task
- empty room registration must not be presented as gameplay

## Realtime Room File-Size Guard

Realtime room files (e.g. `TownRoom.ts`, future `CombatRoom.ts`) must stay small and orchestration-focused. A room file is the Colyseus room class; it is not a place to accumulate game systems.

Realtime room file-size guard rules:

- `TownRoom` (and every future room file) should stay a thin Colyseus shell: room lifecycle (`onCreate` / `onJoin` / `onLeave`), join validation, presence and the minimal schema state required to represent the room
- Logger wrappers and any other small reusable helpers belong in separate helper modules such as `roomLogger.ts` (`apps/server/src/realtime/rooms/roomLogger.ts`); they must not be inlined into room files
- Room files must not accumulate gameplay, map, movement, pathing, combat, AI, loot, XP, inventory, equipment, corpse behavior, chat, networking serialization, networking deserialization or UI logic
- Room files must not grow into monoliths; extract helpers, validators, message handlers, schema classes, presence builders and other concerns into dedicated modules before a room file becomes large
- A room file is showing "god file" pressure when it owns responsibilities from more than one of: lifecycle, validation, message handling, state schema, presence, gameplay, AI, persistence, UI. Split before merge in that case
- New helpers extracted from a room file must be placed under `apps/server/src/realtime/rooms/` (or a clearly-named subdirectory such as `helpers/`) and should be reusable across rooms where it makes sense
- Room files must not duplicate helper logic across rooms; if the same logger wrapper, validator or presence helper is needed by more than one room, it must be a shared helper module, not copy-pasted
- Gameplay behavior, even small isolated bits, must not be added to a room file without a dedicated task that also updates `docs/ARCHITECTURE.md` and `docs/CODING_RULES.md`
- Extract helpers before files become monolithic; if a room file starts needing its own logger, validator, schema builder, presence builder or message handler, that piece must move to a separate file first

Extraction examples (already applied):

```text
apps/server/src/realtime/rooms/roomLogger.ts             - shared Colyseus logger wrapper
apps/server/src/realtime/rooms/resolveTownSpawnPoint.ts  - content-based spawn point lookup
apps/server/src/realtime/rooms/buildPlayerPresence.ts    - presence builder (spawn + initial x/y copy)
apps/server/src/realtime/rooms/initializeTownEnemies.ts  - content-driven enemy spawn from spawn zones
apps/server/src/realtime/rooms/respawnTownEnemies.ts     - enemy respawn with new position inside spawn zone
apps/server/src/realtime/rooms/wanderEnemies.ts          - idle enemy wander movement near spawn
apps/client/src/net/townRoomPresence.ts                  - client presence extraction helper
```

Any new room helper must follow the same pattern: own file, focused responsibility, no gameplay, no hardcoded content.

## Spawn Point Foundation Rules

Core 0.1 ships the data-driven spawn point foundation defined across `packages/shared/src/room/SpawnPointTypes.ts` and `packages/content/src/data/spawnPoints.ts`. Spawn point behavior is intentionally limited to data flow and join-time resolution; no movement, no map, no entity placement and no combat depend on it yet.

Spawn point foundation rules:

- `SpawnPointDefinition` (`packages/shared`) and `SpawnPointContentDefinition` (`packages/content`) are the only source of truth for spawn point data; gameplay systems must not hardcode spawn point ids, x/y, or labels
- the Core 0.1 content registry ships exactly one spawn point, `nightmarket_spawn`, bound to the `nightmarket` zone
- `TownRoom` must resolve the spawn point through `resolveTownSpawnPoint(resolvedZoneId)` in `apps/server/src/realtime/rooms/resolveTownSpawnPoint.ts`; the helper is a side-effect-free content lookup that throws if the resolved zone does not match the spawn point binding
- `PlayerPresence` stores `spawnPointId` only; it must not store x/y or any other active world position
- x/y on `SpawnPointDefinition` are content data only; they are not an active gameplay position and must not be read, displayed, synchronized, or used by client, server, or scene code as a player's world position yet
- client presence rendering may display `spawnPointId` next to the player's display name when the server-side presence entry provides one, but must not show x/y and must not imply an active position
- client presence extraction must not import Colyseus schema types directly; it goes through the existing helper module
- do not add player entity placement, movement, map rendering, scene-based entity spawning, combat, loot, XP, inventory, equipment, corpse behavior or any other gameplay behavior to the spawn point foundation without a dedicated task
- the spawn point foundation is data flow only and must not be presented as gameplay

---


## Player Position Foundation Rules

Core 0.1 ships a minimal player position foundation defined in `packages/shared/src/room/PlayerPosition.ts`, in the `PlayerPresence` Colyseus schema, and in the `buildTownPlayerPresence()` helper. Position is intentionally limited to data flow and a one-shot spawn-time copy; it is not movement.

Player position foundation rules:

- `PlayerPosition` is a shared type that intentionally reuses the `Vector2` shape (`{ x, y }`); no facing/direction/interpolation field is part of this type yet
- `PlayerPresence` exposes `x` and `y` as number fields; the server must copy them from the resolved spawn point at join time and must never update them after join
- persisted character runtime location may override the join-time spawn fallback only when the saved `lastLocationZoneId` matches the resolved room zone and the saved x/y are inside that zone's content bounds; otherwise the server must fall back to the resolved spawn point
- `PlayerPresence` construction lives in `buildTownPlayerPresence()` (`apps/server/src/realtime/rooms/buildPlayerPresence.ts`) and must not be inlined into `TownRoom.ts`; the room file must stay a thin Colyseus shell
- The `x`/`y` on `PlayerPresence` are the player's initial world position only; they are not an active gameplay position and must not be presented as one
- The client `getTownRoomPresence()` helper exposes `position?: { x, y }` per player; callers may show x/y only as debug info next to the player's display name (e.g. `(x=..., y=...)` suffix) and must not imply movement, facing, animation or a map position
- do not add movement input, server-side movement simulation, pathfinding, facing/direction interpolation, map rendering, scene-based player placement, player sprite, combat, loot, XP, inventory, equipment or corpse behavior to the player position foundation without a dedicated task
- the player position foundation is data flow only and must not be presented as gameplay

## Zone Bounds Content Rules

Core 0.1 ships zone-specific movement bounds as part of zone content definitions. Each zone defines a `bounds` field (`{ minX, maxX, minY, maxY }`) that represents conservative placeholder constraints for movement intent validation, not collision geometry or map size.

Zone bounds content rules:

- `ZoneContentBounds` is a shared type defined in `packages/content/src/data/types.ts` with four finite number fields: `minX`, `maxX`, `minY`, `maxY`
- Every `ZoneContentDefinition` must include a `bounds` field
- Content validation (`validateContentRegistry`) enforces that:
  - `minX < maxX` and `minY < maxY`
  - all four values are finite numbers
- `resolveZoneBounds(zoneId)` (`apps/server/src/realtime/rooms/resolveZoneBounds.ts`) is the server-side helper that looks up zone bounds from the content registry by `ZoneId`
- `TownRoom.registerMovementIntentHandler` resolves the room's `zoneId` through `resolveZoneBounds` and passes the result as `bounds` to `validateMovementIntent`, replacing the old generic `DEFAULT_MOVEMENT_INTENT_BOUNDS`
- The `DEFAULT_MOVEMENT_INTENT_BOUNDS` constant in `movementIntentValidation.ts` remains as a fallback when no caller-supplied bounds are provided (e.g. future combat rooms before they adopt zone-aware bounds)
- Zone bounds are placeholder zone constraints, not collision geometry or map size; they must not be used for map rendering, pathfinding, collision detection, or game world geometry
- zone content validation must not be presented as gameplay

## Client World Area Bounds Rules

Core 0.1 ships a client-side helper at `apps/client/src/game/scenes/accountShell/resolveWorldAreaBounds.ts` that resolves zone bounds from the content registry for the click-to-move input panel. The bounds are placeholder movement constraints, not collision geometry or map size.

Client world area bounds rules:

- The client resolves zone world-area bounds through `resolveWorldAreaBounds(zoneId)`, which reads `ZoneContentDefinition.bounds` from the content registry
- Falls back to safe 480x320 defaults if the zone is missing from content (should only happen if content data is missing, which would fail content validation)
- The helper documents that bounds are placeholder movement intent constraints — NOT collision geometry or map size
- The client now depends on `@doomscrolls/content`; this is acceptable because the content package contains only pure TypeScript data and types with no Node-only runtime imports (no Prisma, Fastify, Colyseus, PostgreSQL)
- If `@doomscrolls/content` ever gains Node-only imports, a future task must extract a shared public content snapshot for client use
- The client world area bounds must not be used for map rendering, collision detection, pathfinding, speed checks, or game world geometry
- No map rendering, pathfinding, collision, or speed checks are implemented yet

## Movement Intent Foundation Rules

Core 0.1 ships a movement intent foundation defined in `packages/shared/src/protocol/ClientMessages.ts`, `packages/shared/src/protocol/ServerMessages.ts`, the server helper `validateMovementIntent()` in `apps/server/src/realtime/rooms/movementIntentValidation.ts`, the `TownRoom` `request_move` message handler, and the client helper `sendMovementIntent()` in `apps/client/src/net/movementIntentClient.ts`. The intent contract and validation shell are in place; movement simulation itself is intentionally not part of this batch.

Movement intent foundation rules:

- The client may only send `RequestMoveClientMessage { type: "request_move", targetX, targetY, clientTime? }`. The server never accepts client-sent damage, kills, XP, loot, inventory changes, equipment changes, level-up or quest completion
- `targetX` / `targetY` are required finite numbers; `clientTime` is optional and informational only and must never be trusted for any gameplay outcome
- The server helper `validateMovementIntent({ message, bounds? })` returns a discriminated `{ ok: true, targetX, targetY, clientTime? } | { ok: false, reason }` result and never throws
- Server-owned rejection reasons live in `RequestMoveRejectedReason = "invalid_shape" | "non_finite_target" | "out_of_range"`; the reason set is intentionally generic across future combat / dungeon / boss rooms
- `TownRoom.onMessage("request_move", ...)` validates the intent and, on acceptance, stores the player's latest authoritative movement target via `applyMovementIntent()`; on rejection, sends a `request_move_rejected` message back
- The server helper `applyMovementIntent(state, sessionId, targetX, targetY)` lives in `apps/server/src/realtime/rooms/applyMovementIntent.ts` and stores `hasMovementTarget` / `targetX` / `targetY` in the Colyseus schema state. It must not validate, move instantly, check speed/cooldown/collision/pathfinding, persist to DB, or trigger gameplay events
- `TownRoom` runs a server-owned simulation interval every 50 ms and delegates movement stepping to `stepTownRoomMovement(state, deltaMs)` in `apps/server/src/realtime/rooms/stepTownRoomMovement.ts`
- `stepTownRoomMovement()` is the only place in this foundation that may mutate synced `PlayerPresence.x` / `y` after join; it moves them gradually toward the stored target and clears the target when close enough
- `TownRoom.onLeave()` must persist the latest synced `PlayerPresence` x/y plus the current room zone to the character's optional `lastLocationZoneId` / `lastLocationX` / `lastLocationY` fields so reconnect can restore the last valid in-zone location
- `TownRoom` must resolve runtime movement speed from the joined character's derived stats on join and store it in `PlayerPresence.movementSpeed`
- `stepTownRoomMovement()` must use each player's stored `movementSpeed` for per-player authoritative step distance; it must not invent client-owned speed
- `TOWN_MOVEMENT_SPEED_FALLBACK_UNITS_PER_SECOND` exists only as a server safety guard when runtime speed is missing or invalid; it must not be documented or treated as the primary gameplay speed source
- A newer valid `request_move` replaces the previously stored target for that player
- The server still does NOT know about collision, pathfinding, combat, or persistence; movement stepping is only authoritative target following
- Default movement intent bounds (`DEFAULT_MOVEMENT_INTENT_BOUNDS`) are a temporary, conservative numeric range, not a map size; real map-aware bounds will be introduced together with real map data in a later task
- The client helper `sendMovementIntent(room, targetX, targetY, options?)` lives in its own module and is the only sanctioned way to send a `request_move` intent; it must not be wired to UI, mouse clicks, Phaser scene input or `AccountShellScene` until an explicit click-to-move task is added
- `AccountShellScene` must not import `sendMovementIntent`; movement intent UI is deferred to later tasks
- Client rendering must use synced room-state x/y only; it must not fake local movement, prediction, interpolation, smoothing or instant teleports on click
- Movement step foundation code must not implement collision detection, pathfinding, stat-driven speed, map rendering, scene-based entity placement, player sprite, combat, loot, XP, inventory, equipment, corpse behavior, or persistence
- The movement intent + step foundation is a network contract, validation shell and authoritative stepping layer only and must not be presented as complete gameplay
- The client `AccountShellScene` must not import `sendMovementIntent`; movement intent UI is deferred to later tasks
  (the dev-only "Send test move intent" button introduced by Task 027 lives in
  `apps/client/src/game/scenes/accountShell/testMoveIntentView.ts` and is rendered by
  `worldEntryView.ts` only after Enter World, not in `AccountShellScene`)
- The dev-only test move intent button must not update any local position, must not pretend movement
  happened, must not read mouse or keyboard input, and must not introduce any map, sprite, pathfinding,

## WorldSession Visual Layer Rules

Core 0.1 ships a minimal WorldSession visual layer in `apps/client/src/game/scenes/WorldSessionScene.ts` plus the extracted helpers `apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts` and `apps/client/src/game/scenes/worldSession/worldSessionOverlayView.ts`. This layer is intentionally limited to synchronized visual feedback and real movement-intent input; it is not gameplay.

WorldSession visual layer rules:

- `WorldSessionScene` must stay the connected-room orchestration shell; world-area rendering/input logic belongs in `worldSessionAreaView.ts` or future dedicated helper modules, not inlined into a growing scene file
- connected-room overlay grouping belongs in small helper/view modules such as `worldSessionOverlayView.ts`, not inlined into a growing scene file
- the world-area view may render only content-derived zone bounds for the active room zone; these bounds are visualized from content data and must not be presented as collision geometry, navigation mesh or map art
- the player marker/dot must use synced `TownRoom` presence `x`/`y` only
- enemy placeholders may render only synced `EnemyPresence` x/y, label and hp/maxHp data from room state; they must stay simple placeholder shapes/text, not sprites or gameplay actors
- room header/status display must read synced `roomKind` from room state rather than inventing or hardcoding the value client-side
- client code must not fake local movement, prediction, smoothing, interpolation or invented position updates in this layer
- debug presence text may show synced `movementSpeed` when it is already present in `PlayerPresence`, but this must stay debug text only and must not become a gameplay HUD
- movement debug text may show the last click target only when it comes from a real already-sent client intent; it must not imply arrival, prediction or local movement
- click/tap input in the world area may send only a real `request_move` intent through `sendMovementIntent()` on an already-joined room
- tap left click keeps the existing movement behavior: one valid click sends one real move target intent
- holding left mouse on empty ground may refresh/update the authoritative move target over time for Diablo-like travel feel, but only by sending throttled real movement intents
- hold-left-mouse movement applies only on empty-ground travel; it must not imply hold-to-auto-attack, hold-to-auto-pickup, or other auto-action chains yet
- repeated hold movement intents must be throttled; the client must not spam unbounded `request_move` messages every frame
- server-authoritative movement remains mandatory during hold behavior: the client sends only target intents, and the server alone validates, stores, and advances synced position
- visual refresh after input must come from synced room-state updates, not from local speculative movement
- runtime sanity for movement must continue to confirm gradual server-synced stepping and valid second-click retargeting, not instant local teleport behavior
- the connected-room overlay must clearly state that it is temporary server-synced debug state, not final gameplay UI
- do not add sprites, tiles, background map art, collision, pathfinding, animation, combat, enemy AI, enemy attacks, loot, XP, inventory UI or persistence to this layer without a dedicated task
- helper extraction is required before `WorldSessionScene` becomes a god file; `worldSessionAreaView.ts` and `worldSessionOverlayView.ts` are the current examples and pattern to follow

## Testing

Tests are required from the beginning.

Minimum required checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Core test areas:

```text
content validation
auth
settings validation
origin/class validation
character creation
damage calculation
inventory placement
loot generation
corpse recovery
```

---

## Documentation

Update docs when changing:

```text
architecture
setup
auth behavior
database schema
content model
gameplay rules
task status
known limitations
deployment
testing commands
```

Known shortcuts must be recorded in `docs/TECH_DEBT.md`.

---

## Local Infrastructure

Local Docker Compose infrastructure belongs under `infra/compose`.

Rules:

- commit `.env.example` files with safe local placeholders only
- never commit real secrets or local `.env` files
- local PostgreSQL and Redis services must include healthchecks
- local infrastructure must not include fake server/client containers
- production deployment and cloud infrastructure require separate explicit tasks

---

## Localization

English is the source/default language.

Core 0.1 supports only the `en` locale in code. Do not add language settings, a language selector or inactive locale codes until real locale files exist.

User-facing text should use localization keys from `packages/localization` instead of hardcoded strings. Missing keys must fail visibly, for example with a `[missing:key]` fallback, and must not silently return an empty string.

---

## Content Registry

Core content definitions belong in `packages/content` as modular data files.

Rules:

- gameplay systems must consume `contentRegistry` definitions instead of hardcoding content values
- content definitions must use localization keys for player-facing names and descriptions
- cross-references must be validated with `validateContentRegistry` or `assertValidContentRegistry`
- missing content lookups must not silently return fake fallback content
- loot tables define weighted entries only; random loot rolling belongs in a later server-authoritative loot system
- content data must not import Phaser, Prisma, Fastify, Colyseus, Redis, PostgreSQL or Node-only runtime APIs

---

## Enemy Movement Speed Rules

Enemy `moveSpeed` values from content definitions must be scaled to world-units-per-second using the same multiplier as player speed, otherwise enemies move at <1 wu/sec and can never catch a player running at 200+ wu/sec.

Rules:

- `ENEMY_MOVEMENT_SPEED_UNITS_PER_SECOND_MULTIPLIER = 220` applies the same scaling factor as `TOWN_MOVEMENT_SPEED_UNITS_PER_SECOND_MULTIPLIER` to enemy content `moveSpeed`
- enemy `moveSpeed: 1.0` yields 220 world-units/sec, matching the player speed convention from `resolvePlayerMovementSpeed`
- the multiplier constant exists in `TownRoom.ts` and is applied at runtime when resolving `enemyDefinition.moveSpeed` during chase/pursuit movement
- the same multiplier is used in wander movement (`wanderEnemies.ts`) through the existing `moveSpeedUnitsPerSecond` parameter passed to `applyWanderMovement()`
- if content `moveSpeed` is missing or zero, the enemy effectively cannot move (speed = 0)

## Overlay Click Capture Rules

WorldSession DOM overlays must prevent click-through to the Phaser canvas while keeping empty overlay regions transparent to canvas clicks.

Rules:

- visible interactive overlay controls (respawn button, reset objective, inventory items, equip/unequip buttons) must call `event.stopPropagation()` on click handlers to prevent the event from reaching the canvas
- passive overlay containers and wrapper/background zones must use `pointer-events: none` so canvas clicks pass through unblocked
- `worldSessionPointerEvents.ts` exports `makeInteractive()` (sets `pointerEvents: "auto"`) and `makePassive()` (sets `pointerEvents: "none"`) as shared helpers
- interactive panel roots (containing respawn, inventory, equipment, controls) must stay stable across state updates and must not be replaced during overlay refresh; only their inner content should update

## Loot Hit Testing Rules

Loot pickup hit testing on the client must use the same deterministic visual scatter offset as the loot rendering, so clicks on the visible body reliably resolve to the correct `worldLootId`.

Rules:

- both `worldSessionLootPlaceholderView.ts` (render) and `worldSessionAreaView.ts` (hit test) must call `getScatterOffset(loot.id)` with the same `SCATTER_RANGE = 12` for consistent visual-to-hit-test alignment
- `lootScreenPositions` in `worldSessionAreaView.ts` stores the screen-space position as `loot.x + getScatterOffset(loot.id).x + worldOffset.x` (and same for y) — the same formula used by the loot placeholder rendering
- `findClickedWorldLoot()` iterates the screen-position map and uses Euclidean distance (5px threshold) from the pointer to the stored scatter-adjusted position
- the client-side visual scatter range (12px) is independent of the server-owned drop scatter range (8px) — they serve different purposes (readability vs drop placement) and use different RNG (deterministic hash vs seeded mulberry32)

## Loot Interaction Stability Rules

Task 192 fixed the following loot/inventory interaction bugs and established these rules:

- inventory item selection in the overlay panel must not auto-reselect the first item on every render; doing so caused an infinite re-render loop that prevented reliable row clicks
- defeated enemies must not block loot clicks: `findClickedEnemy()` must skip enemies whose `defeated` flag is true so the loot entry underneath is reachable
- input/target priority: alive enemy > world loot > interactable > ground movement; defeated enemies are transparent to clicks
- enemy drops scatter around the defeated enemy corpse using server-owned seeded RNG (mulberry32) so each drop gets a unique offset instead of stacking at one exact point
- both item loot and currency loot are server-authoritative WorldLoot entries; they may drop simultaneously from the same defeat, each at its own scattered position
- scatter offsets are clamped inside the zone bounds to avoid out-of-bounds drops

## Ground Loot Readability and Pickup Rules

Core 0.1 ground loot readability and pickup rules ensure the client visual representation stays aligned with server-authoritative state and that item/currency loot remain visually distinct at a glance.

Rules:

- both item loot and currency loot render as ground loot placeholder visuals in the world session; neither is invisible or gated behind a toggle
- client-side deterministic hash-based scatter (`SCATTER_RANGE = 12`) is visual-only and separates overlapping labels; the server owns actual loot positions via seeded-RNG scatter (`SCATTER_RANGE = 8`) and may produce different absolute coordinates — the client must render at server-synced x/y plus its own visual scatter, not the other way around
- pickup hit radius (the interactive body area) must stay visually aligned with the rendered loot placeholder so clicks against the visible body reliably resolve to the correct `worldLootId`; if body rendering or scaling changes, the interactive hit area must be updated in lockstep
- currency loot remains visually distinct from item loot: currency uses an ellipse body with gold-tinted palette, item loot uses a rectangle body with rarity-based palette; this distinction must be preserved in any future visual refresh so players can identify currency at a glance without clicking
## RNG and Loot Foundation Rules

Future RNG and loot systems must stay server-authoritative, deterministic to test, and free of fake outcomes.

Rules:

- gameplay RNG helpers must live on the server side only; client code must not roll gameplay outcomes
- the client may send pickup/attack/interact intent, but it must never decide drop success, rarity, quantity or item identity
- reusable RNG helpers should support deterministic tests through explicit seeded/input-driven behavior where appropriate
- weighted loot selection must go through dedicated helpers rather than scattered `Math.random()` calls across rooms/services
- loot tables remain content definitions; systems consume weighted entries from content rather than hardcoding drops in room logic
- enemy defeat must not automatically imply visible loot unless the server actually rolled and created synced loot state
- do not add fake drops, fake pickup confirmations, fake item preview beams or client-predicted loot outcomes
- loot documentation and implementation must state clearly whether a task adds only planning, only data definitions, or real server-owned drop generation/pickup flow

---

## Targeted Actions, Enemy AI, Player HP, Loot Pickup, HUD Direction Rules

The recent Core 0.1 checkpoint added the first narrow slices of server-authoritative targeted gameplay. They are foundation-level only; the rules below lock down what is and is not in scope so they cannot accidentally be presented as full combat, full AI, full loot/inventory/equipment or final HUD art.

Rules:

- Server-authoritative movement remains mandatory: the client sends only `request_move` target intents, `TownRoom` stores the authoritative target and advances synced x/y on the server tick, and the client must not fake local arrival/teleportation
- The targeted action approach is "move first, then act": when the client sends a click intent (attack / interact / pickup) against a target that is out of range, the server stores a pending action plus movement target and processes the original action only once the simulation tick brings the player in range; the client never decides whether the action succeeded
- Enemy AI on the synced `Trashboar Runt` baseline placeholder is intentionally limited to content-driven spawn zones (multiple enemies per zone), idle wander near spawn, aggro, chase, leash return, melee attack windup/landing, defeat and respawn with a new position inside the spawn zone; the `trashboar_skitter` and `trashboar_brute` content variants reuse this same AI / loot / XP / render pipeline with only numeric stat differences (and a heavy-attack window on the Brute); no pathfinding, no projectiles, no enemy ability bar, no enemy progression, no rarity tiers, no enemy packs, no persistence
- Player HP / downed / respawn / corpse foundation is server-owned: `PlayerPresence` holds current HP and max HP, enemy hits reduce HP server-side, HP updates reach the client only through synced room state, at 0 HP the player is marked as downed (movement and combat disabled) and a corpse marker is placed at the death location; respawn restores HP/flask and places the player at a safe location; after respawn the corpse marker persists so the player can walk back and recover it via `request_corpse_interact`; server validates lifeState/hasCorpse/range before accepting; rejections are `player_downed`/`no_corpse`/`out_of_range`; own corpse uses distinct teal visual; corpse recovery is visual/placeholder only: no gear loss, no durability loss, no XP loss, no corpse inventory, no hardcore mode, no persistence
- Dodge and healing flask are server-authoritative only: dodge validates direction/cooldown and applies an authoritative short displacement; flask validates alive/full-hp/charges/cooldown and heals server-side only. No stamina system, no mana/resource globe system, no refill vendor flow and no client-owned healing numbers
- Loot pickup is server-authoritative: the client sends only a `worldLootId`; the server validates ownership, distance and that the loot still exists, then removes the synced room-state entry and persists the item into the real character inventory; current account/inventory summary/detail views must read real persisted state, not fake local reward state
- Current equipment/inventory checkpoint scope is narrow and must be documented that way: pickup writes a real inventory item, inventory detail is read-only, equip moves an item from inventory into an equipment slot, and unequip moves it back to the first free inventory slot
- Current equipment/inventory checkpoint forbidden overstatement: do not describe the feature as supporting drag/drop, stat recalculation or item comparison until those behaviors are implemented for real
- The current connected-room overlay is a temporary server-synced HUD/resource placeholder and debug shell only; it must remain clearly labeled as such in the UI and the docs
- The future default HUD will use Diablo-like orbs (health globe + mana / resource globe) in the bottom corners
- An optional WoW-like framed bars mode may be added later behind a setting, but the orbs are still the default; the framed-bars mode must not become the default HUD
- None of these slices may add fake client-side prediction for action success, enemy death, player damage, loot pickup, flask results, dodge outcomes, or HUD numbers; every gameplay outcome still comes from synced room state
- None of these slices may add XP, quests, equipment flow, inventory drag/drop, vendor/stash, full corpse recovery, full pathfinding, full AI variety, or final HUD art unless the related docs are updated in the same task and the implementation is real

## Combat Gameplay Rules

Core 0.1 combat gameplay is intentionally narrow and must not be overstated:

- left-click basic attack remains server-authoritative and uses the existing move-first-then-act deferred-action flow
- RMB Grave Spark is a real targeted skill sent through `request_skill_slot` with content-defined cooldown/cost/range/telegraph; it must not be described as a placeholder or fake
- out-of-range Grave Spark queues a server-owned move-to-cast: the server stores the skill intent alongside the movement target and executes the skill once the player is in range; the client must not decide cast success
- enemy telegraphs can miss if the player dodges or leaves attack range before the telegraph lands; dodge relevance against enemy attacks is real and server-owned
- enemy pressure values (aggro range, leash range, attack cooldown, damage, telegraph duration) are content-driven and must not be hardcoded in room logic
- there is no mana/resource system, no skill tree, no pathfinding, no collision, and no combat animations yet; these must not be documented as implemented

## Shared Loot Container Foundation Rules

Core 0.1 ships a shared loot container foundation that is intentionally limited to data flow and room-instance lifecycle, not persistence:

- one shared Nightmarket crate exists
- crate opens once per room instance
- server rolls loot and spawns world loot near crate
- opened state syncs to clients
- not persisted yet
- no stealing/crime/locks/respawn timers yet
- the shared loot container foundation must not be presented as gameplay

## Town Service Placeholder Rules

Core 0.1 ships placeholder town services in the Nightmarket: Vendor (Suspicious Vendor), Stash Keeper, Trainer and Waypoint. All are content-driven interactables with placeholder panels/messages and no real behavior.

Rules:

- services are defined in `packages/content/src/data/townServices.ts` with `serviceKind` and `unavailableMessageKey`
- services render as interactable `town_service` or `vendor` objects from `worldProps` content definitions
- Vendor has a dedicated DOM overlay panel (`apps/client/src/game/scenes/worldSession/vendorInteractionPanel.ts`) showing "Trading is not available yet." with current money snapshot
- Stash Keeper, Trainer and Waypoint return content-driven localization messages via `getInteractableResponseMessage()`
- no real trading, stash storage, skill training, teleport, waypoint persistence or money spending exists
- Nightmarket remains `test_hybrid` (not `safe_hub`) for Core 0.1

## Copper Currency Rules

Core 0.1 ships a copper currency foundation: `Character.moneyCopper` is persisted in the database (initialized to 0 at character creation), copper drops from defeated enemies use the world loot system (`WorldLoot` with `currencyCopper > 0` and `itemId = ""`), and pickups increment the persisted `moneyCopper` total server-side through `CharacterRepository.incrementMoneyCopper()`.

Copper currency rules:

- copper drops are server-authoritative: the server rolls `currencyDrop` from the enemy's content definition in `rollCurrencyLoot()`, spawns a world loot entry, and the client sends only a `worldLootId` pickup intent
- on pickup success the server increments `moneyCopper` in the database atomically and sends a `currency_picked_up` message back to the client; the client does not invent local copper totals
- copper drops render as ground loot with a distinct gold-tinted visual (ellipse body) separate from item loot (rectangle body) as documented under ground loot readability rules
- `currencyDrop` on enemy definitions is an optional `{ min, max }` range; enemies without it drop zero copper
- vendors, shops, trading, NPC buying/selling, regional currency, honor currency, reputation, crypto, and any other money-spending or money-conversion systems are **not implemented** in Core 0.1

---

## Final Rule

If a feature only appears to work, it is not done.

If it cannot survive refresh/reconnect where persistence is required, it is not done.

If it trusts the client for gameplay outcome, it is not done.

If it hardcodes content into systems, it is not done.

If it breaks CI, it is not done.
