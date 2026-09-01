# docs/CORE_BUILD_0_4_RELEASE_NOTES.md — Core Build 0.4 Release Notes

---

## Core 0.4 Planning Opened

**Date:** 2026-06-15
**Build:** Core Build 0.4
**Status:** Planning open
**Previous Build State:** Core Build 0.3 is now treated as **RC / bugfix-only**

### Summary

Core Build 0.4 is now opened as the next scoped build after the Core Build 0.3 playable-loop checkpoint.

The 0.4 theme is:

**Realm, Quest, and World Expansion Foundation**

The goal of 0.4 is to expand the shipped 0.3 playable loop into a more scalable foundation for:

- multiple areas,
- richer objectives,
- better travel/world progression,
- modest content growth,
- continued runtime hardening.

This is a scope-opening documentation milestone only. No runtime code, gameplay systems, schema changes, UI implementation, or new content implementation were added as part of this task.

### What changed in planning

- Added **`docs/CORE_BUILD_0_4_PLAN.md`** to define the build theme, goal, pillars, waves, risks, non-goals, and recommended implementation entry path.
- Added **`docs/CORE_BUILD_0_4_CHECKLIST.md`** to track the opened 0.4 planning scope and the future implementation waves.
- Added **`docs/CORE_BUILD_0_4_RELEASE_NOTES.md`** to record the 0.4 planning-open milestone.
- Updated the relevant 0.3 planning/status documentation so Core Build 0.3 is clearly framed as **Release Candidate / bugfix-only**.

### Core 0.4 Pillars

1. **Travel and realm foundation**
   - investigate CombatRoom / cross-zone / cross-room handoff
   - keep same-zone travel stable
   - prepare loading-overlay expectations for real transitions
   - no fake client-only teleport success

2. **Objective and quest foundation**
   - evolve the single-objective foundation toward a lightweight objective panel or quest journal
   - add at least one second objective
   - preserve server-authoritative progress/reward handling
   - avoid a full branching quest system

3. **World and waypoint progression**
   - expand the discovered waypoint model
   - improve lightweight world/waypoint panel clarity
   - consider a second real destination or small connected combat area
   - no full minimap unless later explicitly selected

4. **Content expansion**
   - add a small new combat pocket, sub-area, or connected zone candidate
   - add more enemy / loot / objective content through existing data-driven systems
   - improve readability and spacing where needed

5. **Town service polish**
   - improve vendor/stash readability and usability
   - keep vendor/stash systems simple and server-authoritative
   - no advanced economy or account-wide stash unless explicitly selected later

6. **Runtime hardening and playability**
   - protect the 0.3 loop from regressions
   - watch camera / projection / zoom / culling
   - watch objective persistence / reward duplication
   - watch waypoint discovery / travel persistence
   - watch Prisma migration readiness

### Candidate Waves

- **Wave 1:** planning, 0.3 freeze, runtime guardrails
- **Wave 2:** travel / realm investigation
- **Wave 3:** objective / journal expansion
- **Wave 4:** content / world expansion
- **Wave 5:** polish and RC closure

### Explicit non-goals

```text
no Vue / app-shell migration
no full class / skill overhaul
no pets / mounts / familiars
no professions
no housing
no guilds
no PvP
no large new zone
no full art pipeline
no full minimap / world map unless later selected as a focused 0.4 task
```

### Key risks carried into 0.4

- CombatRoom / cross-room handoff risk
- objective persistence complexity
- travel/loading state race conditions
- camera/projection regressions
- schema/migration drift
- AI task scope creep

### Recommended first implementation decision

The likely first implementation task after planning should be either:

1. **CombatRoom / cross-zone handoff investigation**, or
2. **Lightweight quest journal / objective panel foundation**

The default recommendation is to start with **CombatRoom / cross-zone handoff investigation** because it resolves the largest architectural uncertainty in the 0.4 scope.

### Build-state note

Core Build 0.4 should be understood as a **controlled expansion build**.

It is broader than 0.3, but it is not intended to replace or destabilize the shipped 0.3 loop. The existing playable loop remains the baseline that 0.4 must preserve while extending the game toward broader realm, objective, and world progression foundations.

---

## Task 355 — Waypoint discovery presentation and overlay spacing polish

**Date:** 2026-09-01
**Status:** Implemented

### Summary

Closed out the remaining Wave 4 items by expanding how waypoint/world progression is presented and applying a small readability/spacing pass to the world-session overlay, without introducing any new travel systems, waypoints, or a minimap.

### What changed

- **`packages/shared/src/room/WaypointTypes.ts`**: Added a `discovered: boolean` field to `WaypointDestinationEntry`.
- **`apps/server/src/realtime/rooms/waypointService.ts`**: `buildWaypointDestinations` now always returns the full waypoint catalog (previously it silently dropped any waypoint the character had not yet activated), tagging each entry with `discovered` from the same activation data already used to gate travel. Travel approval/rejection rules on `request_waypoint_travel` are unchanged.
- **`apps/client/src/game/scenes/worldSession/waypointInteractionPanel.ts`**:
  - Added a discovery progress readout (`Waypoints discovered: X/Y`).
  - Undiscovered destinations now render as a locked row (`???`, dashed border, no Travel button) instead of being omitted from the list entirely, so players can see there is more to find.
- **`packages/localization/src/locales/en.ts`** and **`LocaleTypes.ts`**: Added `town_service.waypoint.progress` and `town_service.waypoint.undiscovered` keys.
- **`apps/client/src/game/scenes/worldSession/worldSessionOverlayView.ts`**: Widened the character status chip's padding (`5px 8px` → `8px 10px`) and the gap between its stacked text lines (`1px` → `3px`), which were visibly tighter than the rest of the overlay.
- **`apps/client/src/game/scenes/worldSession/noticeBoardInteractionPanel.ts`**: Increased objective row padding/gap for readability.

### Constraints preserved

- No minimap/world map was introduced.
- No new waypoints, destinations, or travel rules were added — this is presentation-only for the existing two-waypoint catalog (`nightmarket_waypoint_01`, `nightmarket_waypoint_blackwire_combat_edge`).
- Waypoint travel remains server-authoritative; the client cannot request travel to an undiscovered destination (the panel does not render a Travel button for it, and the server still rejects unactivated destinations via `destination_not_activated`).
- The spacing pass only touched the two panels found to be visibly cramped relative to the rest of the overlay; it did not restyle the whole HUD.

### Verification

- `pnpm typecheck` — 0 errors.

---

## Task 344 — Conservative CombatRoom → TownRoom return handoff skeleton

**Date:** 2026-06-15
**Status:** Implemented

### Summary

Added the smallest safe Core 0.4 return path from `CombatRoom` back to `TownRoom`, mirroring the Task 343 leave-and-join handoff style without generalizing the full travel system.

### What changed

- Added a dedicated conservative `request_combat_return` client/server message path.
- Added `combat_town_return_approved` / `combat_town_return_rejected` server messages so the client can reuse the existing leave-and-join room handoff behavior.
- Implemented a `CombatRoom` return validator that accepts only the controlled Nightmarket return target and safely rejects duplicate, invalid, or not-ready requests.
- Reused `CharacterService.updateCharacterRoomIntent()` so return approval persists intended town destination, HP, and flask state before the combat room is left.
- Reused the existing room join infrastructure on the client to leave `CombatRoom` and rejoin `TownRoom` with the approved target zone.
- Reused the travel overlay pattern with a conservative `return_handoff` copy variant instead of introducing a larger transition framework.
- Added a temporary combat-only “Return to Town” control in the world-session overlay as the minimal sanctioned return trigger.

### Constraints preserved

- No generalized cross-zone travel system was introduced.
- No client authority over destination approval was added.
- No same-room repositioning shortcut was used; return remains leave-and-join semantics.
- Existing objective, inventory, and loot persistence flows were not reset or intentionally broadened.
- Existing 0.3 town loop behavior stayed on its prior path outside the controlled combat return handoff.

### Verification

- `pnpm typecheck`

---

## Task 353 — Blackwire Sewers combat content pass

**Date:** 2026-06-16
**Status:** Implemented

### Summary

Turned the current Blackwire Sewers `CombatRoom` from a mostly handoff/return test area into a small conservative playable combat space for Core 0.4 by moving it onto existing content-driven spawn definitions and reusing the current server-authoritative enemy defeat reward flow.

### What changed

- **`packages/content/src/data/spawnZones.ts`**: added a small Blackwire Sewers enemy pocket layout with two runt pockets, one skitter pocket, and one deeper brute anchor pocket.
- **`packages/content/src/data/zones.ts`**: expanded `blackwire_sewers.enemyIds` to the already-existing sewer enemy archetypes used by the new spawn pockets.
- **`apps/server/src/realtime/rooms/initializeCombatEnemies.ts`**: replaced the temporary fixed 3-runt spawn box logic with content-driven combat enemy initialization sourced from `contentRegistry.spawnZones`, while keeping the deterministic server-owned spawn pattern.
- **`apps/server/src/realtime/rooms/CombatRoomState.ts`**: added synced `worldLoot` state so combat drops can use the same room-state shape the client already understands.
- **`apps/server/src/realtime/rooms/CombatRoom.ts`**:
  - reused the existing server-authoritative XP progression path for enemy defeats,
  - reused the existing world-loot spawn and pickup pipeline,
  - reused the existing objective progress hook so kill objectives advance naturally in combat,
  - preserved the physical return gate and the existing leave-and-join handoff/reconnect model.

### Constraints preserved

- No new enemy AI, skill systems, loot systems, or combat mechanics were introduced.
- No client authority over damage, kills, XP, loot, or objective progress was added.
- No broad `CombatRoom` architecture refactor or generalized travel system was introduced.
- Existing Task 345 reconnect/recovery behavior and Task 346 physical return-gate behavior remain on their current conservative path.

### Verification

- Pending targeted `pnpm typecheck`

---

## Task 350 — Minimal Level and XP Display Polish

**Date:** 2026-06-15
**Status:** Implemented

### Summary

Added minimal client-facing level/XP display polish to the world session overlay so the player can see current level and XP after reconnect, objective rewards, enemy XP gains, and TownRoom ↔ CombatRoom handoffs.

### What changed

- Added `character.xp` and `world_session.level_xp_format` localization keys to `packages/localization/src/locales/en.ts` and `REQUIRED_LOCALIZATION_KEYS` in `packages/localization/src/LocaleTypes.ts`.
- Updated the character chip subtitle (the small card in the status overlay) to display `displayName • Level X • XP Y` using the new `world_session.level_xp_format` key, with both level and XP values sourced from the real Colyseus player presence state.
- Updated the HUD section's level/XP `createMiniHudStat` element to use the localized `t("character.xp")` label instead of a hardcoded `"XP"` string.
- Level and XP display is sourced from `PlayerPresence` (Colyseus schema synced by the server) and falls back to `CharacterSummary.level` / `CharacterSummary.xp` (persisted character state) on reconnect.
- Existing `xp_gained` client message handler already calls `this.renderOverlay()` and shows level-up notices; the display now updates automatically through the Colyseus schema sync and overlay re-render cycle.
- TownRoom ↔ CombatRoom handoff preserves level/XP because `PlayerPresence.level` and `PlayerPresence.xp` are populated from the persisted database character record on every room join.
- Reconnect restores level/XP through the existing `scene.restart()` re-initialization path, which reads presence from the freshly joined room.
- No new progression systems, skill points, stat allocation, character sheet, balance work, or XP storage were introduced.

### Constraints preserved

- No new XP storage.
- No new level progression math.
- No skill points, attributes, stat allocation, passive trees, class trees, respec, or hotbar skills.
- No full character sheet.
- No balancing work.
- No refactor of the full progression system.
- No movement of XP/level authority to the client.
- No change to objective reward logic beyond UI refresh if needed.

### Verification

- `pnpm typecheck`

---

## Task 352 — Prevent completed objective replay from notice board catalog

**Date:** 2026-06-15
**Status:** Implemented

### Summary

Hardened the notice board objective catalog so completed non-repeatable objectives are no longer offered as startable objectives and cannot be restarted through forged or stale client requests. Objective availability now follows the persisted completed-objective history foundation from Task 351, while the completed section of the Objective Book, active objective flow, progress updates, turn-in behavior, and first-time XP/copper rewards remain on their existing server-authoritative paths.

### What changed

- **`packages/content/src/data/types.ts`**: added optional `repeatable?: boolean` to `ObjectiveContentDefinition` for future expansion. Core 0.4 still treats omitted values as non-repeatable by default.
- **`apps/server/src/realtime/rooms/TownRoom.ts`**:
  - added small helpers to parse completed objective ids from authoritative player presence,
  - built notice board catalog entries from server-owned availability instead of exposing every sequence entry,
  - filtered completed non-repeatable objectives out of the notice board catalog,
  - rejected `request_start_board_objective` when the requested objective is already completed and non-repeatable,
  - preserved existing active-objective, progress, turn-in, and reward flows.
- **`packages/shared/src/protocol/ServerMessages.ts`**: defined an explicit safe rejection reason set for `request_start_board_objective_rejected`, including `objective_already_completed`.
- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: mapped the new safe rejection reason to a player-facing notice without giving replay authority to the client.

### Constraints preserved

- No repeatable objectives, daily quests, quest chains, multiple simultaneous active objectives, or full quest-journal refactor.
- No client authority over replayability or start availability.
- No change to TownRoom ↔ CombatRoom handoff behavior.
- Completed objectives remain visible in the Objective Book completed section.
- Existing XP/copper rewards still apply only to valid first-time completion/turn-in.

### Verification

- Pending targeted `pnpm typecheck`

---

## Task 347 — Lightweight objective panel foundation

**Date:** 2026-06-15
**Status:** Implemented

### Summary

Added a lightweight objective-panel foundation for Core 0.4 by extending the existing world-session overlay with a small toggleable objective book, while preserving the current server-authoritative notice board objective flow.

### What changed

- Added a small objective panel section inside the existing world-session utility overlay instead of introducing a full quest journal.
- Added a keyboard toggle (`J`) that opens/closes the objective panel when the world session is active.
- Reused existing authoritative objective presence data to display objective title, localized description, progress, and completion / ready-to-turn-in state.
- Kept notice board start, progress, completion, and turn-in behavior on the existing server-owned path; the client still cannot mark objectives complete directly.
- Extended `CombatRoom` join restoration to load the same persisted objective state used by `TownRoom`, so objective display remains valid across reconnect and TownRoom ↔ CombatRoom handoff.

### Constraints preserved

- No full quest journal, branching quest system, category/filter UI, or objective-history system was introduced.
- No client authority over objective progress, completion, or rewards was added.
- Existing notice board behavior stayed on its prior server-authoritative path.
- Existing single-objective persistence model was reused conservatively rather than refactored into a larger quest system.

### Verification

- `pnpm typecheck` — 0 errors.

---

## Task 354 — Objective ready-to-turn-in guidance polish

**Date:** 2026-06-16
**Status:** Implemented

### Summary

Improved player-facing guidance when an active objective becomes complete and ready to turn in. The existing single-objective notice board flow remains server-authoritative, but the client now gives clearer room-specific direction and the Objective Book distinguishes ready-to-turn-in objectives from in-progress ones more clearly.

### What changed

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: preserved the existing objective update flow while explicitly carrying the server-owned `readyToTurnIn` flag when an active objective is completed but not yet turned in.
- **`apps/server/src/realtime/rooms/CombatRoom.ts`**: forwarded the same `readyToTurnIn` flag from combat-side objective progress updates so the client receives the completed/awaiting-turn-in transition immediately in Blackwire Sewers.
- **`apps/client/src/net/interactResponseClient.ts`**: now preserves `readyToTurnIn`, `xpReward`, and `copperReward` from `objective_updated` messages instead of dropping them client-side.
- **`apps/client/src/game/scenes/WorldSessionScene.ts`**:
  - detects the transition into ready-to-turn-in state,
  - shows clearer objective-complete notices,
  - uses room-specific guidance so combat completion tells the player to return to Nightmarket and town completion tells the player to interact with the notice board,
  - avoids spamming duplicate completion guidance for the same objective.
- **`apps/client/src/game/scenes/worldSession/worldSessionOverlayView.ts`**: updated the Objective Book active-objective card so ready-to-turn-in objectives are visually distinct from in-progress objectives and show a dedicated turn-in hint.
- **`packages/localization/src/locales/en.ts`** and **`packages/localization/src/LocaleTypes.ts`**: added required localized strings for the new ready-to-turn-in guidance and Objective Book hint text.

### Constraints preserved

- No map markers, quest arrows, pathfinding hints, minimap, world map, quest chains, or full quest journal were introduced.
- No client authority over objective completion, reward grant, or turn-in was added.
- Existing notice board turn-in behavior remains on the current server-owned path.
- Completed objective history behavior from Task 351 remains unchanged after reward turn-in.
- Replay prevention behavior from Task 352 remains unchanged.
- TownRoom ↔ CombatRoom handoff behavior was not broadened.

### Verification

- Pending targeted `pnpm typecheck`

---

## Task 348 — Notice board objective catalog foundation

**Date:** 2026-06-15
**Status:** Implemented

### Summary

Expanded the current single-objective notice board flow into a small data-driven objective catalog foundation. The notice board now returns a list of available objectives from the content registry when the player has no active objective, and the player selects which one to start by sending a dedicated `request_start_board_objective` message. The existing conservative one-active-objective runtime rule, server-authoritative start/progress/turn-in, and reconnect/CombatRoom handoff behavior are preserved.

### What changed

- **`packages/content/src/data/types.ts`**: Extended `ObjectiveId` with `"sewer_cleanup"`.
- **`packages/content/src/data/objectives.ts`**: Added `sewer_cleanup` objective entry (kill 5 trashboars, 8 XP, 5 copper) using existing content patterns. Added the new ID to `NOTICE_BOARD_OBJECTIVE_SEQUENCE`.
- **`packages/localization/src/LocaleTypes.ts`**: Added `objective.choose_objective`, `objective.sewer_cleanup.title`, `objective.sewer_cleanup.description` to required keys.
- **`packages/localization/src/locales/en.ts`**: Added English translations for the new keys.
- **`packages/shared/src/protocol/ClientMessages.ts`**: Added `RequestStartBoardObjectiveClientMessage` type and included it in the `ClientRoomMessage` union.
- **`packages/shared/src/protocol/ServerMessages.ts`**: Extended `InteractResponseServerMessage` with optional `availableObjectives` field carrying the catalog entries.
- **`apps/server/src/realtime/rooms/TownRoom.ts`**:
  - Notice board interact handler now returns available objectives via `availableObjectives` on `interact_response` when the player has no active objective (instead of auto-starting the next in sequence).
  - Added `request_start_board_objective` message handler that validates the requested objective ID against the content registry, checks for existing incompatible active objective, and starts the selected objective with the same persistence flow as the old auto-start path.
  - Added `startBoardObjectiveHandlerRegistered` guard flag.

### Constraints preserved

- No full quest journal, multiple-active-objective support, quest categories, filters, lore pages, NPC dialogue trees, map markers, or quest chains were introduced.
- No client authority over objective progress, completion, or rewards was added.
- Turn-in, progress, completion, reconnect restoration, and CombatRoom handoff continue on the existing conservative path.
- The existing single-objective runtime model was not broadened.

### Verification

- `pnpm typecheck` — 0 errors.

---

## Task 349 — Minimal character XP reward foundation

**Date:** 2026-06-15
**Status:** Implemented

### Summary

Added the smallest real character XP foundation needed to support objective rewards. Objectives with XP rewards now award persisted character XP through the existing server-authoritative `grantFlatXpReward` progression path, reusing the enemy-defeat XP infrastructure already in `TownRoom`.

### What changed

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: Objective turn-in now calls `grantFlatXpReward` after copper is granted, using the objective's `xpReward` from the content definition. The turn-in message text was updated to use the appropriate localization key based on which rewards are present (`turn_in_complete_reward`, `turn_in_complete_reward_xp_only`, or `turn_in_complete_reward_copper_only`).

### Infrastructure already in place (no changes needed)

- Prisma `Character` model already had `level` and `xp` columns (default 1 and 0).
- `CharacterSummary` shared type already had `level` and `xp` fields.
- `CharacterMapper` already mapped `level` and `xp` from the database.
- `CharacterRepository.updateXpAndLevel` and `updateProgressionState` already existed.
- `PlayerPresence` Colyseus schema already had `level` and `xp` fields.
- `buildTownPlayerPresence` and `buildCombatPlayerPresence` already populated level/xp from persisted character data on join.
- `tryResolveLevelProgression` and `applyProgressionUpdate` already existed for enemy-defeat XP.
- Client `WorldSessionScene` already handled `xp_gained` messages.
- Localization keys `objective.turn_in_complete_reward`, `objective.turn_in_complete_reward_xp_only`, and `objective.turn_in_complete_reward_copper_only` already existed.

### XP safety properties

- `rewardGranted = true` is persisted to the DB before XP is granted, preventing duplicate XP on crash/reconnect.
- The guard `!player.objectiveRewardGranted` prevents re-entry into the turn-in block.
- XP persists to the database through the existing `applyProgressionUpdate` → `updateProgressionState` path.
- XP survives reconnect: the character mapper returns `level` and `xp` from the `Character` model.
- XP survives TownRoom ↔ CombatRoom handoff: both room join paths populate `PlayerPresence.level` and `PlayerPresence.xp` from persisted character data.
- Copper reward behavior is unchanged.

### Constraints preserved

- No level-up logic, skill points, stats, class progression, or full character sheet was introduced.
- No XP from monster kills was added to `CombatRoom` (that remains separate scope).
- No progression balancing was done.
- The full objective system was not refactored.
- Reward authority stays server-side.

### Verification

- `pnpm typecheck` — 0 errors.

---

## Task 351 — Completed objective history foundation

**Date:** 2026-06-15
**Status:** Implemented

### Summary

Added the smallest persistent completed-objective history foundation needed for the lightweight Objective Book. Completed objectives are now restored from server-owned persistence after reconnect, remain visible through TownRoom ↔ CombatRoom handoff, and are rendered in a dedicated completed section without introducing a full quest journal or multiple-active-objective system.

### What changed

- **`apps/server/prisma/schema.prisma`**: Extended `CharacterObjective` with optional `completedAt` for conservative completion-history tracking.
- **`apps/server/src/persistence/repositories/ObjectiveRepository.ts`**:
  - Added `findCompletedByCharacter(characterId)` to list completed-and-rewarded objectives.
  - Updated `markRewardGranted()` to persist `completedAt` when reward turn-in is recorded.
- **`apps/server/src/realtime/rooms/PlayerPresence.ts`**: Added synced completed-history presence fields (`completedObjectiveIds`, `completedObjectiveTitles`).
- **`apps/server/src/realtime/rooms/buildPlayerPresence.ts`** and **`buildCombatPlayerPresence.ts`**: Populate completed objective history from persisted DB state on join.
- **`apps/server/src/realtime/rooms/TownRoom.ts`**:
  - Loads completed objective history during join.
  - Appends the just-turned-in objective to synced completed history after authoritative reward turn-in succeeds.
- **`apps/server/src/realtime/rooms/CombatRoom.ts`**: Loads the same completed objective history during combat-room join so the Objective Book stays populated after room handoff.
- **`apps/client/src/net/townRoomPresence.ts`**: Extracts completed objective history from synced presence into client-safe view data.
- **`apps/client/src/game/scenes/worldSession/worldSessionOverlayView.ts`**:
  - Objective Book now renders a **Current Objective** section.
  - Added a **Completed Objectives** section with a dedicated empty state.
  - Preserved the current active-objective rendering and turn-in state behavior.
- **`packages/localization/src/locales/en.ts`** and **`packages/localization/src/LocaleTypes.ts`**: Added/required localization keys for the new completed-history Objective Book sections.

### Constraints preserved

- No full quest journal, category/filter UI, lore pages, quest chains, or multiple simultaneous objectives were introduced.
- Notice board catalog selection flow from Task 348 remains unchanged.
- Objective completion and reward history remain server-authoritative; the client cannot forge completed objectives.
- TownRoom ↔ CombatRoom handoff behavior was not broadened beyond restoring and displaying existing completed history.

### Verification

- Pending final repo verification: Prisma migration/generate and project checks.

---

## Task 346 — Physical CombatRoom return gate

**Date:** 2026-06-15
**Status:** Implemented

### Summary

Replaced the temporary combat-only `Return to Town` overlay button with a minimal physical in-world return trigger inside `CombatRoom`, while preserving the existing server-authoritative `CombatRoom` → `TownRoom` leave-and-join handoff from Task 344.

### What changed

- Added a data-driven `combat_return_gate` world prop for `blackwire_sewers` at a fixed visible coordinate as the single approved CombatRoom return trigger.
- Extended `CombatRoomState` with synced interactables and initialized the combat return gate through a dedicated `initializeCombatInteractables()` helper so the room shell stays orchestration-focused.
- Reused the existing `request_combat_return` message path, but now validated the clicked in-world interactable instead of relying on a temporary overlay control.
- Preserved server-side approval rules: only the approved trigger id/type is accepted, invalid triggers are rejected, duplicate pending requests are rejected, and the Nightmarket return spawn stays server-owned (`nightmarket_blackwire_combat_entry`).
- Updated client world rendering so the combat return trigger is visible with placeholder interactable visuals and label text.
- Removed the temporary combat-only `Return to Town` overlay button from the world-session overlay path; combat return now comes from physical world interaction.
- Reused the existing `return_handoff` travel overlay and conservative leave-then-join recovery path from Tasks 344–345.

### Constraints preserved

- No generalized cross-zone travel system or portal system was introduced.
- No client authority over destination identity, approval, or spawn coordinates was added.
- Existing TownRoom waypoint and route behavior stayed on their previous paths.
- Existing interrupted-handoff recovery behavior from Task 345 remained in place.
- CombatRoom content was only expanded enough to support the return trigger.

### Verification

- `pnpm typecheck`

---

## Task 345 — Handoff reconnect and failure recovery hardening

**Date:** 2026-06-15
**Status:** Implemented

### Summary

Hardened the conservative Core 0.4 `TownRoom` ↔ `CombatRoom` leave-and-join handoff so reconnects, stale persisted room intent, interrupted loading-overlay transitions, and failed target-room joins recover to a valid server-approved state instead of silently stranding the character.

### What changed

- Added reconnect-aware client room selection so the account shell joins the persisted server-approved room kind (`town` or `combat`) instead of always assuming a town join.
- Added a shared client resolver for persisted zone → room-kind routing, keeping the room choice aligned with server-owned `currentZoneId` intent.
- Hardened `RoomJoinValidationService` so persisted/current join intent is checked against the requested room kind and content-backed zone metadata before allowing the join path to proceed.
- Added conservative stale-intent repair: invalid or mismatched persisted room/zone intent now falls back to a safe Nightmarket state instead of leaving reconnect in an unusable transition state.
- Updated successful `TownRoom` and `CombatRoom` joins to refresh the character’s current room-zone intent after the approved room is actually entered.
- Added interrupted-handoff client recovery in `WorldSessionScene`: if the second room join fails after leaving the source room, the client now refreshes real account state, attempts to rejoin the latest persisted valid room, and finally falls back to a safe Nightmarket join if needed.
- Replaced silent overlay dead-end behavior with explicit failure/recovery feedback during interrupted handoffs.

### Recovery rules now covered

- Reconnect after approved `TownRoom` → `CombatRoom` handoff can resume into the persisted valid combat target.
- Reconnect after approved `CombatRoom` → `TownRoom` return can resume into the persisted valid town target.
- Browser refresh during the loading overlay can recover through persisted room intent instead of always forcing a broken town-only path.
- Invalid or stale persisted room intent falls back to a safe Nightmarket join.
- Failed target-room joins no longer leave the client frozen on the travel overlay; recovery attempts are explicit and conservative.
- Duplicate transition requests remain safely rejected by the existing room-side guards.

### Constraints preserved

- No generalized realm travel system was introduced.
- No dedicated transition table/token/session-migration system was added.
- No client authority over destination identity, target room, or target coordinates was introduced.
- Existing same-zone waypoint travel remains on the prior same-room path.
- Existing objective, HP/flask, inventory, stash, and currency persistence flows were preserved rather than broadened.

### Known remaining limitation

- This is still a conservative leave-and-join recovery model. It repairs/reuses persisted character zone/location/runtime state, but it does not provide seamless mid-transition room migration or a dedicated durable transition record.

### Verification

- `pnpm typecheck`