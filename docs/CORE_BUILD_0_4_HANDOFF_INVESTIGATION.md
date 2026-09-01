# docs/CORE_BUILD_0_4_HANDOFF_INVESTIGATION.md — Core Build 0.4 CombatRoom / Cross-Zone Handoff Investigation

## Status

**Task 342 — investigation only.**

This document maps the current Core 0.3 room/session, travel, loading, and persistence flow, then defines the **smallest safe server-authoritative handoff contract** for a future transition from the current world session into `CombatRoom` or another zone/realm.

This task does **not** implement cross-zone travel, seamless room migration, or full CombatRoom gameplay handoff.

---

## Executive Summary

Current 0.3 travel is split into two very different categories:

1. **Real room join from account shell into TownRoom**
   - Client calls `joinTownRoom(sessionToken, characterId)`.
   - Server validates auth + character ownership.
   - `TownRoom` creates room presence from persisted character/runtime state.

2. **In-room travel inside TownRoom**
   - Same-zone waypoint travel and route travel do **not** switch rooms.
   - They only update the player's authoritative position inside the existing `TownRoom` and persist that position.
   - The client loading overlay is therefore a **same-room state-change overlay**, not a real room-handoff overlay.

Separately, `CombatRoom` already exists as a real Colyseus room and already validates joins, tracks presence, runs movement/combat, and persists leave-state. But there is **no current client transition flow** from `WorldSessionScene` / `TownRoom` into `CombatRoom`.

That means the main 0.4 architectural gap is **not** room implementation. The gap is the **handoff contract** between:

- a live joined room/session,
- persisted character runtime state,
- client transition UI,
- and a future target room/zone join.

The safest first 0.4 implementation path is therefore a **conservative validated leave + join flow**, not seamless migration.

---

## Current 0.3 Room / Session Architecture

## 1. Realtime server room model

Current realtime registration lives in `apps/server/src/realtime/createRealtimeServer.ts`:

- `town` → `TownRoom`
- `combat` → `CombatRoom`

Both are real Colyseus room definitions.

## 2. Shared room join validation

`apps/server/src/realtime/RoomJoinValidationService.ts` is the shared server gate.

It validates:

- allowed room kind: `"town" | "combat"`
- non-empty requested zone id, when present
- character ownership via `CharacterService.getCharacterForUser(characterId, userId)`

On success it returns:

- resolved character
- resolved room kind
- resolved zone id

Important current behavior:

- if no `requestedZoneId` is provided, the service resolves zone from `character.currentZoneId`
- failures are mapped to safe reasons such as:
  - `not_authenticated`
  - `character_not_found`
  - `character_not_owned`
  - `invalid_room_kind`
  - `invalid_zone`
  - `room_unavailable`

## 3. TownRoom today

`apps/server/src/realtime/rooms/TownRoom.ts` is the current main live world room.

Today it owns:

- authoritative player presence
- room-state sync
- movement
- enemy loop
- interactables
- loot pickup
- objective progression/turn-in flow
- vendor requests
- stash requests
- same-room route travel
- same-room waypoint travel
- leave persistence

Important implication:

**TownRoom is currently both the town room and the active playable world loop room.**

## 4. CombatRoom today

`apps/server/src/realtime/rooms/CombatRoom.ts` is already real, not a stub.

Today it owns:

- real join validation through the same shared validation service
- presence tracking
- movement intent handling
- attack handling
- minimal combat simulation tick
- respawn flow
- leave persistence

But it intentionally does **not** yet own:

- objective flow
- loot / XP handoff parity with TownRoom
- vendor / stash / waypoint behavior
- client routing into the room
- transition contract from TownRoom

---

## How the Player Currently Enters the World

## 1. Account shell flow

Current client entry lives in `apps/client/src/game/scenes/AccountShellScene.ts`.

Flow:

1. Client restores:
   - `doomscrolls.sessionToken`
   - `doomscrolls.selectedCharacterId`
2. User clicks **Enter World**.
3. Client creates Colyseus client with `createRealtimeClient()`.
4. Client calls `joinTownRoom(sessionToken, characterId)` from `apps/client/src/net/RealtimeClient.ts`.
5. On success client starts `WorldSessionScene` with:
   - `account`
   - `characterId`
   - `room`

Current shared join payload shape (`packages/shared/src/room/RoomJoinTypes.ts`):

```ts
interface RoomJoinAuthPayload {
  sessionToken: SessionToken;
  characterId: CharacterId;
  requestedRoomKind: "town" | "combat";
  requestedZoneId?: ZoneId;
}
```

Current client only uses the `town` join helper. There is **no client `joinCombatRoom()` helper** yet.

## 2. Server join flow

`TownRoom.onJoin()` currently:

1. normalizes join options
2. validates the session token
3. resolves `userId`
4. validates room kind/zone/character ownership via `RoomJoinValidationService`
5. loads persisted flask state
6. loads persisted objective state
7. builds presence with `buildTownPlayerPresence()`
8. restores town refill state if applicable
9. inserts presence into room state

This is the only real world-entry flow currently wired end to end.

---

## How Location Is Currently Saved and Restored

## 1. Persistence shape

`CharacterRepository.updateCharacterLocation()` persists:

- `lastLocationZoneId`
- `lastLocationX`
- `lastLocationY`
- optionally `currentHp`
- optionally `currentFlaskCharges`

Important current distinction:

- `currentZoneId` exists on the character model and is used during join validation fallback
- but current runtime leave/travel persistence primarily writes **last location**, not a full room-handoff session object

## 2. Restore rules on TownRoom join

`apps/server/src/realtime/rooms/validateCharacterLocation.ts` defines current restoration logic.

`resolvePlayerInitialPosition()` restores a saved location only when:

- saved zone matches the resolved room zone
- saved x/y are inside content bounds for that zone

Otherwise it falls back to the room spawn point.

## 3. TownRoom presence construction

`apps/server/src/realtime/rooms/buildPlayerPresence.ts` currently builds initial presence from:

- resolved zone
- spawn point
- optional persisted location
- persisted HP/flask
- optional persisted objective state

So current reconnect restoration is **room-local runtime reconstruction**, not transfer of an active room session.

## 4. Leave/disconnect persistence

Both `TownRoom.onLeave()` and `CombatRoom.onLeave()` call:

```ts
CharacterService.updateCharacterLocation(
  characterId,
  zoneId,
  x,
  y,
  currentHp,
  currentFlaskCharges,
)
```

This means reconnect currently depends on persisted character state, not on preserving a live room handle or pending transition object.

---

## Current Nightmarket Spawn, Reconnect, and Travel Behavior

## 1. Nightmarket spawn / reconnect

For TownRoom, entry defaults to a Nightmarket spawn definition and may be overridden by last valid persisted in-zone position.

Current behavior:

- if saved location is valid for current zone, restore it
- else use spawn point
- town join may also refill HP/flask through town rest logic

## 2. Same-zone waypoint travel

Current waypoint logic lives in `apps/server/src/realtime/rooms/waypointService.ts` and `TownRoom` message handlers.

Important current behavior:

- `request_waypoint_travel` validates activation/destination
- destination resolves to a spawn point **inside `nightmarket`**
- on success the server updates the player's current in-room x/y
- the server also persists location through `updateCharacterLocation(...)`
- the client shows a travel overlay while waiting for the resulting room-state update

This is **not** a room join.

## 3. Same-zone route travel

Current route travel is similarly same-room.

`resolveRouteTravel()` currently maps route object ids such as gate/return points to another **Nightmarket** spawn position.

It does not:

- leave TownRoom
- join CombatRoom
- create a transition token
- coordinate two live rooms

This means current “to combat edge” route messaging is really **same-room repositioning to a combat-adjacent area**, not true realm/room travel.

---

## Current Loading Overlay / Travel Transition Handling

Client transition UI currently lives in `apps/client/src/game/scenes/WorldSessionScene.ts`.

Current flow:

- `beginTravelOverlay("waypoint")` is shown before sending waypoint travel
- route travel accepted/rejected messages also control the same overlay lifecycle
- overlay hides after next room-state apply or after a 2.5s timeout

Current client states are effectively:

- idle in joined room
- showing temporary travel overlay while waiting for state update
- rejected/timeout

Important limitation:

This overlay currently assumes:

- same room remains connected
- no room leave occurs
- no second room join occurs
- no handoff token or transition state must survive reconnect

So it is a useful UI foundation, but **not yet a cross-room transition model**.

---

## Current Objective Persistence and Active Objective State

Objective persistence is now real, but intentionally narrow.

`apps/server/src/persistence/repositories/ObjectiveRepository.ts` persists per-character objective state:

- `objectiveId`
- `currentProgress`
- `requiredProgress`
- `completed`
- `rewardGranted`

On TownRoom join:

- server scans the notice-board sequence
- restores the first non-reward-granted relevant objective state
- injects it into `PlayerPresence`

Important implication for handoff:

- objective progress is **not** only room memory
- objective state must survive room/zone transitions
- duplicate reward protection depends on DB state, especially `rewardGranted`

For 0.4 handoff planning, objective persistence is already on the “must survive transition” list.

---

## Loot / Inventory / Stash / Vendor Assumptions Tied to Current Room/Session

## 1. Inventory / equipment / money

These are DB-backed and character-backed, not room-backed.

That is good for handoff safety.

They should survive room changes as persisted character state.

## 2. Vendor and stash

Vendor/stash actions are invoked from TownRoom message handlers, but their authoritative outcomes are persistence-backed.

Important consequence:

- vendor/stash UI panels are **scene/session-local client UI state**
- item/currency/storage results are **server/database state**

For handoff:

- open vendor/stash UI should not survive cross-room transition as “active room state”
- persisted item/currency/stash results must survive

## 3. World loot / enemy / room-local runtime state

These are room-owned runtime state.

They should **not** be assumed to survive arbitrary room handoff unless explicitly persisted later.

That includes current room-local state such as:

- active synced enemies
- world loot on ground
- pending move/combat intents
- transient feedback / telegraphs
- open interactable panels

---

## Existing CombatRoom Placeholder / Route / Type / Schema / Client Navigation Code

## Already present today

- `CombatRoom` class exists
- `combat` room name is registered
- shared join validation supports `requestedRoomKind: "combat"`
- room state / presence / simulation exist server-side

## Missing today

- no client `joinCombatRoom()` helper
- no client-side route from `WorldSessionScene` into `CombatRoom`
- no transition coordinator
- no server-issued transition payload/token
- no reconnect logic for “transition in progress”
- no duplicate-request protection for room handoff

This confirms the smallest safe 0.4 task is **handoff foundation**, not full gameplay implementation.

---

## What Data Must Survive a Future Room / Zone Transition

Minimum must-survive set:

### Character runtime state

- `characterId`
- authenticated user/session identity
- HP
- flask charges/cooldowns baseline as needed
- authoritative zone/location target for spawn/arrival

### Character progression / persistence state

- XP / level
- money
- inventory
- equipment
- stash contents

### Objective state

- active objective id
- progress
- completed flag
- reward-granted flag

### World progression state

- discovered waypoints
- current selected character

### Transition control state

- source room kind / zone
- target room kind / zone
- arrival spawn key or validated coordinates
- transition reason
- status of in-flight handoff

### What should not survive as active state

- open vendor panel
- open stash panel
- transient feedback notices
- pending local overlay timers
- room-local world loot references
- enemy telegraph / chase state from the source room
- deferred action queue from the source room

---

## Server Authority Rules for a Future Handoff

## Client is allowed to request

The client should only be allowed to request intent such as:

- target room kind
- target zone id
- target spawn key / route id / waypoint id / transition object id
- transition reason/context
- selected character id (already authenticated session-scoped)

The client must **not** be allowed to declare:

- that transition succeeded
- final spawn coordinates without server validation
- room access authorization
- destination validity
- carry-over of room-local runtime entities

## Server must validate

At minimum:

- authenticated session
- character ownership
- source room consistency, if required by the flow
- transition target validity
- target room kind validity
- target zone validity
- waypoint/route/unlock prerequisites
- alive/downed restrictions if design requires them
- duplicate/in-flight transition protection
- reconnect behavior if transition is interrupted

---

## Proposed Minimal Handoff State Model

Smallest safe client/server conceptual state machine:

```text
inWorld
transitioning
joiningTarget
spawned
failed
```

### 1. `inWorld`

- player is connected to a joined room
- normal gameplay/UI active

### 2. `transitioning`

- server accepted a transition request
- source room is freezing this player's transition-relevant behavior
- client shows blocking loading/transition overlay
- duplicate transition requests should be rejected safely

### 3. `joiningTarget`

- source room leave is in progress or completed
- client is attempting target room join using server-approved data
- no gameplay UI should claim success yet

### 4. `spawned`

- target room join succeeded
- first valid target room state is applied
- loading overlay may clear

### 5. `failed`

- target validation failed or target join failed
- client shows safe failure feedback
- system either:
  - returns to previous stable scene/room state, or
  - returns to account shell, depending on failure stage

---

## Proposed Minimal Handoff Payload Shape

Smallest safe 0.4 handoff payload recommendation:

```ts
interface WorldRoomHandoffPayload {
  characterId: CharacterId;
  sourceRoomKind: "town" | "combat";
  sourceZoneId: ZoneId;
  targetRoomKind: "town" | "combat";
  targetZoneId: ZoneId;
  targetSpawnKey?: string;
  targetX?: number;
  targetY?: number;
  reason:
    | "route_travel"
    | "waypoint_travel"
    | "zone_transition"
    | "respawn"
    | "reconnect_resume";
}
```

Notes:

- prefer `targetSpawnKey` over raw coordinates when possible
- `targetX` / `targetY` should be optional and server-produced only after validation
- client should never invent raw arrival coordinates

Recommended principle:

> The client requests a destination identifier. The server resolves the real arrival point.

---

## Failure Handling Requirements

## 1. Failed join

Case:

- target room join fails after source transition started

Minimum safe behavior:

- client enters `failed`
- safe user-facing message
- no fake “entered world” success
- preferred first implementation should recover by returning to a stable scene rather than attempting seamless rollback magic

## 2. Invalid target

Case:

- requested room/zone/spawn is invalid

Behavior:

- reject before leaving stable source state if possible
- keep player in `inWorld`
- show safe rejection reason

## 3. Stale waypoint / route

Case:

- client requests a destination that is no longer valid/unlocked

Behavior:

- reject server-side
- remain in source room
- no room handoff begins

## 4. Reconnect during transition

Case:

- disconnect/refresh happens after transition approval but before target spawn completes

Current codebase has no transition persistence model for this.

Smallest safe 0.4 recommendation:

- do **not** attempt fully seamless reconnect-mid-handoff first
- instead ensure reconnect resumes from **persisted stable character state**
- only add mid-transition resume after a dedicated follow-up task

## 5. Duplicate transition request

Case:

- client clicks twice or resends while loading overlay is active

Behavior:

- server must reject duplicates while state is `transitioning` or `joiningTarget`
- client should keep existing blocking overlay rather than starting a second flow

---

## Recommended First Implementation Task After This Investigation

## Smallest safe next task

**Implement a conservative server-authoritative cross-room handoff foundation for one path only:**

```text
TownRoom (Nightmarket route/gate)
→ validated leave
→ CombatRoom join
→ spawn at one server-resolved combat entry point
```

### Why this is the safest next step

- it uses already-existing real `CombatRoom`
- it avoids broad room/session refactors
- it keeps the current 0.3 same-zone waypoint flow intact
- it proves the handoff contract on one narrow route
- it forces explicit handling of join failure, loading state, and reconnect boundaries

### Recommended scope for that next task

1. add a dedicated shared handoff contract/type
2. add a client `joinCombatRoom()` helper
3. implement one server-approved route transition from TownRoom to CombatRoom
4. add explicit client transition states around leave/join
5. keep fallback behavior conservative on failure

### Explicitly defer in that first implementation

- seamless migration between arbitrary rooms
- multiple transition sources
- general realm graph
- reconnect-mid-transition resume
- cross-room preservation of room-local enemy/loot state
- full cross-zone waypoint travel network

---

## Recommended Implementation Shape

The first real handoff should use:

```text
validated request
→ server resolves destination
→ client enters transitioning overlay
→ source room leaves cleanly
→ client joins target room with approved payload
→ target room reconstructs runtime state from DB + approved destination
→ client clears overlay only after first valid target state
```

This is preferable to attempting opaque room migration because it aligns with the current architecture:

- join validation already exists
- leave persistence already exists
- target room reconstruction already exists
- client already understands scene/overlay state changes

---

## Final Conclusion

Current 0.3 already has:

- real TownRoom join
- real CombatRoom join capability
- real persistence for location/HP/flask
- real objective persistence
- real vendor/stash/inventory persistence boundaries

What it does **not** yet have is the **handoff contract** between rooms.

Therefore the smallest safe Core 0.4 path is:

1. formalize handoff states and payload
2. implement one conservative TownRoom → CombatRoom validated handoff
3. preserve current same-zone travel unchanged
4. treat reconnect-during-transition as a later follow-up, not part of the first handoff slice

That approach is the lowest-risk way to evolve from the current 0.3 same-room travel model into real room/realm progression.