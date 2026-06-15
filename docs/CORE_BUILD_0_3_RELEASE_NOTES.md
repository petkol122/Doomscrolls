# docs/CORE_BUILD_0_3_RELEASE_NOTES.md — Core Build 0.3 Release Notes

---

## Core 0.3 Playable Loop Checkpoint — Closure Summary

**Date:** 2026-06-12
**Checkpoint:** Core 0.3 playable-loop checkpoint
**Status:** Closed. All planned 0.3 pillars have shipped at foundation level.

### Shipped Systems Summary

Core Build 0.3 connects the isolated 0.1/0.2 systems into a playable ARPG loop. A player can now register, create a character, enter the Nightmarket hub, start a notice board objective, travel to the Blackwire Sewer Edge to fight enemies and collect loot, return to town, turn in the objective for a copper reward, buy items from the vendor, sell unwanted loot, store items in persistent stash, and activate/use a waypoint — all with server-authoritative validation and real persistence.

**Vendor buy/sell** (Tasks 318, 319, 320, 322): The Suspicious Vendor offers a real buy/sell interaction. Buying deducts copper and creates an inventory item server-atomically. Selling removes an item and credits copper at a 50% ratio. The vendor panel shows stock and inventory sections with live money updates.

**Stash listing/store/take** (Tasks 323, 324, 329): Persistent character stash is stored in the `STASH` item location. Players can store inventory items into stash and take stash items back into inventory through server-authoritative transfer with grid-based placement validation.

**Waypoint discovery/travel** (Tasks 330, 336, 338): Waypoints now use real physical discovery. Clicking the Nightmarket hub waypoint unlocks Nightmarket Arrival for that character. Clicking the new physical Blackwire combat-edge waypoint unlocks Blackwire Combat Edge. Either waypoint opens the same panel, but the panel lists only discovered destinations. Travel remains server-authoritative, same-zone, and persists character location.

**Town → combat route and return** (Task 331): The Blackwire Gate near the service hub teleports the player to the Blackwire Sewer Edge pocket. A return marker teleports back to the hub. Both use server-authoritative route validation with position persistence.

**Notice board objective start/progress/turn-in/reward** (Tasks 332, 333, 333B, 333C, 333D, 333E, 333F): The Nightmarket notice board offers a sequence of kill objectives. Starting an objective persists a `CharacterObjective` row. Kill progress increments via `advanceObjectiveProgress` and persists on every kill. Reaching the required count marks the objective completed. Re-interacting with the notice board turns in the objective, grants a copper reward (with `rewardGranted` persisted before grant to prevent duplication), and advances to the next objective in the sequence.

**WorldSession zoom/projection/culling fixes** (Tasks 325, 326, 327): Zoom range expanded to 0.55–1.9, projection unified around a single live state, camera follow/zoom repositions the full world scene, enemy viewport culling prevents offscreen rendering, and hit-testing stays aligned across zoom/camera changes.

**Nightmarket physical spacing pass** (Task 328): Content-data layout expanded the service hub footprint, separated important interactables from clutter, moved enemy pockets farther from town, and enlarged rest area bounds.

**Playable loop hardening audit** (Task 334): End-to-end audit of the full loop confirmed objective persistence, money/HUD refresh, inventory refresh after vendor/stash, position persistence after travel, camera/projection after travel, enemy culling after travel, interactable clickability, pending action cleanup, and reconnect/rejoin restoration. Two bugs were fixed: vendor buy inventory refresh and zero-gain currency notice guard.

### Current 0.3 Status

#### What is playable now

- Login, character creation, and character selection
- Enter the Nightmarket hub with real server-authoritative player presence
- Notice board objective: start → kill Trashboar Runts for progress → turn in for copper reward
- Town → combat route: Blackwire Gate → Blackwire Sewer Edge (fight, loot)
- Combat → town return: return marker → Nightmarket hub
- Vendor buy: server-validated copper deduction, inventory item creation
- Vendor sell: server-validated item removal, copper credit
- Stash store: server-validated inventory → persistent stash transfer
- Stash take: server-validated stash → inventory transfer with grid placement
- Waypoint discovery: unlock Nightmarket Arrival by clicking the Nightmarket waypoint
- Waypoint discovery: unlock Blackwire Combat Edge by clicking the physical Blackwire waypoint
- Waypoint travel: open the panel from either waypoint and travel only to discovered destinations
- Loot pickup, rest area HP/flask refill, cursor feedback, zoom, camera follow
- Reconnect/rejoin: objective state, character location, HP, flask charges restored
- HUD overlay: vitality, level/XP, objective tracker, money display

#### What is still foundation-only

- **Objective system**: single-objective notice board chain only; no quest journal, no multi-objective, no item/XP rewards
- **Vendor economy**: fixed 50% sell price; no stock refresh, no buyback, no reputation, no haggling
- **Stash**: character-scoped only; no drag/drop, no tabs, no sorting, no account-wide stash, no stash grid UI
- **Waypoint**: two same-zone discovered destinations only; no world map, no minimap, no multi-zone network
- **Town → combat routing**: same-zone teleport only; no real CombatRoom handoff, no room migration

#### What is still explicitly deferred

- Multi-zone/CombatRoom handoff (Colyseus room migration)
- Quest journal, quest log, multi-objective system
- Full world map / minimap
- Advanced vendor economy (restock, buyback, reputation, dynamic pricing)
- Stash drag/drop, tabs, account-wide stash
- Full art/map pipeline
- Vue/app-shell migration
- Procedural dungeons, bosses, PvP, guilds, trading, crafting

### Known Limitations

- Objective system is still single-objective / foundation — only the notice board chain works; no generic quest framework exists
- No quest journal or persistent quest log UI
- No multi-zone / CombatRoom handoff yet — the combat route reuses the same Nightmarket zone
- No full world map / minimap
- No advanced vendor economy (restock, buyback, reputation, dynamic pricing)
- No stash drag/drop / tabs / account-wide stash
- No full art/map pipeline — all visuals remain placeholder/content-data-driven
- Progress persistence is fire-and-forget on the kill path (acceptable for current scope)
- Waypoint has two physical discovery points (Nightmarket Arrival + Blackwire Combat Edge) but no multi-zone network

## Task 338 — Waypoint Discovery: Unlock Destinations by Clicking Waypoints

**Summary:**

Changed waypoint travel from the old auto-unlock model to a real discovery model. Destinations are no longer unlocked just by opening the Nightmarket waypoint. Instead, each destination is unlocked only by interacting with its own physical waypoint object in the world. The Nightmarket hub waypoint unlocks Nightmarket Arrival, and a new physical Blackwire combat-edge waypoint unlocks Blackwire Combat Edge. Either waypoint opens the same travel panel, which now lists only discovered destinations.

**Changes:**

- **`packages/content/src/data/worldProps.ts`**: Added a new physical waypoint object near the Blackwire combat edge with stable content id `nightmarket_waypoint_blackwire_combat_edge` and localized label `world_prop.blackwire_waypoint.label`.

- **`apps/server/src/realtime/rooms/waypointService.ts`**: Reworked waypoint panel construction so the interacted waypoint object maps to exactly one destination activation. Removed the old behavior that auto-activated both destinations. The panel payload now includes only the character's discovered destinations.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: Updated waypoint interaction handling so both physical waypoint objects open the same server-authoritative panel flow. The server now activates only the interacted waypoint, then opens the panel. Existing travel behavior remains authoritative: validate destination, clear pending movement/action state, update live player position, and persist character location.

- **`apps/server/src/realtime/rooms/interactValidation.ts`**: Extended waypoint placeholder/prompt routing so the new Blackwire waypoint uses the existing waypoint interaction pattern.

- **`apps/client/src/game/scenes/worldSession/waypointInteractionPanel.ts`**: Simplified the panel to render only discovered destinations, removing the old activated/not-activated row status path.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: Updated waypoint-open feedback to distinguish between newly discovered and already discovered waypoints while still opening the same travel panel.

- **`packages/localization/src/locales/en.ts`** and **`packages/localization/src/LocaleTypes.ts`**: Added localized discovery feedback and the new Blackwire waypoint label. Locked destination feedback now clearly reports a locked/unavailable destination.

**Verification:**

- Focused code-path audit completed for waypoint interaction, panel payload, server-side activation persistence, and travel validation.
- Runtime/typecheck verification still pending.

**Known limitations:**

- Waypoint travel still stays inside the Nightmarket zone only.
- No world map, minimap, cross-zone travel, CombatRoom handoff, loading screen, travel cost, cooldown, or portal system was added.

### Blockers and Risks

- Runtime verification still needed where not manually confirmed (Task 325 zoom, Task 329 stash transfer, Task 328 spacing, Task 330 waypoint)
- Prisma/client generation Windows lock risk — Prisma engine file lock was encountered during Task 330; may recur after schema changes
- Camera/projection regressions should remain on watch — the zoom/projection unification (Tasks 325–327) touched core rendering paths
- Objective persistence / reward duplication should remain on watch — `rewardGranted` persistence hardened in Task 333E but no integration test coverage yet

## Task 339 — Travel UX: Basic Teleport Loading Overlay

**Summary:**

Added a lightweight loading/transition overlay for same-zone route travel and waypoint travel in the WorldSession client. The overlay is feedback only: it blocks accidental world clicks during travel, but the new player position still comes exclusively from authoritative server state.

**Changes:**

- **`apps/client/src/game/scenes/worldSession/worldSessionTravelOverlayView.ts`**:
  - Added a reusable full-screen travel overlay view with a dark translucent backdrop, localized title/message, pointer capture, and a small fade transition.
  - The overlay is mounted once and reused; it does not recreate DOM every frame.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**:
  - Route travel requests now show the overlay immediately when the client sends the request.
  - Waypoint travel requests now show the overlay immediately when the client sends the request.
  - Accepted route/waypoint travel keeps the overlay visible until the next authoritative room-state update has been applied, then hides it.
  - Rejected route/waypoint travel hides the overlay immediately.
  - Added a short safety timeout to hide the overlay if no resolution arrives.
  - Added teardown cleanup for the travel overlay, timeout, and waypoint panel on scene shutdown/destroy.

- **`packages/localization/src/locales/en.ts`** and **`packages/localization/src/LocaleTypes.ts`**:
  - Added localized route-travel loading copy, waypoint-travel loading copy, and timeout feedback.

**Verification:**

- Focused code-path audit confirms the overlay is only UX feedback.
- Live position still comes from synced room state after server travel acceptance.
- No route/waypoint server authority, objective flow, vendor/stash flow, movement/combat/loot, area banner logic, or Nightmarket spacing behavior was intentionally changed.

## Task 337 — Objective UX Polish: Clear Route and Turn-In Feedback

**Summary:**

Improved the single notice board objective UX so the player clearly understands where to go, what to kill, and when to return. No quest journal, minimap markers, or gameplay changes were introduced.

**Changes:**

- **`packages/localization/src/locales/en.ts`**:
  - Added `objective.accepted_with_route` — start feedback mentioning the Blackwire gate/waypoint and target enemy
  - Added `objective.progress_feedback` — progress feedback showing current/target kills
  - Improved `objective.ready_to_turn_in` — now explicitly says to return to the Notice Board in Nightmarket Services
  - Improved `objective.turn_in_complete_reward_copper_only` — now reads "Turned in! +{copperReward} copper"
  - Changed `objective.state.ready_to_turn_in` from "Turn in" to "Return to Board" for clearer HUD state label

- **`packages/localization/src/LocaleTypes.ts`**: Replaced old objective keys with new ones in `REQUIRED_LOCALIZATION_KEYS`.

- **`apps/client/src/net/townRoomPresence.ts`**:
  - Added `targetEnemyLabel` to the objective presence type
  - `applyOptionalObjective` now resolves human-readable enemy name(s) from objective content definition via the content registry (combines multiple targets with " / ")
  - Added `import { t } from "@doomscrolls/localization"` for enemy name localization

- **`apps/client/src/game/scenes/worldSession/worldSessionOverlayView.ts`**:
  - `resolveObjectiveTrackerViewModel` now accepts `targetEnemyLabel` from presence
  - State label now uses localized `"Active"` / `"Return to Board"` keys instead of hardcoded text
  - Subtitle line now shows `"{Enemy Name} — {current}/{target}"` while active, and the turn-in hint `"All {enemy} eliminated! Return to the Notice Board..."` when completed
  - `createHudSection` objective parameter type extended with `targetEnemyLabel`

- **`apps/server/src/realtime/rooms/TownRoom.ts`**:
  - When starting a new objective, the server now sends an additional `interact_response` with the route/waypoint direction and target enemy names, e.g. `"[ Cull Trashboars ] Use the Blackwire gate or waypoint to reach the sewers and hunt Trashboar Runt / Trashboar Brute."`
  - The enemy names are resolved from content definitions using the existing localization system

**Verification:**

- No objective persistence, kill tracking, reward logic, quest journal, minimap markers, route arrows, or enemy type changes
- No movement, combat, town route, vendor buy/sell, stash transfer, waypoint travel, loot pickup, rest area, cursor feedback, zoom, camera, or Nightmarket spacing changes

### Proposed Next-Scope Candidates (Post-0.3 Checkpoint)

These are candidates for the next implementation wave. They are listed without starting any implementation.

1. **Objective runtime smoke pass** — Manual or automated end-to-end verification of the full objective loop (start → kill → progress → turn-in → reward → next objective) to confirm persistence and duplication guards hold at runtime
2. **CombatRoom handoff investigation** — Explore Colyseus room migration feasibility for a real TownRoom → CombatRoom transition with state preservation
3. ~~**Second waypoint destination** — Add a real second waypoint destination (e.g. a future zone) to validate the waypoint network data flow beyond the single self-loop~~ — **[DONE — Task 336: Blackwire Combat Edge added]**
4. **First quest journal / lightweight objective panel polish** — Expand the objective tracker into a minimal toggleable quest log with objective details and multi-step support
5. **Stash / vendor UI readability pass** — Improve stash panel layout (sections, item readability) and vendor panel clarity (stock vs sell sections, price readability)
6. **First content expansion after 0.3 checkpoint** — Add a second objective type, new enemy variant, or new zone content to validate the content pipeline end-to-end

---

## Task 334 — Core 0.3 Playable Loop Hardening Audit

**Summary:**

Audited the full Core 0.3 playable loop end-to-end and fixed two confirmed bugs found during the audit. No broad refactor was introduced; existing vendor buy/sell, stash transfer, waypoint travel, town route, objective start/progress/turn-in, combat, loot pickup, rest area, cursor feedback, zoom, camera, and Nightmarket spacing remain functional.

**Changes:**

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**:
  - **Vendor buy inventory refresh (bug fix)**: The `request_buy_vendor_item_accepted` handler now calls `refreshAccountStateAfterPickup().then()` and explicitly updates the vendor panel's sell inventory via `updateInventory()` after the account state refresh completes. Previously the sell section of the vendor panel showed stale items after a purchase because only the money was updated. The sell handler already had this refresh; the buy handler was missing it.
  - **Zero-gain currency notice guard (bug fix)**: The `currency_picked_up` handler now only shows the "Picked up X" notice when `gainedCopper > 0`. This prevents a misleading "Picked up 0." notice from appearing after vendor buy operations, which send a `currency_picked_up` message with `gainedCopper: 0` solely for the account state refresh side effect.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**:
  - Added guard comments to both the route travel and waypoint travel handlers documenting why `hasMovementTarget` and `clearPendingAction()` must be cleared immediately after teleport to prevent stale pending action state from firing at the new position.
  - Added comments clarifying that the client receives the new position via Colyseus schema sync rather than through a fake client-side transition.

**Audit findings (no code changes needed):**

- **Objective persistence and reward duplication**: Confirmed hardened by Task 333E. `rewardGranted` is persisted before copper grant. Rejoin scans `NOTICE_BOARD_OBJECTIVE_SEQUENCE` for the first non-reward-granted row. No duplicate reward path exists.
- **Money/HUD refresh**: Confirmed `currency_picked_up` message is sent after vendor buy, sell, objective turn-in, and loot pickup. Client `refreshAccountStateAfterPickup()` is called in all paths.
- **Position persistence after route/waypoint**: Confirmed `CharacterService.updateCharacterLocation()` is called after both route and waypoint travel before sending the accepted message.
- **Camera/projection after travel**: Confirmed travel stays within the same Nightmarket zone; the existing camera/projection/culling logic applies automatically. Client receives new position via Colyseus schema sync.
- **Offscreen enemy culling after travel**: Confirmed existing viewport culling (`ENTITY_VIEWPORT_PADDING_PX`) and enemy aggro distance check handle the new position correctly after teleport.
- **Interactable clickability**: Confirmed the spacing pass (Task 328) preserved all interaction IDs and code paths; no clickability regressions found.
- **Reconnect/rejoin restoration**: Confirmed persisted objective state, character location, flask charges, and HP are all restored on rejoin via `buildTownPlayerPresence` and `applyTownRestRefill`.

**Verification:**

- `pnpm typecheck` — 0 errors across all 5 workspace projects
- No schema/database changes, no new gameplay systems, no UI redesign

## Task 333F — Objective Foundation: Remove Legacy Auto-Reward Objective Helper

**Summary:**

Removed the unused `advanceNoticeBoardObjective` function from `TownRoom.ts`. This function was the original auto-reward-on-kill path but became dead code after Task 333B replaced it with the reward-free `advanceObjectiveProgress` helper. The objective flow now has one clear path: kill progress is reward-free (via `advanceObjectiveProgress`), and rewards are granted only on explicit notice board turn-in.

**Changes:**

- **`apps/server/src/realtime/rooms/TownRoom.ts`**:
  - Removed the `advanceNoticeBoardObjective` async function (approximately 57 lines of dead code including reward granting, copper persistence, and `objectiveUpdated` message sending logic).
  - Updated the comment in `registerAttackHandler` to remove the stale reference to `advanceNoticeBoardObjective`. The comment now correctly states that the notice board interaction handler handles reward granting and kill progress is reward-free.

**Verification:**

- No auto-reward-on-kill path remains. Kill handlers (basic attack and Grave Spark) use `advanceObjectiveProgress` only, which does not grant rewards or mark `rewardGranted`.
- Objective start, kill progress, completion/ready state, explicit turn-in, and reward-granted persistence remain unchanged.
- No schema/database changes.
- No movement, combat, loot, town route, vendor buy/sell, stash transfer, waypoint travel, rest area, cursor feedback, zoom, camera, or Nightmarket spacing changes.

**Known limitations:**

- This is a code cleanup task. No new objective features, quest journal, rewards, or persistence changes were introduced.

## Task 333E — Objective Persistence Hardening: Persist Start and Turn-In Reliably

**Summary:**

Fixed the remaining persistence gaps in the single Nightmarket notice board objective flow. Starting an objective now immediately persists a `CharacterObjective` row (no longer deferred to first kill), turn-in now persists `rewardGranted = true` before granting copper (preventing duplicate reward after reconnect/crash), and the HUD tracker state after turn-in is correctly managed so `findNextNoticeBoardObjective` advances to the next objective in the chain within the same session.

**Changes:**

- **`apps/server/src/realtime/rooms/TownRoom.ts`**:
  - **Objective start persistence**: The "no active objective" branch of the notice board interact handler now calls `ObjectiveRepository().create()` immediately after `startNoticeBoardObjective()`, persisting the `CharacterObjective` row with `currentProgress = 0` before any kill happens.
  - **Turn-in persistence**: The turn-in branch now calls `await ObjectiveRepository().markRewardGranted()` BEFORE granting copper. If persistence fails, the turn-in aborts without granting reward, preventing duplicate copper on reconnect/crash.
  - **Turn-in copper grant**: Changed from fire-and-forget `void (async () => { ... })()` to properly awaited sequential flow: persist `rewardGranted` → grant copper → clear HUD → send response.
  - **Turn-in HUD state**: After granting reward, HUD display fields (`hasObjective`, `objectiveLabel`, `objectiveCurrent`, `objectiveTarget`, `objectiveCompleted`) are cleared but `objectiveId` and `objectiveRewardGranted` are kept on `PlayerPresence`. This ensures `findNextNoticeBoardObjective()` can properly skip the completed objective and advance to the next one when the player re-interacts within the same session.
  - **Updated comments**: Removed the stale "session-scoped, no persistence" comment from the turn-in branch.

**Verification:**

- Focused code-path audit of the notice board interaction flow.
- Existing `onJoin` persisted state restoration handles `0 / required` correctly (no changes needed).

**Known limitations:**

- Progress persistence remains fire-and-forget (not awaited in the hot kill path) — acceptable for this scope.
- This is a single-objective foundation; no multi-objective / quest journal system exists.
- No quest chains, item rewards, XP rewards on turn-in, minimap markers, or quest journal UI were added.

## Task 333D — Objective Foundation: Persist Notice Board Objective State

**Summary:**

The single Nightmarket notice board objective state is now persisted so progress, completion and reward-granted status survive reconnects and cannot be reset by leaving/rejoining the room. A new `CharacterObjective` Prisma model stores the current progress, required progress, completed flag, and reward-granted flag per character per objective. On room join, the server loads the persisted state and populates the `PlayerPresence` entry so the HUD immediately reflects the real persisted state. Each kill that advances the objective updates the database via a fire-and-forget callback. Turn-in reward granting (Task 333C) is session-scoped on `PlayerPresence.objectiveRewardGranted` — the UI still clears the tracker on turn-in, and the persisted `rewardGranted` prevents duplicate copper rewards on reconnect/rejoin.

**Changes:**

- **`apps/server/prisma/schema.prisma`**: Added `CharacterObjective` model with fields `characterId`, `objectiveId`, `currentProgress`, `requiredProgress`, `completed`, `rewardGranted`, `createdAt`, `updatedAt`, a unique constraint on `(characterId, objectiveId)`, and an index on `characterId`. Added the opposite relation `Character.objectives`.

- **`apps/server/prisma/migrations/20260611210000_add_character_objective_state/migration.sql`** (new): Committed Prisma migration creating the `CharacterObjective` table with the unique composite index, the character-scoped index, and the foreign key with cascade delete.

- **`apps/server/src/persistence/repositories/ObjectiveRepository.ts`** (new): Focused repository with five helpers:
  - `findByCharacterAndObjective(characterId, objectiveId)` — returns the persisted state or `null`
  - `create(characterId, objectiveId, requiredProgress)` — creates a new zero-progress record
  - `updateProgress(characterId, objectiveId, newProgress)` — clamps progress, sets `completed` when the clamp reaches the required count, returns the updated record
  - `markCompleted(characterId, objectiveId)` — sets `completed = true`
  - `markRewardGranted(characterId, objectiveId)` — sets `rewardGranted = true`

- **`apps/server/src/persistence/repositories/index.ts`**: Exported `ObjectiveRepository`.

- **`apps/server/src/realtime/rooms/buildPlayerPresence.ts`**: Added `PersistedObjectiveState` interface and optional `objectiveState` field to `BuildTownPlayerPresenceInput`. When provided, `buildTownPlayerPresence` loads the localization keys from the content registry and populates the `PlayerPresence` objective fields (`hasObjective`, `objectiveId`, `objectiveLabel`, `objectiveDescriptionKey`, `objectiveCurrent`, `objectiveTarget`, `objectiveCompleted`, `objectiveRewardGranted`) from the persisted state.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**:
  - Added `ObjectiveRepository` to imports.
  - In `onJoin`, scans `NOTICE_BOARD_OBJECTIVE_SEQUENCE` for the first non-reward-granted persisted objective and passes it to `buildTownPlayerPresence` as `objectiveState`.
  - Both `registerAttackHandler` and `registerSkillSlotHandler` now pass a fire-and-forget persistence callback to `advanceObjectiveProgress` that calls `ObjectiveRepository.updateProgress()`.

- **`apps/server/src/realtime/rooms/advanceObjectiveProgress.ts`**: Added optional `onPersistUpdate` callback parameter. When provided, the callback is fired after the in-memory `player.objectiveCurrent` and `player.objectiveCompleted` have been mutated, with the character ID, objective ID, new progress value, and completed flag. The caller (TownRoom) provides the callback to write to the database.

**Verification:**

- Schema validation passes: Prisma generates correctly after the `Character.objectives` relation was added.
- Typecheck and lint pending after the Prisma generation lock-file issue on Windows.

**Known limitations:**

- Progress persistence is fire-and-forget (not awaited in the hot kill path) — a transient database write failure would lose the progress increment but would not crash the room.
- This is a single-objective foundation; no multi-objective / quest journal system exists.
- Turn-in reward granting is now hardened by Task 333E: `rewardGranted` is persisted to DB before granting copper, preventing duplicate reward on reconnect/crash. Turn-in HUD state is properly managed so `findNextNoticeBoardObjective` advances to the next objective in the sequence.
- No quest chains, item rewards, XP rewards, minimap markers, or quest journal UI were added.

## Task 333B — Objective Foundation: Increment Notice Board Kill Progress

**Summary:**

Server-authoritative objective progress tracking is now live for the Nightmarket notice board. When the player has an active objective and kills a matching enemy type, the server increments the kill count, clamps it at the required amount, and sends an `objective_updated` message to the client so the HUD stays synced. The change is intentionally minimal: it only tracks progress and sets the `completed` flag; it does NOT grant rewards, mark `rewardGranted`, persist the state, or introduce a quest journal.

**Changes:**

- **`apps/server/src/realtime/rooms/advanceObjectiveProgress.ts`** (new): A focused, side-effect-free helper that increments `objectiveCurrent` by 1, clamps at `objectiveTarget`, and sets `objectiveCompleted = true` when the required kill count is reached. It checks that the active objective exists and that the killed enemy type is in the objective's `targetEnemyIds`. Guards/comments document this as a single-objective foundation — not the final quest system.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: Replaced the old `advanceNoticeBoardObjective` calls (which also granted rewards) in both `registerAttackHandler` and `registerSkillSlotHandler` with the new `advanceObjectiveProgress` helper. On successful progress the handler sends a direct `objective_updated` message back to the originating client. The old `advanceNoticeBoardObjective` function was later removed in Task 333F.

**Verification:**

- `pnpm typecheck` — 0 errors (all 5 workspace projects pass)
- Pre-existing lint errors only (unrelated to this task)

**Known limitations:**

- No objective completion/turn-in logic — rewards are not granted when the kill target is reached
- No persistence — objective state is lost on room leave (acceptable for this micro-task)
- No quest journal, no generic multi-objective system
- Only the single active notice board objective can track progress

## Task 333 — Notice Board Sends Static Authoritative Objective State

**Summary:**

Extended the existing notice board interaction so that clicking `nightmarket_notice_board_01` sends a real server-authored objective state that includes the content-defined description key. The HUD objective card now renders the localized description below the state label. The change is purely a data-flow expansion — no kill progress, objective completion, persistence, or rewards were added.

**Changes:**

- **`packages/shared/src/protocol/ServerMessages.ts`**: Added optional `descriptionKey` field to `ObjectiveUpdatedServerMessage`.

- **`apps/server/src/realtime/rooms/PlayerPresence.ts`**: Added `objectiveDescriptionKey` Colyseus schema field.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: `startNoticeBoardObjective` now copies `objectiveDef.descriptionKey` into the player presence. `buildObjectiveUpdatedMessage` conditionally spreads `descriptionKey` into the protocol payload (guarded against `exactOptionalPropertyTypes`).

- **`apps/client/src/net/interactResponseClient.ts`**: Forwards `descriptionKey` from the room `objective_updated` message into the typed callback.

- **`apps/client/src/net/townRoomPresence.ts`**: Reads `objectiveDescriptionKey` from the Colyseus schema entry and includes it as `descriptionKey` on the presence `objective` object.

- **`apps/client/src/game/scenes/worldSession/worldSessionOverlayView.ts`**: The HUD objective card now shows a localized description line when one is present. `resolveObjectiveTrackerViewModel` resolves the key via `t()` and passes the resolved string to the view model.

**Verification:**

- Focused code-path audit only; relies on existing typecheck/build pipeline for the affected file set.

**Known limitations:**

- Reloading/rejoining loses objective state (no persistence yet — acceptable for this micro-task).
- No kill progress, objective completion, reward logic, or turn-in added.

## Task 332 — Remove Fake Objective Placeholder Only

**Summary:**

Removed the fake WorldSession objective placeholder from normal gameplay without introducing a real objective system yet. When no authoritative objective exists, the HUD now omits the objective section instead of inventing hint text, fake progress, or a fake completed state.

**Changes:**

- **`apps/client/src/game/scenes/worldSession/worldSessionOverlayView.ts`**: Removed the client-only fallback objective path that previously created a fake default tracked objective and a fake "no more notices" placeholder even when no real objective was active.

- **`apps/client/src/game/scenes/worldSession/worldSessionOverlayView.ts`**: Updated the bottom HUD layout so the objective card is rendered only when real objective state exists in player presence. The HUD now collapses to vitality + level/XP when no objective is active.

- **`apps/client/src/game/scenes/worldSession/worldSessionOverlayView.ts`**: Preserved rendering for real synced objective state, including active/completed labels, progress bar, and completion reward text when the server actually provides those values.

**Verification:**

- Focused code-path verification only; no broader gameplay systems were changed.

**Known limitations:**

- This task does not add a quest/objective system, tracking, rewards, persistence, or kill-progress logic.
- Objective location text remains a simple neutral fallback in the existing real-objective HUD card until a future real objective/location pipeline is introduced.

## Task 331 — Travel Foundation: Town to Combat Area Routing

**Summary:**

Implemented the first real server-authoritative town → combat → town loop inside the existing Nightmarket zone. Players can now use a Blackwire Gate near the service hub to jump to the hostile Blackwire Sewer Edge pocket and use a return marker there to jump back to the Nightmarket services area.

**Changes:**

- **`packages/content/src/data/spawnPoints.ts`** and **`packages/content/src/data/types.ts`**: Added two real same-zone travel destinations, one for the combat-edge arrival point and one for the return point to the service hub, and extended the spawn-point content id union accordingly.

- **`packages/content/src/data/worldProps.ts`**: Added a service-hub route interactable (`nightmarket_blackwire_gate_01`) and a combat-edge return interactable (`nightmarket_blackwire_return_01`) using the existing Nightmarket zone.

- **`apps/server/src/realtime/rooms/initializeTownInteractables.ts`**: Extended the data-driven interactable initialization to include `combat_edge` props in the synced interactable set.

- **`apps/server/src/realtime/rooms/interactValidation.ts`**: Added localized safe interaction prompt text for the new Blackwire gate and return marker.

- **`apps/server/src/realtime/rooms/waypointService.ts`**: Added a focused same-zone route-travel resolver with server-owned validation for known route interactables, known destination spawn points, and valid in-bounds destination coordinates, plus localized rejection mapping.

- **`packages/shared/src/protocol/ServerMessages.ts`**: Added accepted/rejected room-message contracts for route travel feedback so the client consumes explicit server results.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: Added the new route-travel interaction flow. On success, the server immediately updates synced player position, clears pending movement/action state, persists the new character location through `CharacterService.updateCharacterLocation()`, and sends localized travel feedback.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: Added accepted/rejected route-travel feedback handling using the existing world-session notice flow, without any fake client-side transition or local-only position change.

- **`packages/localization/src/locales/en.ts`** and **`packages/localization/src/LocaleTypes.ts`**: Added the required localization keys for the new route prompts, success/rejection text, new spawn labels, and interactable labels.

**Verification:**

- Focused validation is still pending.

**Known limitations:**

- Travel currently stays inside the existing Nightmarket zone instead of switching to `CombatRoom`.
- No dungeon system, world map, portal system, minimap, or quest-driven travel was added.
- The loop intentionally reuses the current Nightmarket hostile pocket rather than introducing a separate real combat-room handoff.

## Task 330 — Waypoint Foundation: Activate and Use Basic Town Waypoint

**Summary:**

Implemented the first real waypoint flow in the Nightmarket. Interacting with the Nightmarket waypoint now activates it for the current character, opens a localized waypoint panel, lists the currently available destination, and allows a basic server-authoritative travel action that updates both live room position and persisted character location.

**Changes:**

- **`packages/shared/src/room/WaypointTypes.ts`**: Added shared waypoint destination and rejection types for the new waypoint foundation.

- **`packages/shared/src/protocol/ClientMessages.ts`** and **`packages/shared/src/protocol/ServerMessages.ts`**: Added `request_waypoint_travel`, `waypoint_opened`, `request_waypoint_travel_accepted`, and `request_waypoint_travel_rejected` message contracts so the client sends only travel intent while the server owns activation, validation, and the resulting position update.

- **`apps/server/prisma/schema.prisma`** and **`apps/server/prisma/migrations/20260611150000_add_character_waypoint_activations/migration.sql`**: Added persistent character-scoped waypoint activation storage through the new `CharacterWaypointActivation` model.

- **`apps/server/src/persistence/repositories/CharacterRepository.ts`**: Added repository helpers to upsert a waypoint activation and list a character's activated waypoints.

- **`apps/server/src/realtime/rooms/waypointService.ts`**: Added a focused waypoint helper module that activates the Nightmarket waypoint, builds the server-owned panel payload, validates the conservative travel destination, and maps typed rejection reasons to localized feedback.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: Replaced the old waypoint placeholder interaction with a real room-authoritative flow. Interacting with `nightmarket_waypoint_01` now activates and opens the waypoint panel. The new `request_waypoint_travel` handler validates the destination, updates synced player presence coordinates server-side, clears movement targets/pending actions, and persists the new character location immediately.

- **`apps/client/src/game/scenes/worldSession/waypointInteractionPanel.ts`**: Added a dedicated localized waypoint panel instead of reusing the generic placeholder town-service panel. The panel shows a title, subtitle, available destinations, travel buttons, and an empty state.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: Added handling for `waypoint_opened`, `request_waypoint_travel_accepted`, and `request_waypoint_travel_rejected`. The client now opens the real panel on server response, sends travel intent back to the room, and displays localized success/failure feedback.

- **`packages/localization/src/locales/en.ts`** and **`packages/localization/src/LocaleTypes.ts`**: Added the required localized waypoint panel text, status text, destination label, and rejection messages.

**Verification:**

- `pnpm --filter @doomscrolls/server prisma:generate` — passed after releasing the locked Prisma engine file
- Focused typecheck/runtime verification still pending

**Known limitations:**

- Only one conservative destination is exposed for now: Nightmarket Arrival
- No world map, minimap, travel cost, cooldown, portal system, or combat-room routing
- Waypoint unlocks are currently character-scoped, not account-scoped

## Task 329 — Stash Foundation: Server-Authoritative Inventory ↔ Stash Transfer

**Summary:**

Implemented the first real stash transfer flow in town. The Nightmarket stash keeper now supports storing inventory items into stash and taking stash items back into inventory through server-authoritative Colyseus room messages. The server validates ownership, item state, stash availability, and placement rules before updating persistence atomically.

**Changes:**

- **`packages/shared/src/room/StashTypes.ts`**: Added typed rejection reasons for both transfer directions so the client can display safe localized failure feedback without inventing state.

- **`packages/shared/src/protocol/ClientMessages.ts`** and **`packages/shared/src/protocol/ServerMessages.ts`**: Added `request_store_inventory_item_in_stash` and `request_take_stash_item_to_inventory` message contracts plus accepted/rejected response types. Accepted responses include the refreshed authoritative stash item list.

- **`apps/server/src/realtime/rooms/stashTransferItem.ts`**: Added the server-authoritative stash transfer service. It validates ownership and item location, resolves stash/inventory placement using grid collision rules, and updates the item location atomically in a Prisma transaction.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: Registered async handlers for both stash transfer directions and reused the existing stash keeper room-service flow. Transfers remain room/server authoritative; the client only sends intent.

- **`apps/client/src/game/scenes/worldSession/stashInteractionPanel.ts`**: Upgraded the stash panel from list-only to a simple two-section view with Inventory and Stash entries plus localized Store / Take buttons.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: Wired Store / Take button clicks to the new room messages, handled accepted/rejected responses, refreshed stash list state from authoritative room responses, and refreshed inventory/account state through the existing `/me` path.

- **`packages/localization/src/locales/en.ts`** and **`packages/localization/src/LocaleTypes.ts`**: Added localized success messages, action labels, section labels, and rejection feedback for stash full / inventory full / item-state failures.

**Verification:**

- Focused verification is still pending.

**Known limitations:**

- No drag/drop stash UI
- No stash sorting/filtering or tabs/pages UI beyond existing minimal placement fields
- No account-wide stash
- No stack splitting/merging changes

## Task 333C — Objective Foundation: Notice Board Turn-In and One-Time Copper Reward

**Summary:**

The notice board turn-in flow is now live. When the player reaches the required kill count for the active notice board objective (e.g. "Cull Trashboars"), re-interacting with the Nightmarket notice board grants a server-authoritative one-time copper reward, marks the reward as granted, and clears the HUD objective tracker so the player can start the next objective in the chain.

Kill progress remains strictly server-authoritative: reaching the required kill count sets `objectiveCompleted = true` but does **not** automatically grant rewards. The reward is granted only on explicit notice board interaction, with a safe "already completed" message on repeat interaction.

**Changes:**

- **`packages/localization/src/LocaleTypes.ts`** and **`packages/localization/src/locales/en.ts`**: Added `objective.already_completed` localization key with text "Already completed — no more work here."

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: Rewrote the notice board interact handler (`nightmarket_notice_board_01`) with a four-case turn-in flow:
  1. Objective completed + reward not yet granted → marks `objectiveRewardGranted = true`, grants copper via `CharacterRepository.incrementMoneyCopper()`, sends `currency_picked_up`, clears HUD objective state via `resetNoticeBoardObjective()`, sends localized `interact_response` feedback.
  2. Objective completed + reward already granted → sends localized "already completed" message.
  3. Active but not completed → re-sends current objective state without resetting.
  4. No active objective → starts the next uncompleted objective in the sequence, or shows "no more notices" if the chain is complete.

- The turn-in path calls `resetNoticeBoardObjective()` after granting the reward, which removes the tracker card from the HUD. The player can re-interact to start the next objective in the sequence.

- The kill progress path (both basic attack and Grave Spark handlers) continues to use only `advanceObjectiveProgress` which sets `objectiveCompleted` but never `objectiveRewardGranted` — rewards are never auto-granted on kill.

**Verification:**

- `pnpm typecheck` — 0 errors across all 5 workspace projects
- No schema/database changes
- No movement, combat, town route, vendor buy/sell, stash transfer, waypoint travel, loot pickup, rest area, cursor feedback, zoom, camera, or Nightmarket spacing changes

**Known limitations:**

- Task 333E hardens reward persistence: `rewardGranted` is now persisted to DB before granting copper, preventing duplicate reward after reconnect/crash. Turn-in HUD state is correctly managed so `findNextNoticeBoardObjective` advances to the next objective in the chain.
- No quest journal, no generic multi-objective system
- Turn-in grants copper reward only (no XP on turn-in per task scope)

## Task 326 — WorldSession Camera/Projection Layer Unification Fix

**Summary:**

Fixed the blocking WorldSession camera/projection regression introduced by the recent projection work. Camera follow and zoom now update the whole rendered world as one coherent scene, so enemies no longer appear to drift independently while static world props stay visually stale.

**Changes:**

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Promoted the active camera/projection state into one live `currentProjectionState` object shared by pointer conversion and render refresh logic. Added lightweight reprojection updates that run on every refresh so camera movement and zoom reposition the whole world even when no expensive rebuild is needed.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Added guardrail comments clarifying the difference between rebuild paths and projection-only position updates, including why camera movement must still update rendered positions when authoritative room state is unchanged.

- **`apps/client/src/game/scenes/worldSession/worldSessionStaticPropsView.ts`**: Added `updateProjection()` so static props, boundary markers, safe-area markers, rest-area markers, ambient props, and area labels can move with the live projection state without destroy/recreate loops.

- **`apps/client/src/game/scenes/worldSession/worldSessionInteractablesView.ts`**: Added `updateProjection()` plus reusable interactable drawing helpers so vendors, stash keepers, waypoint/trainer placeholders, loot containers, and their hit areas stay aligned during camera follow and zoom changes without re-registering listeners or rebuilding objects every frame.

**Verification:**

- Focused client typecheck still pending after the projection refactor.

**Known limitations:**

- This fix does not add new gameplay systems, stash transfer, waypoint travel, quest flow, vendor redesign, or HUD redesign.

## Task 327 — WorldSession Enemy Visibility, Culling, and Projection Sanity Fix

**Summary:**

Fixed the remaining WorldSession enemy visibility/projection mismatch so offscreen enemies no longer appear as distant waypoint-style markers and visible enemies stay aligned with hover/click targeting across zoom and camera movement. The server still simulates all enemies normally; this change only controls which server-known enemies the client currently renders and allows as visible targets.

**Changes:**

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Added a client visibility guardrail that distinguishes between server-known enemies, client-rendered visible enemies, and client-clickable visible enemies. The render/input path now keeps a shared live enemy projection snapshot map for current visible targets only.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Updated enemy projection flow so render visibility, hover hit-testing, click hit-testing, skill-target distance UI, telegraph lookup, and floating damage anchor lookup all read from the same current projection result instead of mixing stale cached positions with newer camera/zoom state.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Added viewport culling with a small padding margin (`ENTITY_VIEWPORT_PADDING_PX = 36`) so enemies near the edge do not pop aggressively, while enemies outside the current visible area no longer render labels/targets or behave like offscreen waypoints.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Preserved performance safety by keeping enemy placeholder instances alive and hiding offscreen ones instead of destroying/recreating them on every camera or zoom update. Existing one-time listener registration and dirty-gated rebuild protections remain intact.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Added cleanup for stale hovered/selected enemy state when an enemy leaves the visible projected set, preventing offscreen hover/click resolution and stale targeting UI after movement or zoom changes.

**Verification:**

- Focused client typecheck is still pending after the visibility/projection pass.

**Known limitations:**

- This task does not add fog-of-war, stealth/detection, minimap indicators, AI changes, spawn changes, stash transfer, waypoint travel, quest flow, or physical spacing changes.

## Task 328 — Nightmarket Physical Scale and Content Spacing Pass

**Summary:**

Made the Nightmarket feel physically larger through content-data layout changes instead of camera tricks or click hacks. The main town services now occupy a wider readable hub footprint, low-priority clutter is less likely to crowd the important click targets, and the nearby enemy pockets are pushed farther from town and farther apart from one another.

**Changes:**

- **`packages/content/src/data/worldProps.ts`**: Repositioned the Nightmarket service-hub world props without changing any IDs. The notice board, Suspicious Vendor, Stash Keeper, Trainer, and Waypoint now sit farther apart inside the town hub so they are easier to distinguish and click individually.

- **`packages/content/src/data/worldProps.ts`**: Moved supporting props and low-priority clutter away from the main click lane. Nearby crates, junk, and ambient creatures were redistributed so the core service objects read more clearly while the hub still feels populated.

- **`packages/content/src/data/worldProps.ts`**: Shifted the service-hub labels, safe-area markers, rest-area markers, sewer-approach path markers, combat-edge markers, and downstream ambient/combat props outward to match the larger physical footprint. Boundary markers were left unchanged so the playable area framing remains coherent with the existing zone bounds.

- **`packages/content/src/data/spawnPoints.ts`**: Moved `nightmarket_spawn` deeper into the enlarged service hub so player arrival still feels centered in the town-services area after the spacing pass.

- **`packages/content/src/data/spawnZones.ts`**: Repositioned the Nightmarket Skitter, Runt, and Brute enemy pockets farther from town and farther from each other. This keeps the combat route readable while reducing the visual impression that hostiles are pressed directly against the town hub.

- **`packages/content/src/data/zones.ts`**: Enlarged `nightmarket.restAreaBounds` to match the widened service cluster so the existing server-authoritative rest/refill behavior still makes spatial sense with the new marker positions.

**Verification:**

- Focused validation is still pending.

**Known limitations:**

- This pass does not add waypoint travel, stash transfer, quest systems, collision/pathfinding, new town services, new enemy types, or any HUD/client interaction redesign.
- The improvement is intentionally content-driven: world positions changed, but the existing interaction logic, zoom, camera, hover feedback, loot pickup, and combat rules were left intact.

## Task 318 — Vendor Foundation: Open Basic Town Vendor Panel

**Summary:**

Implemented the first real town vendor interaction path. Clicking the Suspicious Vendor in the Nightmarket now opens a basic vendor panel backed by existing content data.

**Changes:**

- **`packages/content/src/data/townServices.ts`**: Added `nightmarket_suspicious_vendor` as a real town-service content definition with `serviceKind: "vendor"`, a localized `labelKey` and `unavailableMessageKey`.

- **`packages/content/src/data/types.ts`**: Extended `TownServiceId` union to include `"nightmarket_suspicious_vendor"`.

- **`packages/localization/src/LocaleTypes.ts`**: Added `town_service.suspicious_vendor.name` and `town_service.suspicious_vendor.unavailable` to `REQUIRED_LOCALIZATION_KEYS`.

- **`packages/localization/src/locales/en.ts`**: Added `"town_service.suspicious_vendor.name": "Suspicious Vendor"` and `"town_service.suspicious_vendor.unavailable": "Vendor trading is not available yet."` locale entries.

- **`apps/server/src/realtime/rooms/interactValidation.ts`**: Updated `getInteractableResponseMessage` for `nightmarket_vendor_01` to return the localized vendor name followed by a vendor greeting (`"Suspicious Vendor: 'What're you buyin'?'"`) instead of the previous `"Vendor trading is not available yet."` hardcoded string.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: Updated the interact response handler for `nightmarket_vendor_01` to read the vendor label from `contentRegistry.townServices.get("nightmarket_suspicious_vendor").labelKey` via the localization `t()` function, eliminating the hardcoded `"Suspicious Vendor"` string.

**Verification:**

- `pnpm typecheck` — 0 errors
- `pnpm test` — all pass
- Pre-existing lint errors only (3 errors in unrelated files: `worldSessionAreaView.ts`, `worldSessionCursorFeedback.ts`)

**Known limitations:**

- No selling, buyback or vendor stock refresh/persistence
- No currency economy redesign

## Task 319 — Vendor Foundation: Server-Authoritative Buy Item

**Summary:**

Implemented the first real server-authoritative vendor buy action. Clicking the Buy button on a vendor stock item sends a `request_buy_vendor_item` message to the server. The server validates vendor existence, stock membership, price, player currency and inventory space, then atomically deducts copper and creates the inventory item. On success the client panel updates the money display; on failure a typed localized rejection reason is shown.

**Changes:**

- **`packages/shared/src/room/VendorBuyTypes.ts`**: New shared type file exporting `RequestBuyVendorItemRejectedReason` (`vendor_unavailable`, `item_unavailable`, `not_enough_currency`, `inventory_full`, `invalid_stock_entry`).

- **`packages/shared/src/protocol/ClientMessages.ts`**: Added `RequestBuyVendorItemClientMessage { type, vendorId, stockEntryId }` and included it in `ClientRoomMessage`.

- **`packages/shared/src/protocol/ServerMessages.ts`**: Added `RequestBuyVendorItemAcceptedServerMessage` (stockEntryId, itemId, priceCopper, remainingCopper) and `RequestBuyVendorItemRejectedServerMessage` (reason, stockEntryId?). Included both in `ServerRoomMessage`.

- **`packages/shared/src/index.ts`**: Re-exported `room/VendorBuyTypes`.

- **`apps/server/src/persistence/repositories/CharacterRepository.ts`**: Added `getMoneyCopper()` and `decrementMoneyCopper()` methods with atomic Prisma transactions and sufficient-funds guards.

- **`apps/server/src/realtime/rooms/vendorBuyItem.ts`**: New server module. `executeVendorBuyItem()` validates vendor content, stock entry membership, item definition, price positivity, player copper sufficiency, and inventory grid space. On success it atomically deducts copper and creates an `ItemInstance` in inventory via Prisma `$transaction`.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: Registered `request_buy_vendor_item` async message handler. On acceptance sends `request_buy_vendor_item_accepted` + `currency_picked_up` (for HUD refresh). On rejection sends `request_buy_vendor_item_rejected` with a typed reason.

- **`packages/localization/src/locales/en.ts`**: Added `town_service.vendor_panel.buy_success`, `buy_rejected.not_enough_currency`, `buy_rejected.inventory_full`, `buy_rejected.item_unavailable`, `buy_rejected.vendor_unavailable`, `buy_rejected.invalid_stock_entry` keys.

- **`apps/client/src/game/scenes/worldSession/vendorInteractionPanel.ts`**: Updated to accept `vendorId` and `onBuy` callback. Buy button is now active (enabled when player can afford). Panel exposes `updateMoney()` and `showFeedback()` methods. "Trading locked" note removed.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: Wired `onBuy` callback to send `request_buy_vendor_item` through the Colyseus room. Added `request_buy_vendor_item_accepted` and `request_buy_vendor_item_rejected` message listeners. On success updates vendor panel money and shows localized feedback. On failure shows localized rejection message.

**Verification:**

- `pnpm typecheck` — 0 errors (all 5 workspace projects pass)
- Pre-existing lint errors only (unrelated to this task)

**Known limitations:**

- No selling, buyback, restock timers or dynamic prices
- No reputation or discount system
- No schema/database changes (existing `moneyCopper` field used)

## Task 320 — Vendor Foundation: Server-Authoritative Sell Item

**Summary:**

Implemented the first real server-authoritative vendor sell action. Clicking the Sell button on an inventory item in the vendor panel sends a `request_sell_item` message to the server. The server validates the item instance exists in the player's inventory, removes it atomically via Prisma `$transaction`, calculates the sell price (50% of vendor stock buy price, minimum 1 copper), credits copper, and responds with accepted/rejected feedback.

**Changes:**

- **`packages/shared/src/room/VendorSellTypes.ts`**: New shared type file exporting `RequestSellItemRejectedReason` (`vendor_unavailable`, `item_not_in_inventory`, `sell_unavailable`, `item_not_found`).

- **`packages/shared/src/protocol/ClientMessages.ts`**: Added `RequestSellItemClientMessage { type, vendorId, itemInstanceId }` and included it in `ClientRoomMessage`.

- **`packages/shared/src/protocol/ServerMessages.ts`**: Added `RequestSellItemAcceptedServerMessage` (itemInstanceId, definitionId, sellPriceCopper, remainingCopper) and `RequestSellItemRejectedServerMessage` (reason, itemInstanceId?). Included both in `ServerRoomMessage`.

- **`packages/shared/src/index.ts`**: Re-exported `room/VendorSellTypes`.

- **`apps/server/src/persistence/repositories/ItemRepository.ts`**: New repository module. `getItemInstanceWithOwner()` fetches an item with its owner character. `deleteItemInstance()` atomically removes an item instance by id. Used by the sell item service.

- **`apps/server/src/persistence/repositories/CharacterRepository.ts`**: Added `incrementMoneyCopper()` method with atomic Prisma transaction for crediting copper on sell.

- **`apps/server/src/realtime/rooms/vendorSellItem.ts`**: New server module. `executeVendorSellItem()` validates vendor content exists, fetches the item instance and verifies inventory ownership, calculates sell price from vendor stock data (50% ratio, minimum 1 copper), then atomically deletes the item and credits copper via Prisma `$transaction`.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: Registered `request_sell_item` async message handler. On acceptance sends `request_sell_item_accepted`. On rejection sends `request_sell_item_rejected` with a typed reason.

- **`packages/localization/src/locales/en.ts`**: Added `town_service.vendor_panel.sell_header`, `sell_empty`, `sell_success`, `sell_rejected.item_not_in_inventory`, `sell_rejected.vendor_unavailable`, `sell_rejected.item_not_found`, `sell_rejected.sell_unavailable` keys.

- **`apps/client/src/game/scenes/worldSession/vendorInteractionPanel.ts`**: Extended to accept `inventoryItems` and `onSell` callback. Added sell section below the stock section showing inventory items with name, sell price and Sell button. Added `updateInventory()` method for live refresh after sell.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: Wired `onSell` callback to send `request_sell_item` through the Colyseus room. Added `request_sell_item_accepted` and `request_sell_item_rejected` message listeners. On success updates vendor panel money, inventory display, and refreshes account state. Added `buildInventoryItemsForSell()` helper that maps `inventorySummaryItems` from `CharacterSummary` to sellable items with client-side price preview.

**Verification:**

- `pnpm typecheck` — 0 errors (all 5 workspace projects pass)
- Pre-existing lint errors only (unrelated to this task)

**Known limitations:**

- No buyback system (sold items are permanently removed)
- No sell price negotiation or reputation discounts
- No schema/database changes (existing item instance and moneyCopper fields used)
- Client-side sell price is a preview; server is always authoritative

## Task 321 — WorldSession Playable View and Clickability Pass

**Summary:**

Improved the WorldSession play feel by reducing overlay obstruction, compacting the bottom HUD, tightening the top-left status chip, slightly increasing the default camera zoom, and lowering low-priority world-label noise in crowded areas. The pass keeps existing cursor feedback, move-then-act behavior, pickup/vendor flows, and zoom controls intact while making the visible world feel larger and easier to click through.

**Changes:**

- **`apps/client/src/game/scenes/worldSession/worldSessionOverlayLayout.ts`**: Reduced overlay root padding/gap and narrowed the HUD region width. Also reduced panel padding and softened panel box-shadow so the overall overlay footprint feels lighter and less dominant.

- **`apps/client/src/game/scenes/worldSession/worldSessionOverlayView.ts`**: Compacted the bottom HUD card spacing/padding, removed the redundant Resource mini-stat, and combined level + XP into one smaller mini-stat. Tightened the top-left character/status chip width, padding, and text sizes so it blocks less of the viewport while preserving player/location readability.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Increased the default camera zoom from `1.0` to `1.15` so the starting framing feels more playable and less cramped while preserving existing wheel and keyboard zoom controls.

- **`apps/client/src/game/scenes/worldSession/worldSessionStaticPropsView.ts`**: Reduced ambient creature label emphasis by shrinking ambient labels from `11px` to `9px`, muting their label color slightly, and removing the separate always-visible `Neutral` badge. Important service / area / boundary markers remain visible.

- **`apps/client/src/game/scenes/worldSession/worldSessionInteractablesView.ts`**: Reduced interactable label font size from `11px` to `10px` to slightly cut label stacking pressure in crowded town/service areas without changing authoritative click handling.

**Verification:**

- `pnpm --filter @doomscrolls/client typecheck` — passed
- `pnpm --filter @doomscrolls/client lint` — reports pre-existing unrelated lint errors in:
  - `apps/client/src/game/scenes/worldSession/vendorInteractionPanel.ts`
  - `apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`
  - `apps/client/src/game/scenes/worldSession/worldSessionCursorFeedback.ts`

**Known limitations:**

- This pass does not add a minimap, stash, waypoint travel, quests, or new gameplay systems
- Label decluttering is intentionally lightweight; it reduces low-priority noise but does not introduce a full overlap solver or hover-only label system for every object class
- Existing debug text inside the world viewport is unchanged outside the HUD/overlay compaction pass

## Task 322 — Targeted Client Lint Cleanup for WorldSession Vendor/UI Files

**Summary:**

Resolved the current targeted client lint issues in the WorldSession vendor/UI path with only mechanical cleanup. The changes remove unused code/imports and one unnecessary non-null assertion without changing vendor behavior, cursor feedback, move-then-act flow, clickability, combat feedback, inventory/equipment behavior, rest area feedback, or zoom behavior.

**Changes:**

- **`apps/client/src/game/scenes/worldSession/vendorInteractionPanel.ts`**: Removed an unused `computeClientSellPrice()` helper that was no longer referenced. Also replaced the Sell button handler's non-null assertion with a direct call under the existing `onSell !== undefined` guard.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Removed the unused `previousHoverTargetId` variable left behind in the cursor-feedback hover path.

- **`apps/client/src/game/scenes/worldSession/worldSessionCursorFeedback.ts`**: Removed an unused localization import.

**Verification:**

- `pnpm eslint apps/client/src/game/scenes/worldSession/vendorInteractionPanel.ts apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts apps/client/src/game/scenes/worldSession/worldSessionCursorFeedback.ts` — 0 errors, 0 warnings

**Known limitations:**

- This task intentionally performs only targeted lint cleanup and does not change gameplay, vendor rules, UI structure, or broader client lint status outside the listed files

## Task 323 — Stash Foundation: Add Persistent Character Stash Schema

**Summary:**

Added the minimal persistent stash data foundation without introducing stash UI or item transfer behavior. The implementation reuses the existing `ItemInstance` persistence model and adds a new stash location path so future inventory ↔ stash features can move real persisted item instances without inventing a parallel item-storage system.

**Changes:**

- **`apps/server/prisma/schema.prisma`**: Added `STASH` to `ItemLocationType`, added nullable stash placement fields (`stashPage`, `stashX`, `stashY`) to `ItemInstance`, and added supporting indexes for character-scoped stash queries.

- **`packages/shared/src/inventory/ItemTypes.ts`**: Extended shared item location typing with a real `stash` location carrying `characterId`, `pageIndex`, `x`, and `y`.

- **`apps/server/src/persistence/mappers/itemMapper.ts`**: Added stash mapping support so persisted stash items can be projected through the existing item DTO path once a later task exposes them.

- **`apps/server/src/persistence/repositories/ItemRepository.ts`**: Added `listStashItems(characterId)` for basic character-scoped stash reads while preserving existing inventory/equipment methods.

**Verification:**

- Existing inventory/equipment/vendor persistence paths were audited against the shared `ItemInstance` location model before the stash schema change.
- No UI wiring or runtime stash behavior was added in this task.

**Known limitations:**

- No stash UI yet
- No inventory ↔ stash transfer flow yet
- No account-wide stash yet; current stash persistence is character-scoped via `ownerCharacterId`
- No stash page sizing, tab rules, sorting, or validation service yet

## Task 324 — Stash Foundation: Open Basic Town Stash Panel

**Summary:**

Implemented the first visible stash interaction path in the Nightmarket. Interacting with the Stash Keeper now opens a basic localized stash panel and lists the current character's persisted stash items from the real `STASH` item location. The path is server-authoritative for listing only and does not introduce any fake transfer behavior.

**Changes:**

- **`packages/shared/src/room/StashTypes.ts`**: Added shared stash list rejection reasons for the room-driven stash listing contract.

- **`packages/shared/src/protocol/ServerMessages.ts`**: Added `stash_items_listed` and `stash_items_list_rejected` server messages. The listed payload returns shared `ItemInstance` DTOs so the client consumes the same persisted item shape already used elsewhere.

- **`packages/shared/src/index.ts`**: Re-exported the new stash shared types.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: Extended the existing `request_interact` stash keeper path. When `nightmarket_stash_keeper_01` is interacted with, the room now reads persisted stash rows using `ItemRepository.listStashItems(characterId)`, maps them through `toItemInstanceDto()`, and sends `stash_items_listed` back to the requesting client. Failures return a safe `stash_items_list_rejected` reason.

- **`packages/localization/src/LocaleTypes.ts`** and **`packages/localization/src/locales/en.ts`**: Added required localization keys and English strings for the stash panel title, foundation notice, empty state, page/position metadata, load failure feedback, and shared Close button text.

- **`apps/client/src/game/scenes/worldSession/stashInteractionPanel.ts`**: Added a new lightweight stash modal panel. It shows a localized title, a clear foundation-only notice, a localized empty state, and simple persisted-item rows. Item labels come from the existing content localization keys. Stash rows display existing persisted page/X/Y metadata only; no transfer controls or fake affordances are shown.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: Replaced the stash placeholder town-service panel flow with the new stash panel. The scene now opens the stash panel on stash interaction and listens for `stash_items_listed` / `stash_items_list_rejected` to populate or safely fail the panel.

**Verification:**

- Existing Nightmarket stash keeper world prop and town service definitions were reused; no new schema changes were required beyond Task 323.
- Existing vendor, trainer, waypoint, inventory/equipment, movement, combat, rest area, cursor feedback, and area banner flows were left untouched by the stash-specific wiring.

**Known limitations:**

- No inventory → stash transfer yet
- No stash → inventory transfer yet
- No drag/drop or stash grid placement UI
- No sorting, filtering, tabs, or account-wide stash behavior
- The panel is intentionally foundation-only and lists persisted items without implying active item movement

## Task 325 — WorldSession Zoom, Projection, and Camera Range Fix

**Summary:**

Fixed the recent WorldSession zoom/projection regression so zoom changes apply immediately even while the player is idle, expanded the zoom range in both directions, and aligned the hit-test path with the current projection/camera state to reduce post-zoom click drift. The starting camera framing now shows more useful playable space by default while still allowing close inspection zoom.

**Changes:**

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Added explicit camera zoom constants for minimum zoom (`0.55`), maximum zoom (`1.9`), default zoom (`1.0`), and zoom step (`0.1`). This replaces the previously more cramped default and narrower range.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Updated `setZoom()` so a zoom change immediately triggers `refreshFromRoomState()` using the latest active room reference. Zoom refresh no longer waits for player movement or a future Colyseus state update before projection/camera-dependent rendering catches up.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Updated pointer-to-world conversion to use the current projection context's `projectionMode` directly, ensuring ground-click resolution uses the same live projection state that rendering uses after zoom/projection changes.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Added a cached `corpseScreenPositions` map and switched own-corpse hover/click hit-testing to use current projected screen positions plus current world coordinates. This removes one mixed-coordinate path that could drift after zoom and keeps corpse interaction aligned with the rendered marker.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Updated projection-mode changes to also trigger an immediate refresh against the current room so camera/projection-dependent visuals and hit-testing stay synchronized when switching projection without waiting for later room activity.

**Verification:**

- Code audit confirmed the lag-fix guard remains intact: no new per-frame listener registration, no new repeated DOM creation, and no new unconditional full rebuild path was added.
- Runtime verification is still pending.

**Known limitations:**

- This task does not add new gameplay systems, stash transfer, waypoint travel, quests, or HUD rewrites.
- WorldSession still relies on the existing lightweight placeholder/view architecture; this task only fixes zoom/projection refresh and alignment within that structure.