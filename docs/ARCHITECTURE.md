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

The Colyseus shell now registers an empty `TownRoom` with the room name `town`. `TownRoom` accepts join attempts only after validating a real `sessionToken` and `characterId`; the selected character must belong to the authenticated account. It has no player entity, no room state schema, no map, no movement, no combat, no enemy spawning, no loot, no gameplay messages and no client UI connection yet. `CombatRoom`, movement, combat, enemy spawning, loot and gameplay messages are deferred to later Core 0.1 tasks.

The Prisma schema foundation exists, and the server validates `DATABASE_URL` so configuration is explicit. The current runtime uses persistence for auth, character APIs and room join validation, but does not implement room persistence, inventory logic, corpse recovery logic or gameplay business logic.

Auth HTTP endpoints (`POST /auth/register`, `POST /auth/login`, `GET /me`) are now registered in the Fastify app via `registerAuthRoutes`. Character HTTP endpoints (`GET /characters`, `POST /characters`, `GET /characters/:characterId`) are registered via `registerCharacterRoutes`. Auth and character routes use request validation with zod, a reusable Bearer token authentication middleware and centralized safe error-to-HTTP mapping. The server owns character creation and account state; it does not implement frontend behavior, gameplay rooms, movement, combat, loot, seed data or fake character data.

---

## Client Account Shell and Character UI

The browser client uses the real backend auth and account-state APIs for the authenticated account shell. After registration/login or startup token resume, the client calls `/me` with `Authorization: Bearer <token>` and renders only the returned account/profile/settings/character data.

Current implemented client character behavior:

```text
AccountShellScene shows real characters from /me
character creation submits real POST /characters requests
after creation, the client refreshes real account state
browser refresh resumes the character list through /me
duplicate same-account character names show a safe error
first real character is selected by default
user can select another real character
selectedCharacterId persists in localStorage as doomscrolls.selectedCharacterId
stored selection is restored only for current-account characters
logout clears selected character storage
```

Core 0.1 currently exposes only the locked create options:

```text
origin: sewer_dweller / Sewer Dweller
class:  gravewalker / Gravewalker
```

Current client character UI status:

```text
Enter World button calls real RealtimeClient.joinTownRoom on click
Enter World enabled only when a character is selected
successful join starts WorldSessionScene, the connected room shell
failed join shows safe "Could not enter world."
Leave button appears after successful join
room reference is stored in client memory only
after join, client renders roomKind, zoneId, connectedPlayerCount from room state
client extracts player presence via getTownRoomPresence() helper and renders display names / character IDs
player presence helper lives in apps/client/src/net/townRoomPresence.ts, separate from AccountShellScene
no map, movement or combat yet
no inventory/equipment UI yet
no seed character data
no fake characters
```

### Interactable object architecture (Core 0.1)

```text
Network contract:
  RequestInteractClientMessage: { type: "request_interact", objectId }
  InteractResponseServerMessage: { type: "interact_response", objectId, message }

Server-side:
  Colyseus schema: Interactable class with @type decorators
  TownRoomState: interactables MapSchema<Interactable>
  initializeTownInteractables(state, zoneId): populates static objects from zone definition
  validateInteractIntent(state, playerX, playerY, objectId): validates distance <= 50 units
  getInteractableResponseMessage(objectId): returns safe text response
  TownRoom.onMessage("request_interact", ...): validates request, sends response or logs rejection
  No persistence: objects are recreated on room instantiation

Client-side:
  sendInteractIntent(room, objectId): dispatches request_interact message
  registerInteractResponseListener(room, callback): listens for server responses
  worldSessionInteractablesView.ts: renders objects as geometric shapes + labels, handles clicks
  WorldSessionScene: listens for responses, displays message for 3 seconds

Core 0.1 Scope:
  Nightmarket has one visible object: notice board at (120, 140)
  Objects are rendered as simple gold rectangles with labels
  Distance validation is 50 unit radius from player
  Responses are safe text only; no game logic coupling
  No quests, loot, inventory effects, NPC dialogue, combat, collision or rewards
```

Current WorldSession visual layer status:

```text
WorldSessionScene is the connected realtime-room scene
worldSessionAreaView.ts is an extracted rendering/input helper to avoid god-file growth
worldSessionOverlayView.ts is an extracted DOM helper for the connected-room debug overlay
worldSessionInteractablesView.ts is an extracted interactable object rendering/click helper
the client renders content-derived zone bounds for the active room zone
the player placeholder is a simple circle (body) + triangle (direction marker) + ellipse (shadow) + core
the player body position uses synced TownRoom presence x/y only
the direction marker (triangle) rotates to point toward the last movement target / click point
the client renders synced TownRoom enemies as simple placeholder shapes with label + HP text
interactable objects render as simple placeholder shapes (rectangles) with labels
click/tap on an interactable object sends a real request_interact intent
the client does not fake or predict local movement
the marker updates only after room-state sync from the server
interact response messages display for 3 seconds before clearing
roomKind display reads synced roomKind from room state

### Basic attack intent foundation (Core 0.1)

```text
Network contract:
  RequestAttackClientMessage: { type: "request_attack", targetEnemyId }
  RequestAttackAcceptedServerMessage: { type: "request_attack_accepted", targetEnemyId }
  RequestAttackRejectedServerMessage: { type: "request_attack_rejected", reason, targetEnemyId? }

Server-side:
  validateAttackIntent(state, player, targetEnemyId): validates player presence, enemy existence and distance <= 64
  applyEnemyDamage(enemy, 1): subtracts fixed damage, clamps hp at 0
  TownRoom.onMessage("request_attack", ...): orchestrates validation, sends safe accept/reject response, updates synced enemy hp
  enemy hp remains authoritative in TownRoomState.enemies MapSchema sync

Client-side:
  sendAttackIntent(room, targetEnemyId): dispatches request_attack intent only
  registerAttackResponseListeners(room, ...): listens for safe accepted/rejected responses
  worldSessionEnemyPlaceholderView.ts: exposes click handling for synced enemy placeholders
  worldSessionAreaView.ts: sends attack intent on enemy click, no local hp mutation
  WorldSessionScene: shows safe feedback ("Attack sent" / "Too far away")

Core 0.1 Scope:
  one-click basic attack intent against synced placeholder enemies
  fixed server-owned damage of 1
  hp text updates only through synced room state
  no enemy AI, enemy attacks, player damage, loot, xp, death, persistence, animations or pathfinding/collision
```
the overlay groups room info, player presence and movement debug into readable sections
the overlay states clearly that it is temporary server-synced debug state, not final gameplay UI
movement debug may show the last click target sent by the client, but position still comes only from synced room state
TownRoom currently syncs one static Trashboar Runt placeholder enemy in the Nightmarket only
this is still placeholder visual UI, not final art or animation
no sprites, no map art, no collision, no pathfinding, no final animation, no combat, no enemy AI
no inventory UI, no persistence, no rich NPC dialogue, no quests, no rewards yet
```

Client scene boundary rule:

```text
AccountShellScene = authenticated account/character shell before room connection
WorldSessionScene = connected room shell after a successful realtime join
```

`AccountShellScene` was refactored to avoid god-file growth. DOM helpers, a shared account header helper, character list view, character create form view, and world entry view were extracted into separate modules under `apps/client/src/game/scenes/accountShell/`. `WorldSessionScene` follows the same rule: its world-area rendering/input logic is split into `apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`, and its grouped connected-room debug overlay lives in `apps/client/src/game/scenes/worldSession/worldSessionOverlayView.ts`, leaving the scene focused on orchestration and room-state refresh. Code-size rule: scene files must not grow into monoliths; extract view/helper modules as the scene accumulates functionality.

Runtime verification summary:

```text
registered test account clientchar_1780480193
created character Karel
POST /characters returned 201
refresh restored character through /me
duplicate Karel returned 409
logout/login preserved character visibility
no fake character data appeared

account verify0164_1780482330
created PersistOne and PersistTwo
selected PersistTwo
refresh preserved PersistTwo
logout cleared selected character storage
login restored valid selected character
no play button, room join or gameplay added
```

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

The auth service layer provides HTTP endpoints via Fastify routes:

```text
POST /auth/register  - Create a new account (201 Created)
POST /auth/login     - Login with credentials (200 OK)
GET  /me             - Get authenticated account state (200 OK)
```

Auth routes use Bearer token authentication via the `Authorization: Bearer <token>` header. Cookies, refresh tokens, OAuth, Google login, email login and password reset are not implemented yet. `passwordHash` and `tokenHash` are never returned in API responses. The raw session token is only returned to the client after successful register or login.

Auth HTTP route files:

```text
apps/server/src/http/routes/auth.routes.ts       - Route handlers for register, login, me
apps/server/src/http/middleware/authenticate.ts   - Reusable Bearer token authentication
apps/server/src/http/errors/httpErrorMapper.ts    - Auth error to HTTP status/response mapping
```

Request validation uses zod schemas defined in the route handlers. The `/me` endpoint uses the `authenticateRequest` middleware which extracts the Bearer token, calls `AuthService.getAccountStateFromToken`, and returns appropriate error responses for invalid/expired/revoked sessions.

---

## Character Domain Service

The character domain service layer lives at:

```text
apps/server/src/character/
```

Core components:

```text
CharacterService.ts      - Character listing, per-user lookup and creation logic
CharacterNameService.ts  - Character name trimming, validation and normalization
CharacterStatsService.ts - Core 0.1 starting stat calculation
CharacterErrors.ts       - Safe character error codes and messages
CharacterTypes.ts        - Character service input/output/config types
index.ts                 - Public API exports
```

Character service rules:

- authenticated HTTP character routes expose list/create/get behavior through `CharacterService`
- route handlers must not query Prisma directly
- no frontend character UI is implemented yet
- no gameplay rooms, movement, combat, loot, inventory placement or equipment logic is implemented yet
- character names are unique only within the owning account
- duplicate checks use case-insensitive `characterNameNormalized`
- origin/class lookup uses `@doomscrolls/content`
- allowed origin/class combinations are enforced from origin content definitions
- starting passives and starting zone come from origin content definitions
- starting stats are calculated on the server
- Core 0.1 inventory is initialized as 1 page, 10 columns and 6 rows

Character HTTP routes:

```text
GET  /characters              - authenticated list for the current account
POST /characters              - authenticated character creation
GET  /characters/:characterId - authenticated owner-scoped detail lookup
```

All character routes require `Authorization: Bearer <session-token>`. Missing, malformed, invalid or expired tokens return `401 Unauthorized`. Request validation in routes checks only JSON/body/path shape (`characterName`, `originId`, `classId`, `characterId` strings); detailed character-name and content validation remains in `CharacterService`. Character errors are mapped safely: invalid character name/origin/class/origin-class combination to `400`, duplicate account-local character name to `409`, missing/not-owned character to `404`, and internal character errors to `500`. Raw Prisma errors and stack traces must not be exposed.

Runtime verification status: implemented and locally verified. The verified Character API behavior is:

```text
GET  /characters              -> 200 OK
POST /characters              -> 201 Created
GET  /characters/:characterId -> 200 OK
duplicate same-account name   -> 409 Conflict
same name on second account   -> 201 Created
invalid origin                -> 400 Bad Request
missing token                 -> 401 Unauthorized
```

Runtime verification also confirmed that `passwordHash` and `tokenHash` are not exposed in Character API responses. This does not add or imply frontend character UI, gameplay rooms, movement, combat, loot, seed data, inventory placement or equipment logic.

### Character creation transaction safety

`CharacterService.createCharacter()` validates input before persistence, then delegates atomic creation to `CharacterRepository.createCharacterWithInitialState()`. The repository uses Prisma nested writes inside `$transaction` when a full `PrismaClient` is available, creating `Character`, `CharacterStats`, `CharacterPassive` and `Inventory` together. If the nested create fails, no partial character initialization should remain. Prisma unique constraint violations are mapped to the safe `CHARACTER_NAME_TAKEN` error and raw Prisma errors are not leaked. Character details include the persisted empty inventory grid configuration, but no starting items, placement behavior or equipment logic are implemented in this route task.

---

## Room Join Validation Service

The room join validation layer lives at:

```text
apps/server/src/realtime/
```

Core components:

```text
RoomJoinValidationService.ts   - Safe future-room-join validator
RoomJoinValidationTypes.ts     - Input/output types for the validator
index.ts                       - Public API exports (service + types)
```

Shared room join contracts live in `packages/shared/src/room/RoomJoinTypes.ts` and are re-exported from `packages/shared/src/index.ts`. They include:

```text
SelectedCharacterRoomJoinRequest  - characterId + requestedRoomKind + optional requestedZoneId
RoomJoinAuthPayload               - SelectedCharacterRoomJoinRequest + sessionToken
RoomJoinFailureReason             - not_authenticated | session_expired | character_not_found
                                    | character_not_owned | invalid_room_kind
                                    | invalid_zone | room_unavailable
```

`RoomKind` is defined in `packages/shared/src/room/RoomStateTypes.ts` as `"town" | "combat"`.

`RoomJoinValidationService.validateJoin(input)` performs only safe pre-join checks:

- rejects unknown `requestedRoomKind` values with `invalid_room_kind`
- rejects explicitly empty `requestedZoneId` with `invalid_zone`
- delegates character ownership lookup to `CharacterService.getCharacterForUser(characterId, userId)` so only characters owned by the authenticated user can be joined
- treats `CHARACTER_NOT_FOUND` and any other ownership failure as `character_not_owned` to avoid leaking character existence
- resolves the final `zoneId` from the explicit request or, when absent, from the persisted character record
- returns a discriminated `RoomJoinValidationResult` with safe `RoomJoinFailureReason` codes on failure
- on unknown errors returns the safe `room_unavailable` reason and never leaks Prisma details

The service is intentionally not a Colyseus room, does not register any room handler, and does not perform any actual join. It is a pure validation helper that future authenticated room-join endpoints, room authentication middleware, and the Colyseus room shell will be able to call before allowing a real room join.

Runtime verification status: implemented and locally verified against the real local PostgreSQL. The verified outcomes are:

```text
owned character         -> success
missing character       -> character_not_owned
not-owned character     -> character_not_owned
invalid room kind       -> invalid_room_kind
empty zoneId            -> invalid_zone
explicit combat zone    -> success
```

This verification does not register any Colyseus room, does not perform any real client room connection, and does not introduce any gameplay. It only proves that the future room-join gate can safely verify character ownership and validate room kind / zone. Any temp test users created during verification were cleaned up and no temp script remains in the repository.

---

## TownRoom Registration

The first Colyseus room shell is registered on the server as:

```text
room name: town
room class: TownRoom
```

`TownRoom` currently performs authenticated join validation only. Join options must include a real `sessionToken` and `characterId`; the server validates the session and verifies that the character is owned by the authenticated account before allowing the join. A valid owned character can join `town`. Invalid join cases were checked earlier through `RoomJoinValidationService` and must continue to fail with safe reasons rather than leaking ownership or persistence details.

Current TownRoom state:

```text
roomKind: "town"
zoneId: varies (currently "nightmarket")
playerPresence: MapSchema<PlayerPresence> keyed by Colyseus sessionId
  each entry: { sessionId, characterId, displayName, spawnPointId, x, y, movementSpeed, hasMovementTarget, targetX, targetY }
connectedPlayerCount: derived from playerPresence.size on join/leave
```

Spawn point foundation (Core 0.1):

```text
SpawnPointDefinition lives in @doomscrolls/shared
SpawnPointContentDefinition lives in @doomscrolls/content
Core 0.1 ships exactly one spawn point: nightmarket_spawn (zoneId = "nightmarket")
TownRoom.resolveTownSpawnPoint() resolves the spawnPointId from content on join
PlayerPresence stores spawnPointId only (no x/y, no active position)
client PlayerPresenceEntry.spawnPointId? passes the field through for display
x/y on SpawnPointDefinition are content data only and are not used as an active gameplay position yet
```

Player position foundation (Core 0.1):

```text
PlayerPosition type lives in @doomscrolls/shared (reuses Vector2: { x, y })
PlayerPresence Colyseus schema now stores x and y as number fields
TownRoom.buildTownPlayerPresence() copies the resolved spawn point x/y into the presence entry on join
x/y are copied from content once on join and are never updated after join
client getTownRoomPresence() exposes position?: { x, y } per player
client worldEntryView shows x/y next to each player's display name as debug info only
no movement input, no movement simulation, no pathfinding, no combat, no map, no player sprite, no gameplay loop
```

x/y on `PlayerPresence` are the player's initial world position only. They are copied from the resolved spawn point at join time and are never updated. They are not an active gameplay position: there is no movement input, no server-side movement simulation, no pathfinding, no facing/direction, no map, no player sprite, and no combat. They are shown on the client only as debug `(x=..., y=...)` suffixes next to the player's display name. The `PlayerPosition` shared type is intentionally identical to `Vector2`; no facing field is part of this type yet.

Movement intent foundation:

```text
shared client intent:  RequestMoveClientMessage { type: "request_move", targetX, targetY, clientTime? }
shared server reject: RequestMoveRejectedServerMessage { type: "request_move_rejected", reason, clientTime? }
shared reject reasons: invalid_shape | non_finite_target | out_of_range
server helper:        validateMovementIntent(input) -> { ok: true, targetX, targetY, clientTime? } | { ok: false, reason }
server helper:        applyMovementIntent(state, sessionId, targetX, targetY) - stores hasMovementTarget/targetX/targetY on PlayerPresence
server helper:        stepTownRoomMovement(state, deltaMs) - advances authoritative x/y toward stored target using per-player movementSpeed and clears it when reached
TownRoom.onMessage("request_move", ...)  - validates intent shape + range, on accept stores the target via applyMovementIntent(), on rejection sends request_move_rejected
TownRoom.setSimulationInterval(..., 50)  - runs the authoritative movement step every 50 ms
client helper:        sendMovementIntent(room, targetX, targetY, options?)  - sends request_move through an already-joined Colyseus room
client display:       onStateChange re-renders the world session visual layer; updated x/y shown from synced presence state only
room is intentionally a thin Colyseus shell; validation + application live in apps/server/src/realtime/rooms/movementIntentValidation.ts and applyMovementIntent.ts
newer request_move intents replace the previously stored target for that player
movementSpeed is resolved from character-derived stats on join and stored in synced PlayerPresence runtime state
fallback speed exists only as a server safety guard when synced runtime speed is missing/invalid
no collision, no pathfinding, no interpolation, no combat coupling, no persistence yet
```

This batch includes the network contract, validation shell, target storage and authoritative movement stepping. When the server accepts a `request_move` intent, it calls `applyMovementIntent()` which stores the validated `targetX`/`targetY` as the player's movement target in the Colyseus schema. On `TownRoom` join, the server resolves a runtime movement speed from the selected character's derived stats (`character.stats.derived.moveSpeed`) and stores that speed in `PlayerPresence.movementSpeed`. A separate simulation interval then runs every 50 ms and `stepTownRoomMovement()` advances authoritative `PlayerPresence.x`/`y` toward that stored target using each player's own stored speed. If a player's runtime speed is missing or invalid, the step helper uses `TOWN_MOVEMENT_SPEED_FALLBACK_UNITS_PER_SECOND` as a safety fallback only. If a newer click arrives first, it simply replaces the previous target. Colyseus broadcasts the resulting x/y updates automatically to all clients. On the client, the `onStateChange` handler re-renders the world session layer from synced room state only. There is still no collision, no pathfinding, no interpolation, no combat coupling, and no persistence tied to it yet. The validator uses zone bounds as placeholder constraints rather than real map geometry.

Authoritative movement runtime sanity passed locally with account `movecheck044` and character `Mover044`. The synced player marker moved gradually under server control rather than teleporting instantly on the client, and a second click correctly replaced the previous target before arrival. The client room header/status also fixed a display bug by reading `roomKind` directly from synced room state. This verification does not imply map art, collision, pathfinding, combat, persistence, or a real gameplay loop.

Movement intent client UI stub (Task 027 — dev-only, no simulation):

```text
apps/client/src/game/scenes/accountShell/testMoveIntentView.ts  - small dev-only button + status, owns createTestMoveIntentButton(room)
worldEntryView.ts                                                - renders the test button only when entered && room !== null (i.e. after Enter World)
sendMovementIntent()                                             - reused as-is; button calls it with hardcoded targetX=420, targetY=320
feedback                                                         - safe "Move intent sent." on dispatched, safe "Move intent not sent." on dispatch failure
no local position update, no server-side position update, no movement simulation, no map, no sprite, no combat
AccountShellScene was NOT modified; the new view module keeps the scene file lean
```

The test button exists purely to verify that the Task 026 network contract wires up end-to-end through the client UI. The server still only validates intent shape and range; it does not mutate any player position, does not broadcast, and does not know about maps, collision or pathfinding. Click-to-move, map rendering, player sprite, movement simulation, position updates and combat are deferred to later Core 0.1 tasks.

Current TownRoom limitations:

```text
no player entity list yet
no map yet
no combat yet
no gameplay yet
no collision/pathfinding yet
no movement persistence yet
```

`TownRoom` is intentionally kept as a thin Colyseus shell. Logger wrappers (e.g. `roomLogger.ts`) and other reusable helpers live in separate files under `apps/server/src/realtime/rooms/`; gameplay, map, movement, combat, AI, loot, XP, inventory, equipment, corpse, persistence and UI logic must not accumulate inside `TownRoom.ts` or future room files. Helpers must be extracted before a room file becomes monolithic. The full guard is defined in `docs/CODING_RULES.md` under `Realtime Room File-Size Guard`.

Runtime verification summary:

```text
health returned 200
user townjoin_1780491898776
character TownJoin91898776
valid Colyseus join to "town" succeeded
temp user/script cleaned up
git status clean after test
```

---

### Client World Area Bounds from Content (Core 0.1)

The client click-to-move input panel (`worldAreaInputView.ts`) resolves its zone bounds from the content registry via a dedicated helper:

```text
resolveWorldAreaBounds(zoneId)  - client helper at apps/client/src/game/scenes/accountShell/resolveWorldAreaBounds.ts
reads ZoneContentDefinition.bounds from @doomscrolls/content
falls back to safe 800x600 defaults if the zone is missing from content
bounds are placeholder movement intent constraints — NOT collision geometry or map size
no map rendering, pathfinding, collision, or speed checks yet
```

The client depends on `@doomscrolls/content` for this lookup. This is acceptable because the content package ships only pure TypeScript data and types — it imports nothing from Prisma, Fastify, Colyseus, PostgreSQL, or any Node-only runtime API. The dependency is the same pattern as the server-side `resolveZoneBounds()` helper, adapted for client-side use. If `@doomscrolls/content` ever gains Node-only imports, a future task should extract a shared public content snapshot for client use.

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
