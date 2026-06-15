# docs/CORE_BUILD_0_3_CHECKLIST.md — Core Build 0.3 Checklist

---

## Core 0.3 Playable Loop Checkpoint — Closure Status

**Date:** 2026-06-12
**Checkpoint:** Core 0.3 playable-loop checkpoint
**Status:** Checkpoint closed. All planned 0.3 pillars have shipped at foundation level.

### Shipped 0.3 Systems

| System | Tasks | Status |
|--------|-------|--------|
| Vendor buy/sell | 318, 319, 320, 322 | Shipped — server-authoritative buy and sell with copper economy |
| Stash listing/store/take | 323, 324, 329 | Shipped — persistent character stash with server-authoritative transfer |
| Waypoint activation/travel | 330, 336 | Shipped — persistent activation, two destinations (Nightmarket Arrival + Blackwire Combat Edge) |
| Town → combat route and return | 331 | Shipped — same-zone Blackwire Gate / Sewer Edge route loop |
| Notice board objective start/progress/turn-in/reward | 333, 332, 333B, 333C, 333D, 333E, 333F | Shipped — single-objective foundation with persistence and copper reward |
| Objective persistence hardening | 333D, 333E | Shipped — persisted start, progress, reward-grant prevents duplicate copper |
| WorldSession zoom/projection/culling fixes | 325, 326, 327 | Shipped — zoom range, projection unification, enemy culling |
| Nightmarket physical spacing pass | 328 | Shipped — expanded hub footprint, reduced clutter crowding |
| Playable loop hardening audit | 334 | Shipped — end-to-end audit with two bug fixes |

### Current 0.3 Status

#### What is playable now

- Login, character creation, and character selection (Core 0.1/0.2)
- Enter the Nightmarket hub with real server-authoritative player presence
- Notice board objective: start objective, kill Trashboar Runts for progress, turn in for copper reward
- Town → combat route: use Blackwire Gate to teleport to Blackwire Sewer Edge, fight enemies, loot
- Combat → town return: use return marker to teleport back to Nightmarket hub
- Vendor buy: purchase items from Suspicious Vendor with server-validated copper deduction
- Vendor sell: sell inventory items for copper with server-validated item removal
- Stash store: store inventory items into persistent character stash
- Stash take: take stash items back into inventory with grid-based placement
- Waypoint discovery: clicking a physical waypoint unlocks that destination for the current character
- Waypoint travel: panel opens from either physical waypoint and lists only discovered destinations
- Loot pickup, rest area HP/flask refill, cursor feedback, zoom, camera follow
- Reconnect/rejoin restoration: objective state, character location, HP, flask charges restored
- HUD overlay: vitality, level/XP, objective tracker, money display

#### What is still foundation-only

- Objective system: single-objective notice board chain only; no quest journal, no multi-objective, no item/XP rewards
- Vendor economy: fixed 50% sell price; no stock refresh, no buyback, no reputation, no haggling
- Stash: character-scoped only; no drag/drop, no tabs, no sorting, no account-wide stash, no stash grid UI
- Waypoint: two same-zone physical waypoint discoveries only; no world map, no minimap, no multi-zone network
- Town → combat routing: same-zone teleport only; no real CombatRoom handoff, no room migration

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
- Waypoint has two destinations (Nightmarket Arrival + Blackwire Combat Edge) but no multi-zone network

### Blockers and Risks

- Runtime verification still needed where not manually confirmed (Task 325 zoom, Task 329 stash transfer, Task 328 spacing, Task 330 waypoint)
- Prisma/client generation Windows lock risk — Prisma engine file lock was encountered during Task 330; may recur after schema changes
- Camera/projection regressions should remain on watch — the zoom/projection unification (Tasks 325–327) touched core rendering paths
- Objective persistence / reward duplication should remain on watch — `rewardGranted` persistence hardened in Task 333E but no integration test coverage yet

### Task 337 — Objective UX Polish: Clear Route and Turn-In Feedback

- [x] Updated localization keys: added `objective.accepted_with_route`, `objective.progress_feedback`; improved `objective.ready_to_turn_in`, `objective.turn_in_complete_reward_copper_only`, `objective.state.ready_to_turn_in`
- [x] HUD objective tracker now shows localized state label "Active" / "Return to Board"
- [x] HUD subtitle now shows target enemy + progress while active, return-to-board instruction when complete
- [x] Target enemy label is resolved from content registry (e.g. "Trashboar Runt / Trashboar Brute")
- [x] Server sends improved interact_response on start: mentions route/waypoint and target enemy
- [x] Server sends improved interact_response on turn-in: shows copper gained
- [x] Client presence helper resolves `targetEnemyLabel` from objective content enemy definitions
- [x] No objective persistence, kill tracking, reward logic, quest journal, minimap markers, or route arrows changed
- [x] `pnpm typecheck` — 0 errors
- [x] Pre-existing lint errors only

### Task 339 — Travel UX: Basic Teleport Loading Overlay

- [x] Audited route travel and waypoint travel flow in `WorldSessionScene.ts`, `TownRoom.ts`, and `waypointService.ts`
- [x] Confirmed travel remains server-authoritative: route/waypoint acceptance still resolves position from server state, not client-only teleport logic
- [x] Added `apps/client/src/game/scenes/worldSession/worldSessionTravelOverlayView.ts` as a lightweight reusable DOM overlay with translucent full-screen pointer capture
- [x] Route travel now shows the overlay when the request is sent and hides it only after synced state is applied, rejection arrives, or a short timeout expires
- [x] Waypoint travel now shows the overlay when the request is sent and hides it only after synced state is applied, rejection arrives, or a short timeout expires
- [x] Overlay cleanup covers scene shutdown/destroy and clears timers to avoid stale listener/timer leakage
- [x] Added localized route/waypoint travel overlay copy and timeout feedback
- [x] No cross-room handoff, CombatRoom migration, fake travel success, progress bar, minimap, or schema/database changes

### Proposed Next-Scope Candidates (Post-0.3 Checkpoint)

These are candidates for the next implementation wave. They are listed without starting any implementation.

1. **Objective runtime smoke pass** — Manual or automated end-to-end verification of the full objective loop (start → kill → progress → turn-in → reward → next objective) to confirm persistence and duplication guards hold at runtime
2. **CombatRoom handoff investigation** — Explore Colyseus room migration feasibility for a real TownRoom → CombatRoom transition with state preservation
3. **Second waypoint destination** — Add a real second waypoint destination (e.g. a future zone) to validate the waypoint network data flow beyond the single self-loop
4. **First quest journal / lightweight objective panel polish** — Expand the objective tracker into a minimal toggleable quest log with objective details and multi-step support
5. **Stash / vendor UI readability pass** — Improve stash panel layout (sections, item readability) and vendor panel clarity (stock vs sell sections, price readability)
6. **First content expansion after 0.3 checkpoint** — Add a second objective type, new enemy variant, or new zone content to validate the content pipeline end-to-end

---

## Task 333E — Objective Persistence Hardening: Persist Start and Turn-In Reliably

- [x] Fixed objective start persistence: `startNoticeBoardObjective` now immediately calls `ObjectiveRepository().create()` so the `CharacterObjective` row is written on objective start (not deferred to first kill)
- [x] Fixed turn-in persistence: reward-granted state (`rewardGranted = true`) is persisted via `ObjectiveRepository().markRewardGranted()` BEFORE granting the copper reward — this prevents duplicate copper after reconnect/crash
- [x] Turn-in now uses awaited persistence (not fire-and-forget with `void`)
- [x] Fixed turn-in HUD state: after reward is granted, HUD display fields (`hasObjective`, `objectiveLabel`, `objectiveCurrent`, `objectiveTarget`, `objectiveCompleted`) are cleared, but `objectiveId` and `objectiveRewardGranted` are kept on PlayerPresence so `findNextNoticeBoardObjective` can properly skip the completed objective and advance to the next one
- [x] Progress persistence already correct (`updateProgress` callback on kill — fire-and-forget, with clamping at required count)
- [x] Existing persisted state restoration on `onJoin` already handles `0 / required` correctly (scans sequence for first non-reward-granted row)
- [x] No schema changes (existing model supports all fields)
- [x] Updated `docs/CORE_BUILD_0_3_CHECKLIST.md`
- [x] Updated `docs/CORE_BUILD_0_3_RELEASE_NOTES.md`
- [x] No movement, combat, town route, vendor buy/sell, stash transfer, waypoint travel, loot pickup, rest area, cursor feedback, zoom, camera, or Nightmarket spacing changes

## Task 333B — Objective Foundation: Increment Notice Board Kill Progress

- [x] Audited current enemy death/kill resolution path in `TownRoom.ts` and related combat helpers
- [x] Identified that the server already knows `validation.enemy.enemyId` (killed enemy type) and `player` (who gets kill credit) in both the basic attack handler (`registerAttackHandler`) and the Grave Spark skill handler (`registerSkillSlotHandler`)
- [x] Created `apps/server/src/realtime/rooms/advanceObjectiveProgress.ts` — a focused, side-effect-free helper that increments progress by 1 and clamps at `requiredKills`, without granting rewards or marking `rewardGranted`
- [x] Added guard/comments documenting that this is a single-objective foundation and not the final quest system
- [x] Replaced the old `advanceNoticeBoardObjective` call in `registerAttackHandler` with `advanceObjectiveProgress` + a direct `objective_updated` message
- [x] Replaced the old `advanceNoticeBoardObjective` call in `registerSkillSlotHandler` (Grave Spark) with `advanceObjectiveProgress` + a direct `objective_updated` message
- [x] The `advanceObjectiveProgress` helper checks that the active objective matches the killed enemy type via `targetEnemyIds`
- [x] Progress is clamped at `player.objectiveTarget` (the `requiredKills` from the content definition) — repeated kills after reaching the required count do not exceed it
- [x] Non-target enemy kills are ignored (the objective is not incremented)
- [x] No objective completion/turn-in logic, no reward logic, no persistence, no quest journal, no generic multi-objective system
- [x] The old `advanceNoticeBoardObjective` function has been removed (Task 333F) — kill progress is reward-free via `advanceObjectiveProgress`
- [x] No enemy AI changes, no combat formula changes, no vendor/stash/waypoint/routing changes
- [x] `pnpm typecheck` — 0 errors
- [x] Pre-existing lint errors only (unrelated to this task)

## Task 333 — Notice Board Sends Static Authoritative Objective State

- [x] Extended `ObjectiveUpdatedServerMessage` with optional `descriptionKey` field
- [x] Added `objectiveDescriptionKey` Colyseus schema field to `PlayerPresence`
- [x] Server `startNoticeBoardObjective` now populates `descriptionKey` from content definition
- [x] Server `buildObjectiveUpdatedMessage` conditionally includes `descriptionKey` in the protocol payload
- [x] Client `registerInteractResponseListener` forwards `descriptionKey` from room messages
- [x] Client `applyOptionalObjective` reads `objectiveDescriptionKey` from Colyseus schema and passes it through the presence entry
- [x] HUD objective tracker card renders the localized description below the state label when present
- [x] `resolveObjectiveTrackerViewModel` resolves the description key via `t()` for display
- [x] No duplicate objective cards created by repeated notice board clicks (existing guard preserved)
- [x] No fake objective placeholder restored
- [x] No kill progress, no objective completion, no persistence, no rewards, no schema/database changes
- [x] No movement, combat, town route, vendor buy/sell, stash transfer, waypoint travel, loot pickup, rest area, cursor feedback, zoom, camera, or Nightmarket spacing changes

## Task 332 — Remove Fake Objective Placeholder Only

- [x] Audited the WorldSession HUD/objective display path in `worldSessionOverlayView.ts` and confirmed the fake placeholder lived in the client-only fallback view model
- [x] Removed the fake default tracked objective hint and the fake "no more notices" placeholder from normal WorldSession HUD rendering
- [x] Updated the HUD layout so the objective section is omitted entirely when no real objective exists
- [x] Preserved real objective rendering when authoritative objective state is present
- [x] Did not add quest/objective tracking, fake progress, rewards, persistence, or enemy kill handling changes
- [x] Kept movement, combat, town routing, vendor, stash, waypoint, loot pickup, rest area, cursor feedback, zoom, camera, and Nightmarket spacing behavior unchanged

## Task 333C — Objective Foundation: Notice Board Turn-In and One-Time Copper Reward

- [x] Audited current objective fields on PlayerPresence (hasObjective, objectiveId, objectiveCompleted, objectiveRewardGranted — all present)
- [x] Verfied advanceObjectiveProgress helper: sets objectiveCompleted but does NOT set rewardGranted or grant rewards
- [x] The old `advanceNoticeBoardObjective` function was removed in Task 333F — no auto-reward-on-kill path remains
- [x] Added localized key `objective.already_completed` and English translation text to locale types and en.ts
- [x] Added turn-in logic in the notice board interact handler (`nightmarket_notice_board_01`):
  - [x] Objective completed + reward not granted → marks rewardGranted, grants copper via CharacterRepository.incrementMoneyCopper, sends currency_picked_up, resets HUD objective state via resetNoticeBoardObjective, sends interact_response with localized feedback
  - [x] Objective completed + reward already granted → shows safe "already completed" message
  - [x] Active but not completed → re-sends current state
  - [x] No active objective → starts next in sequence or shows "no more notices"
- [x] Turn-in clears the HUD objective tracker via resetNoticeBoardObjective after granting reward
- [x] Kill progress path (both basic attack and Grave Spark) continues to use advanceObjectiveProgress only — no automatic reward on kill
- [x] `pnpm typecheck` — 0 errors across all 5 workspace projects
- [x] No schema/database changes
- [x] No movement, combat, town route, vendor buy/sell, stash transfer, waypoint travel, loot pickup, rest area, cursor feedback, zoom, camera, or Nightmarket spacing changes

**Known limitations (documented in release notes):**

- Reward granting is session-scoped (objectiveRewardGranted lives on PlayerPresence only)
- No persistence across room join/leave — re-joining resets objective state
- No quest journal, no multi-objective system
- Turn-in grants copper reward only (no XP on turn-in per task scope)

## Task 331 — Travel Foundation: Town to Combat Area Routing

- [x] Audited existing `TownRoom`, `CombatRoom`, zone content, spawn points, location persistence, waypoint travel, and nearby enemy pocket foundations
- [x] Chose the safer same-zone Nightmarket routing path instead of room switching, reusing the existing hostile pockets and viewport/camera behavior
- [x] Added a Blackwire Gate interactable near the Nightmarket service hub and a return interactable near the Blackwire Sewer Edge pocket
- [x] Added same-zone travel spawn points for hub → combat-edge entry and combat-edge → hub return
- [x] Extended town interactable initialization so combat-edge props can participate in the real interact flow
- [x] Added server-authoritative route validation and travel resolution for known interactables and known destination spawn points
- [x] Successful route travel now clears pending movement/action state, updates live synced player position immediately, and persists character location through the existing location service
- [x] Added localized route prompts, success text, rejection text, and world-prop labels for the new route/return interactables
- [x] Wired client feedback handling for accepted/rejected route travel without inventing client-only transitions
- [x] Kept routing inside the existing Nightmarket zone so camera/projection/zoom and enemy viewport culling behavior continue to use the existing world-session path

## Task 326 — WorldSession Camera/Projection Layer Unification Fix

- [x] Audited `worldSessionAreaView.ts` and related render views to find every world-to-screen, screen-to-world, camera-offset, and hit-test conversion path
- [x] Unified camera/projection refresh around one live projection state (`projection`, `offset`, `focusPosition`) used by render updates and pointer conversion
- [x] Added lightweight reprojection-only updates for static props and interactables so camera follow and zoom move the full world scene even when room state is not otherwise dirty
- [x] Preserved the Task 307 performance guard by keeping rebuilds in the dirty path and using position-only updates for camera/projection changes
- [x] Kept enemy, loot, corpse, player, target marker, rest-area indicator, and click/hover hit-test alignment on the same active projection flow

## Task 318 — Vendor Foundation: Open Basic Town Vendor Panel

- [x] Audit existing town service / vendor interactables and vendorStocks content data
- [x] Added `nightmarket_suspicious_vendor` to `townServices.ts` content definition
- [x] Added `town_service.suspicious_vendor.name` and `.unavailable` localization keys
- [x] Added `"nightmarket_suspicious_vendor"` to `TownServiceId` union type
- [x] Added `town_service.suspicious_vendor.name` and `.unavailable` to `REQUIRED_LOCALIZATION_KEYS`
- [x] Updated server `getInteractableResponseMessage` for `nightmarket_vendor_01`: shows localized vendor name + greeting instead of "not available yet"
- [x] Updated client `WorldSessionScene` to read vendor name from `contentRegistry.townServices` instead of hardcoded `"Suspicious Vendor"`
- [x] Vendor panel still shows stock from existing `vendorStocks` data (no changes needed — already works)
- [x] No buying or selling introduced
- [x] No schema/database changes
- [x] `pnpm typecheck` — 0 errors
- [x] `pnpm test` — all pass
- [x] Pre-existing lint errors only (unrelated to this task)

## Task 319 — Vendor Foundation: Server-Authoritative Buy Item

- [x] Added `RequestBuyVendorItemClientMessage` to shared `ClientMessages.ts`
- [x] Added `RequestBuyVendorItemAcceptedServerMessage` / `RequestBuyVendorItemRejectedServerMessage` to shared `ServerMessages.ts`
- [x] Added `RequestBuyVendorItemRejectedReason` type in `packages/shared/src/room/VendorBuyTypes.ts`
- [x] Exported new shared types from `packages/shared/src/index.ts`
- [x] Added `CharacterRepository.getMoneyCopper()` and `decrementMoneyCopper()` methods
- [x] Created `apps/server/src/realtime/rooms/vendorBuyItem.ts` — server-authoritative buy handler
- [x] Handler validates: vendor exists, stock entry belongs to vendor, item definition exists, price is positive, player has enough copper, inventory has space
- [x] Handler atomically deducts copper and creates inventory item in a Prisma transaction
- [x] Registered `request_buy_vendor_item` message handler in `TownRoom`
- [x] Added localization keys for buy success and all rejection reasons
- [x] Updated vendor panel to accept `onBuy` callback and vendor ID; Buy button is now active
- [x] Updated `WorldSessionScene` to send `request_buy_vendor_item` on Buy click and handle accepted/rejected responses
- [x] Vendor panel updates money display after successful purchase
- [x] No selling, buyback, restock timers, dynamic prices or reputation system
- [x] No schema/database changes (existing `moneyCopper` field already supports currency)
- [x] No Git operations

## Task 321 — WorldSession Playable View and Clickability Pass

- [x] Audited current WorldSession layout: status chip, right utility/debug stack, bottom HUD, world viewport, and dense world labels
- [x] Reduced overlay obstruction by shrinking overlay root padding/gaps and lowering panel visual weight
- [x] Compacted bottom HUD width and content so HP / flask / objective / XP remain visible while blocking less world space
- [x] Removed the redundant Resource mini-stat and combined level + XP into a single compact mini-stat
- [x] Tightened the top-left status chip with smaller width, padding, and text sizes
- [x] Preserved right-side utility/debug panels defaulting to collapsed via existing closed open-state defaults
- [x] Kept debug panel clearly optional/dev-only within the collapsible utility stack
- [x] Increased default WorldSession camera zoom from `1.0` to `1.15` while preserving wheel / keyboard zoom controls
- [x] Reduced ambient/neutral label noise by shrinking ambient creature labels and removing the always-visible `Neutral` badge
- [x] Reduced interactable label font size to improve crowded hover/click readability
- [x] Preserved existing cursor feedback from Task 314
- [x] Preserved existing move-then-act behavior, loot pickup, vendor interaction, rest area, inventory, and zoom behavior
- [x] Kept the solution lightweight: no per-frame DOM creation, no repeated listener registration, no per-frame prop/interactable rebuild regressions
- [x] `pnpm --filter @doomscrolls/client typecheck` — passed
- [x] `pnpm --filter @doomscrolls/client lint` — existing unrelated lint errors remain in `vendorInteractionPanel.ts`, `worldSessionAreaView.ts`, and `worldSessionCursorFeedback.ts`

## Task 322 — Targeted Client Lint Cleanup for WorldSession Vendor/UI Files

- [x] Audited current client lint output for `vendorInteractionPanel.ts`, `worldSessionAreaView.ts`, and `worldSessionCursorFeedback.ts`
- [x] Removed the unused `computeClientSellPrice()` helper from `vendorInteractionPanel.ts` without changing buy/sell behavior
- [x] Removed the forbidden non-null assertion from the vendor Sell button handler by using the existing `onSell !== undefined` guard
- [x] Removed the unused `previousHoverTargetId` variable from `worldSessionAreaView.ts`
- [x] Removed the unused localization import from `worldSessionCursorFeedback.ts`
- [x] Preserved existing vendor buy/sell, world clickability, move-then-act, cursor feedback, inventory/equipment, combat feedback, rest area, and zoom behavior
- [x] No gameplay, UI, schema, or architecture changes introduced
- [x] `pnpm eslint apps/client/src/game/scenes/worldSession/vendorInteractionPanel.ts apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts apps/client/src/game/scenes/worldSession/worldSessionCursorFeedback.ts` — 0 errors, 0 warnings

## Task 323 — Stash Foundation: Add Persistent Character Stash Schema

- [x] Audited existing Prisma character / inventory / item instance persistence
- [x] Reused the existing `ItemInstance` structure instead of adding a second item table
- [x] Added `STASH` to Prisma `ItemLocationType`
- [x] Added minimal stash placement fields to `ItemInstance`: `stashPage`, `stashX`, `stashY`
- [x] Kept stash scoped to the owning character via existing `ownerCharacterId`
- [x] Preserved existing item definition id, quantity, and timestamps on the reused `ItemInstance` model
- [x] Added stash-aware item mapping support in the persistence mapper
- [x] Added basic stash list support in `ItemRepository`
- [x] Added Prisma migration for the stash schema foundation (`20260611120108_migrationn`)
- [x] No stash UI, no transfer flow, no account-wide stash, no vendor behavior changes

## Task 324 — Stash Foundation: Open Basic Town Stash Panel

- [x] Audited existing Nightmarket world props, town services, town interact flow, and item persistence for stash support
- [x] Reused the existing `nightmarket_stash_keeper_01` interactable and `nightmarket_stash_keeper` town service content
- [x] Added shared stash list response/rejection message types for room-driven stash listing
- [x] Wired `TownRoom` stash interaction to list persisted `STASH` items via `ItemRepository.listStashItems(characterId)`
- [x] Mapped persisted stash rows through the existing shared `ItemInstance` DTO mapper
- [x] Replaced the stash placeholder interaction with a basic localized stash panel on the client
- [x] Stash panel shows a localized title, a foundation-only notice, and an empty localized state
- [x] Stash panel lists persisted character stash items using existing item localization and stash page/position metadata
- [x] No inventory ↔ stash transfer, no drag/drop, no stash sorting/filtering, no account-wide stash

## Task 325 — WorldSession Zoom, Projection, and Camera Range Fix

- [x] Audited `apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts` zoom state, projection refresh, camera focus, pointer conversion, hover/click hit-tests, and entity render positioning after the Task 307 / Task 321 changes
- [x] Added explicit WorldSession camera zoom constants for minimum zoom, maximum zoom, default zoom, and zoom step
- [x] Expanded the zoom range to `0.55 .. 1.9` and reset the default zoom to `1.0` for a less cramped starting view with both wider gameplay visibility and closer character inspection
- [x] Updated zoom changes to force an immediate `refreshFromRoomState()` pass against the current room so zoom works while idle and does not depend on player movement or later Colyseus updates
- [x] Kept the refresh performance-safe by reusing the existing one-time listener registration and existing dirty-gated expensive rebuild path
- [x] Updated pointer-to-world conversion to use the current projection context directly instead of a stale outer projection mode value
- [x] Unified own-corpse hover/click hit-testing to use cached current corpse screen positions derived from the same active projection and offset as rendering
- [x] Preserved existing movement, combat, move-then-act, loot pickup, vendor, stash, inventory/equipment, rest area, cursor feedback, and area banner behavior
- [ ] Verification pending in runtime

## Task 327 — WorldSession Enemy Visibility, Culling, and Projection Sanity Fix

- [x] Audited `apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts` enemy render, projected screen position, camera offset, zoom refresh, hover/click hit-tests, labels, telegraphs, target markers, and floating damage anchor usage
- [x] Added a client-side visible-enemy rule so server-known enemies may remain in room state while only currently visible projected enemies are rendered and clickable on the client
- [x] Unified enemy render visibility, hover hit-test, click hit-test, skill targeting, telegraph anchor lookup, and floating damage lookup around the same live enemy projection snapshot map
- [x] Added a small viewport padding margin (`ENTITY_VIEWPORT_PADDING_PX = 36`) to reduce edge pop-in while still preventing offscreen waypoint-style enemy rendering
- [x] Hid offscreen enemy placeholders without destroying/recreating them, preserving the existing Task 307 performance guard against per-frame rebuild/listener churn
- [x] Cleared stale hovered/selected enemy state when an enemy leaves the currently visible projected set so offscreen enemies are not hoverable/clickable and do not keep stale targeting UI
- [x] Added guardrail comments documenting the difference between server-known enemies, client-rendered visible enemies, and client-clickable visible enemies
## Task 334 — Core 0.3 Playable Loop Hardening Audit

- [x] Audited the full Core 0.3 playable loop: login/enter world, Nightmarket spawn, notice board objective start, town → combat route, enemy kill progress, loot pickup, return route, objective turn-in reward, vendor buy/sell, stash store/take, waypoint activation/travel, reconnect/rejoin restoration
- [x] Audited objective persistence and reward duplication — confirmed `rewardGranted` is persisted before copper grant (Task 333E), rejoin scan correctly skips completed objectives, no duplicate reward path exists
- [x] Audited money/HUD refresh — confirmed `currency_picked_up` message is sent after vendor buy, sell, objective turn-in, and loot pickup; client `refreshAccountStateAfterPickup()` is called in all paths
- [x] Audited inventory refresh after vendor/stash — confirmed sell handler and stash store/take handlers update panel inventory after `/me` refresh; buy handler was missing this update (fixed)
- [x] Audited position persistence after route/waypoint — confirmed `CharacterService.updateCharacterLocation()` is called after both route and waypoint travel before sending accepted message
- [x] Audited camera/projection after travel — confirmed travel stays within same Nightmarket zone so existing camera/projection/culling logic applies; client receives new position via Colyseus schema sync
- [x] Audited offscreen enemy culling after travel — confirmed existing viewport culling and enemy aggro distance check handles the new position correctly after teleport
- [x] Audited interactable clickability — confirmed spacing pass (Task 328) preserved all interaction IDs and code paths; no clickability regressions found
- [x] Audited stale pending movement/action state — confirmed both route and waypoint handlers clear `hasMovementTarget` and `clearPendingAction()` before sending accepted message (guard comments added)
- [x] Audited reconnect/rejoin restoration — confirmed persisted objective state, character location, flask charges, and HP are all restored on rejoin via `buildTownPlayerPresence` and `applyTownRestRefill`
- [x] **Bug fix**: Vendor buy accepted handler now refreshes vendor panel sell inventory after account state refresh so the newly purchased item appears in the sell section immediately (was missing — sell handler already had this)
- [x] **Bug fix**: `currency_picked_up` client handler now only shows "Picked up X" notice when `gainedCopper > 0`, preventing a misleading "Picked up 0." notice after vendor buy operations
- [x] Added guard comments to route travel and waypoint travel handlers documenting why `hasMovementTarget` and `clearPendingAction` must be cleared immediately after teleport
- [x] `pnpm typecheck` — 0 errors across all 5 workspace projects
- [x] No schema/database changes, no new gameplay systems, no UI redesign

## Task 328 — Nightmarket Physical Scale and Content Spacing Pass

- [x] Audited Nightmarket content placement across `worldProps.ts`, `spawnPoints.ts`, `spawnZones.ts`, and `zones.ts`
- [x] Kept all existing Nightmarket content IDs stable while performing a data-only layout pass
- [x] Expanded the Nightmarket service cluster into a larger hub footprint by repositioning vendor, stash keeper, trainer, waypoint, notice board, and nearby support props
- [x] Moved low-priority ambient clutter away from core service click targets to reduce crowding around important interactables
- [x] Repositioned the Nightmarket spawn point so player arrival still lands naturally inside the enlarged hub
- [x] Repositioned safe-area and rest-area markers and enlarged `restAreaBounds` so the visual/service hub still reads coherently after the spacing pass
- [x] Shifted sewer approach labels, path markers, combat-edge props, and enemy pocket props outward so Nightmarket reads physically larger in-world
- [x] Moved Nightmarket enemy spawn pockets farther from town and farther from each other using content `spawnZones` only
- [x] Preserved existing vendor buy/sell, stash listing, rest area, notice interaction, combat, loot pickup, cursor feedback, zoom, and camera behavior by leaving interaction IDs and code paths unchanged
- [ ] Focused validation pending

## Task 329 — Stash Foundation: Server-Authoritative Inventory ↔ Stash Transfer

- [x] Audited existing inventory persistence, stash persistence, stash panel flow, and inventory placement rules
- [x] Added shared client/server room message contracts for inventory -> stash and stash -> inventory transfer
- [x] Added typed server-owned stash transfer rejection reasons and localized feedback keys
- [x] Implemented server-authoritative inventory -> stash validation and atomic location update
- [x] Implemented server-authoritative stash -> inventory validation and existing-grid-based placement resolution
- [x] Kept stash listing refresh on successful transfers by returning updated stash items through room messages
- [x] Refreshed client inventory/account state after successful transfers using the existing `/me` refresh path
- [x] Updated the stash panel with simple Store / Take actions (no drag/drop)
- [x] Kept scope limited: no stash tabs, no sorting/filtering, no account-wide stash, no schema changes
- [ ] Focused verification pending

## Task 338 — Waypoint Discovery: Unlock Destinations by Clicking Waypoints

- [x] Audited the current waypoint foundation from Tasks 330 and 336 in `waypointService.ts`, `TownRoom.ts`, content data, localization, and docs
- [x] Removed the auto-unlock behavior where opening the Nightmarket waypoint activated both destinations
- [x] Kept `nightmarket_waypoint_01` as the Nightmarket hub waypoint and made interaction activate only its own destination
- [x] Added a physical Blackwire combat-edge waypoint object with stable content id `nightmarket_waypoint_blackwire_combat_edge`
- [x] Reused the existing world-prop/interactable pattern (`kind: "waypoint"`) so the new object participates in the same server-authoritative interact flow
- [x] The server now validates the interacted waypoint object through the existing interactable registry and activates only the matched waypoint destination for the current character
- [x] The waypoint panel now opens from either waypoint object and lists only discovered/activated destinations
- [x] Locked destinations remain non-usable on the server: undiscovered travel still rejects with safe destination-unavailable feedback
- [x] Existing same-zone waypoint travel validation/persistence remains in place: destination existence, spawn-point validity, pending-action cleanup, live synced position update, and persisted character location update
- [x] Added localized discovery feedback for newly discovered vs already discovered waypoints and locked/unavailable destination attempts
- [ ] Focused verification pending

## Task 333D — Objective Foundation: Persist Notice Board Objective State

- [x] Audited current session-scoped objective fields on PlayerPresence (hasObjective, objectiveId, objectiveCompleted, objectiveRewardGranted — all present for Tasks 333A–333C)
- [x] Added `CharacterObjective` Prisma model to `apps/server/prisma/schema.prisma` with: characterId, objectiveId, currentProgress, requiredProgress, completed, rewardGranted, createdAt, updatedAt
- [x] Added committed Prisma migration `20260611210000_add_character_objective_state` with the new table, unique index on (characterId, objectiveId), and FK + cascade
- [x] Added Oppositive relation from `Character.objectives` to `CharacterObjective`
- [x] Created `apps/server/src/persistence/repositories/ObjectiveRepository.ts` with focused helpers:
  - [x] `findByCharacterAndObjective(characterId, objectiveId)` — returns state or null
  - [x] `create(characterId, objectiveId, requiredProgress)` — starts a new objective state record
  - [x] `updateProgress(characterId, objectiveId, newProgress)` — clamps and persists, sets completed when clamp reached
  - [x] `markCompleted(characterId, objectiveId)` — sets completed = true
  - [x] `markRewardGranted(characterId, objectiveId)` — sets rewardGranted = true
- [x] Exported `ObjectiveRepository` from `apps/server/src/persistence/repositories/index.ts`
- [x] Extended `BuildTownPlayerPresenceInput` in `buildPlayerPresence.ts` with optional `objectiveState` parameter
- [x] `buildTownPlayerPresence` now populates PlayerPresence objective fields from persisted state when present (including objectiveId, currentProgress, requiredProgress, completed, rewardGranted)
- [x] `TownRoom.onJoin` now loads persisted objective state by scanning the NOTICE_BOARD_OBJECTIVE_SEQUENCE for the first non-reward-granted record, then passes it to `buildTownPlayerPresence`
- [x] Extended `advanceObjectiveProgress` with optional `onPersistUpdate` callback that fires after in-memory progress is advanced
- [x] Both `registerAttackHandler` and `registerSkillSlotHandler` pass a fire-and-forget persistence callback to `advanceObjectiveProgress` that calls `ObjectiveRepository.updateProgress()`
- [x] Progress persists on every kill (fire-and-forget, not awaited)
- [x] Completed/ready-to-turn-in state survives reconnect/rejoin
- [x] Reward-granted state survives reconnect/rejoin
- [x] Rejoining after reward turn-in does not allow duplicate copper rewards (persisted `rewardGranted` prevents re-granting)
- [x] HUD still renders only real server-authored objective state (no change)
- [x] `pnpm typecheck` — 0 errors (server passes cleanly after objectiveState optional fix)
- [x] `pnpm lint` — pre-existing errors only (no unused function warnings after Task 333F removed `advanceNoticeBoardObjective`)
- [x] Added comments marking this as a foundation, not the final quest journal system
- [x] Updated `docs/CORE_BUILD_0_3_CHECKLIST.md`
- [x] Updated `docs/CORE_BUILD_0_3_RELEASE_NOTES.md`
- [x] No movement, combat, town route, vendor buy/sell, stash transfer, waypoint travel, loot pickup, rest area, cursor feedback, zoom, camera, or Nightmarket spacing changes

## Task 333F — Objective Foundation: Remove Legacy Auto-Reward Objective Helper

- [x] Audited `advanceNoticeBoardObjective` function — defined in `TownRoom.ts` but never called anywhere after Task 333B
- [x] Confirmed current objective flow uses `startNoticeBoardObjective` for starting, `advanceObjectiveProgress` for kill progress only, and notice board interaction for explicit turn-in and copper reward
- [x] Removed `advanceNoticeBoardObjective` function (57 lines of dead code including reward granting and copper persistence logic)
- [x] Removed stale comment referencing the old function in `registerAttackHandler`
- [x] Verified no auto-reward-on-kill path remains — kill handlers use `advanceObjectiveProgress` only (reward-free)
- [x] Objective start, kill progress, completion/ready state, explicit turn-in, and reward-granted persistence remain unchanged
- [x] No new objective features, no quest journal, no new rewards, no persistence model changes
- [x] No schema/database changes
- [x] No movement, combat, loot, town route, vendor buy/sell, stash transfer, waypoint travel, rest area, cursor feedback, zoom, camera, or Nightmarket spacing changes
- [x] Updated `docs/CORE_BUILD_0_3_CHECKLIST.md`
- [x] Updated `docs/CORE_BUILD_0_3_RELEASE_NOTES.md`

## Task 330 — Waypoint Foundation: Activate and Use Basic Town Waypoint

- [x] Audited existing `nightmarket_waypoint_01` content, town interactable initialization, interact validation, character position persistence, and TownRoom/player movement flow
- [x] Added shared waypoint contracts for client travel intent, waypoint panel open payload, travel accepted/rejected responses, and typed rejection reasons
- [x] Added character-scoped persistent waypoint activation support through Prisma `CharacterWaypointActivation`
- [x] Added committed Prisma migration `20260611150000_add_character_waypoint_activations`
- [x] Reused the existing Nightmarket waypoint interactable so interacting with `nightmarket_waypoint_01` activates it for the current character if needed
- [x] Added a real localized waypoint panel with title, available destinations, travel button, and empty-state handling
- [x] Added one conservative server-authoritative travel destination: Nightmarket Arrival (`nightmarket_waypoint_01` -> `nightmarket_spawn`)
- [x] Server validates current waypoint context, destination existence, activation/unlock state, and destination spawn position bounds before travel
- [x] Travel updates live player room state server-authoritatively by moving the synced player presence to the destination coordinates
- [x] Travel also persists character location immediately through the existing `CharacterService.updateCharacterLocation()` path
- [x] Added localized waypoint success and failure feedback
- [x] Kept scope limited: no world map, no minimap, no travel cost/cooldown, no combat-room routing, no portal/quest/stash/vendor redesign
- [ ] Focused verification pending
