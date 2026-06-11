# docs/CORE_BUILD_0_3_CHECKLIST.md — Core Build 0.3 Checklist

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
- [x] The old `advanceNoticeBoardObjective` function remains available but is no longer called from kill handlers; it still handles the completion+reward flow that will be used by a later task
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
- [x] Located the old advanceNoticeBoardObjective function — deliberately unused by kill handlers (commented), still available
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
- [ ] Focused verification pending

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
