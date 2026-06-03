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
  each entry: { sessionId, characterId, displayName }
connectedPlayerCount: derived from playerPresence.size on join/leave
```

No player entity list, no map, no movement, no combat, no gameplay state exists yet.

TownRoom rules:

- join options must include a real `sessionToken` and `characterId`
- the server must validate the session token and selected character ownership before allowing the join
- a valid owned character may join `town`
- invalid join cases must fail safely and must not leak another user's character data
- invalid join cases were checked earlier through the room join validation flow and must remain covered as join behavior evolves
- client code must not decide room access or claim join success without the server
- the server creates a `PlayerPresence` entry on `onJoin` with `sessionId`, `characterId` and `characterName` (as `displayName`)
- the server removes the `PlayerPresence` entry on `onLeave`
- `connectedPlayerCount` must derive from `playerPresence.size` on join/leave, never be set independently
- the client renders roomKind, zoneId and connectedPlayerCount from room state; additionally it may extract player presence via a dedicated helper (`getTownRoomPresence`) to display connected player names
- client presence extraction must live in a separate helper module (`apps/client/src/net/townRoomPresence.ts`), not inside `AccountShellScene`
- do not add a player entity list, map, movement, combat, loot, XP, inventory, equipment, corpse behavior, gameplay messages or client UI gameplay connection to `TownRoom` without a dedicated task
- empty room registration must not be presented as gameplay

---

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

## Final Rule

If a feature only appears to work, it is not done.

If it cannot survive refresh/reconnect where persistence is required, it is not done.

If it trusts the client for gameplay outcome, it is not done.

If it hardcodes content into systems, it is not done.

If it breaks CI, it is not done.
