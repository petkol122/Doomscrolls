# docs/CORE_BUILD_0_4_CHECKLIST.md — Core Build 0.4 Checklist

---

## Core 0.4 Planning Open Checklist

**Date:** 2026-06-15
**Build:** Core Build 0.4
**Theme:** Realm, Quest, and World Expansion Foundation
**Status:** Waves 1-4 shipped (Tasks 342-355). Wave 5 hardening audit explicitly skipped by product decision (2026-09-01) to move faster into Core Build 0.5. **Core Build 0.4 is now RC / bugfix-only.** Core Build 0.5 planning is open — see [`docs/CORE_BUILD_0_5_PLAN.md`](./CORE_BUILD_0_5_PLAN.md).

### Planning Deliverables

- [x] Create `docs/CORE_BUILD_0_4_PLAN.md`
- [x] Create `docs/CORE_BUILD_0_4_CHECKLIST.md`
- [x] Create `docs/CORE_BUILD_0_4_RELEASE_NOTES.md`
- [x] Mark Core Build 0.3 as RC / bugfix-only in relevant 0.3 docs
- [x] Define Core Build 0.4 theme
- [x] Define Core Build 0.4 goal
- [x] Define Core Build 0.4 feature pillars
- [x] Define candidate task waves
- [x] Define explicit 0.4 non-goals
- [x] Define the 0.4 risk list
- [x] Define the recommended first implementation decision path

### Core 0.4 Scope Guardrails

- [x] 0.4 is explicitly framed as building on the shipped 0.3 playable loop
- [x] 0.4 is broader than 0.3 but still controlled
- [x] Travel/realm work requires real server-authoritative transitions
- [x] Objective/quest work preserves server-authoritative progress and rewards
- [x] World/waypoint work avoids committing to a full minimap/world map by default
- [x] Town-service polish remains simple and server-authoritative
- [x] Runtime hardening remains part of the build framing

### Candidate Wave Checklist

#### Wave 1 — Planning, 0.3 Freeze, Runtime Guardrails

- [ ] Finalize 0.4 implementation entry task
- [ ] Reconfirm 0.3 regression watchlist before 0.4 runtime work
- [ ] Reconfirm camera / projection / zoom / culling watchpoints
- [ ] Reconfirm objective persistence / reward duplication watchpoints
- [ ] Reconfirm waypoint discovery / travel persistence watchpoints

#### Wave 2 — Travel / Realm Investigation

- [x] Investigate CombatRoom / cross-zone / cross-room handoff feasibility
- [x] Define the first safe real transition path
- [x] Define real loading/transition overlay expectations
- [x] Preserve same-zone travel stability while broader travel work is explored

Task 342 status note:

- [x] `docs/CORE_BUILD_0_4_HANDOFF_INVESTIGATION.md` documents the current 0.3 TownRoom/CombatRoom/session architecture, current same-room waypoint/route travel, current persistence boundaries (location, HP, flask, objective state, inventory/vendor/stash assumptions), and a minimal server-authoritative handoff recommendation for future TownRoom → CombatRoom or cross-zone travel.
- [x] The investigation concludes that current 0.3 “travel” inside `WorldSessionScene` is same-room repositioning with a loading overlay, not a real room join, and recommends a conservative validated leave + target-room join as the first safe 0.4 implementation path.

Task 343 status note:

- [x] Reused the existing `nightmarket_blackwire_gate_01` route trigger as the single conservative TownRoom → CombatRoom handoff entry.
- [x] Kept waypoint travel and the Nightmarket return route on the existing same-room path; only the Blackwire gate now approves a room handoff.
- [x] Added a minimal server-authoritative handoff approval/rejection payload so the client can leave `TownRoom` and join `CombatRoom` through the existing room join contract.
- [x] Persisted intended combat-zone room state through the existing character persistence path before leaving town (`currentZoneId` + last location + HP/flask state).
- [x] Reused the existing travel/loading overlay for the leave-and-join handoff path rather than adding a new broad transition system.
- [x] Focused runtime/typecheck verification passed via `pnpm typecheck`.

Task 344 status note:

- [x] Added one conservative server-authoritative `CombatRoom` → `TownRoom` return trigger through a dedicated `request_combat_return` message path instead of broadening the travel system.
- [x] Validated the only supported return target on the server (`nightmarket` via the approved `nightmarket_blackwire_combat_entry` spawn), with safe rejection for invalid, duplicate, stale, or not-ready requests.
- [x] Persisted intended town return state through the existing character room-intent path before leaving combat (`currentZoneId` + last location + HP/flask state), leaving objective/inventory/loot persistence flows intact.
- [x] Reused the existing leave-and-join room handoff approach and loading overlay pattern so the client leaves `CombatRoom` and rejoins `TownRoom` through the existing room join contract.
- [x] Added a conservative in-session return control for combat sessions only; this is a temporary controlled return affordance, not generalized cross-zone travel.
- [x] Focused runtime/typecheck verification passed via `pnpm typecheck`.

Task 345 status note:

- [x] Hardened reconnect behavior so a persisted valid combat intent can resume into the approved target room instead of always forcing a town join from the account shell.
- [x] Added conservative server-side join-intent repair so invalid or stale persisted room/zone intent falls back to a safe Nightmarket path instead of leaving the character stranded in an unusable state.
- [x] Kept join approval server-authoritative: client room selection now follows persisted server-owned zone intent rather than inventing a destination.
- [x] Added client-side interrupted-handoff recovery so failed leave-and-join room transitions attempt to rejoin the latest persisted valid room and otherwise fall back to a safe Nightmarket join with visible feedback.
- [x] Preserved same-zone waypoint/route travel behavior outside the controlled room-handoff cases.
- [x] Focused runtime/typecheck verification passed via `pnpm typecheck`.
- [ ] Remaining limitation: this is still a conservative leave-and-join handoff without a dedicated transition record/token, so recovery is based on repaired persisted character zone/location state rather than seamless mid-transition session migration.

Task 346 status note:

- [x] Replaced the temporary combat-only overlay return affordance with one visible physical `CombatRoom` return trigger synced through room state.
- [x] Added a small data-driven `combat_return_gate` world prop in `blackwire_sewers` at a fixed coordinate and rendered it with existing placeholder interactable visuals/labels.
- [x] Reused the existing `request_combat_return` protocol path and preserved server-side approval rules: only the approved trigger id is accepted, invalid ids are rejected, duplicate pending requests are rejected, and the approved Nightmarket spawn remains server-owned.
- [x] Updated combat-session client interaction so clicking the in-world return gate drives the existing conservative leave-and-join handoff and reuses the `return_handoff` loading overlay.
- [x] Removed the temporary combat-only `Return to Town` overlay button from normal play; return now goes through the physical trigger.
- [x] Focused runtime/typecheck verification passed via `pnpm typecheck`.

#### Wave 3 — Objective / Journal Expansion

- [x] Define lightweight objective panel / quest journal scope
- [x] Add at least one second real objective
- [x] Preserve server-authoritative progress/reward handling
- [x] Avoid branching/full quest-system expansion

Task 347 status note:

- [x] Added a lightweight objective panel toggle in the existing world-session overlay instead of introducing a full quest journal.
- [x] Reused existing server-authoritative single-objective presence data for title, description, progress, and ready-to-turn-in state.
- [x] Preserved the existing notice board start/progress/turn-in behavior and client inability to mark objectives complete directly.
- [x] Restored persisted objective state onto `CombatRoom` player presence as well, keeping objective display valid across reconnect and TownRoom ↔ CombatRoom handoff.
- [x] Second real objective/content expansion remains separate follow-up work.

Task 348 status note:

- [x] Expanded the notice board from a fixed auto-start-next sequence into a selectable objective catalog foundation.
- [x] Defined a small catalog/list shape for available objectives; server returns available entries via the existing `interact_response` message with a new `availableObjectives` field.
- [x] Added a third data-driven objective `sewer_cleanup` (kill 5 trashboars) using existing content patterns.
- [x] Notice board interact handler now returns available objectives (entries from the content registry) when the player has no active objective, instead of auto-starting the next in sequence.
- [x] Client notice board UI now receives the `availableObjectives` payload and displays a selectable list of objective entries.
- [x] Added a new shared client message `RequestStartBoardObjectiveClientMessage` so the player can click/tap an available objective to start it.
- [x] Added a server-side `request_start_board_objective` message handler in `TownRoom` that validates the requested objective ID exists in the content registry, the player has no incompatible active objective, and the start conditions are satisfied.
- [x] On valid start request, the server calls `startNoticeBoardObjective` and persists the `CharacterObjective` row (same flow as the old auto-start path).
- [x] Turn-in, progress, completion, reconnect restoration, and CombatRoom handoff continue on the existing conservative one-active-objective path.
- [x] Localization keys: added `objective.choose_objective` and `objective.sewer_cleanup.*` (title + description).
- [x] Content type `ObjectiveId` extended with `"sewer_cleanup"`.
- [x] Added the `sewer_cleanup` entry to `NOTICE_BOARD_OBJECTIVE_SEQUENCE` so the catalog shows all three current objectives.
- [x] No full quest journal, multiple-active-objective support, quest categories, filters, lore pages, NPC dialogue trees, map markers, or quest chains were introduced.
- [x] `pnpm typecheck` — 0 errors.

Task 349 status note:

- [x] Objective turn-in now awards XP through the server-authoritative `grantFlatXpReward` progression path, reusing the existing enemy-defeat XP infrastructure.
- [x] XP reward is persisted to the database via `applyProgressionUpdate` → `updateProgressionState` after the `rewardGranted` flag is already saved, preventing duplicate XP on crash/reconnect.
- [x] XP persists after reconnect: `CharacterSummary` already includes `level` and `xp` fields, the Prisma `Character` model already has `level` and `xp` columns, and the character mapper already maps them.
- [x] XP remains valid after TownRoom ↔ CombatRoom handoff: `PlayerPresence` already has `level` and `xp` fields, `buildTownPlayerPresence` and `buildCombatPlayerPresence` both populate them from persisted character data on join.
- [x] Turn-in message text updated to use the appropriate localization key: `objective.turn_in_complete_reward` (XP+铜), `objective.turn_in_complete_reward_xp_only`, or `objective.turn_in_complete_reward_copper_only` based on which rewards are present.
- [x] Copper reward behavior unchanged.
- [x] Duplicate completion/turn-in paths cannot grant the same objective XP reward repeatedly: `rewardGranted = true` is persisted to DB before XP is granted, and the guard `!player.objectiveRewardGranted` prevents re-entry.
- [x] `sewer_cleanup` (8 XP) is actually awarded when the objective is completed/turned in via the content definition `xpReward` field.
- [x] `pnpm typecheck` — 0 errors.

Task 350 status note:

- [x] Added localization-key-based level/XP display polish to the client overlay HUD and status chip.
- [x] Added `character.xp` and `world_session.level_xp_format` localization keys for consistent label rendering.
- [x] Updated the character chip subLine to show `displayName • Level X • XP Y` using the new localized `world_session.level_xp_format` key.
- [x] Updated the HUD `createMiniHudStat` to use `t("character.xp")` label instead of hardcoded `"XP"`.
- [x] Level/XP display is sourced from `PlayerPresence` (Colyseus schema) and falls back to `CharacterSummary` (`character.level`, `character.xp`) on reconnect.
- [x] XP gains update the overlay display: `xp_gained` handler calls `renderOverlay()`, and existing `xp_gained` feedback text (with level-up notice) is preserved.
- [x] TownRoom ↔ CombatRoom handoff preserves level/XP because `PlayerPresence.level` and `PlayerPresence.xp` are populated from DB on every join.
- [x] Reconnect restores level/XP through the existing `scene.restart()` re-initialization path which reads presence from the freshly joined room.
- [x] No new progression systems, skill points, stat allocation, character sheet, balance, or XP storage are introduced.
- [x] `pnpm typecheck` — 0 errors.

Task 351 status note:

- [x] Added the smallest persistent completed-objective history foundation by reusing persisted `CharacterObjective` records and extending them with optional `completedAt` for future-safe history tracking.
- [x] Exposed completed objective history server-authoritatively through room presence on both `TownRoom` and `CombatRoom` joins, preserving reconnect restoration and TownRoom ↔ CombatRoom handoff visibility.
- [x] Kept the one-active-objective runtime rule unchanged: completed history is display-only and does not introduce multiple simultaneous active objectives.
- [x] Updated the Objective Book UI to show a current active objective section plus a completed objectives section with an empty state when nothing has been completed yet.
- [x] Preserved Task 348 notice board catalog behavior and kept objective completion/turn-in authority on the server.
- [x] Client still cannot forge or mark completed objective history directly.
- [x] Prisma migration `20260901123927_add_character_objective_completed_at` generated and applied; `pnpm typecheck` — 0 errors.

Task 352 status note:

- [x] Notice board catalog availability now uses server-owned completed objective history so completed non-repeatable objectives are no longer offered as startable notice board entries.
- [x] `request_start_board_objective` now rejects already completed non-repeatable objectives with a safe server-owned rejection reason instead of trusting the client catalog.
- [x] Current objectives remain non-repeatable by default through the content model (`repeatable?: boolean` defaults to false when omitted); no repeatable objective feature was introduced.
- [x] Objective Book completed history remains visible across reconnect and TownRoom ↔ CombatRoom handoff, while active objective/progress/turn-in behavior remains on the existing single-active-objective path.
- [x] First-time XP/copper reward behavior remains unchanged for valid completions; replay/restart reward paths are blocked at objective start availability.
- [x] `pnpm typecheck` — 0 errors.

Task 354 status note:

- [x] Added minimal ready-to-turn-in guidance on the existing objective flow without broadening the single-active-objective system.
- [x] Preserved the server-owned `readyToTurnIn` signal end-to-end so the client distinguishes objective completion from final reward turn-in.
- [x] World-session feedback now gives room-specific guidance: Blackwire Sewers / `CombatRoom` completion tells the player to return to Nightmarket, while Nightmarket / `TownRoom` completion tells the player to interact with the notice board.
- [x] Objective Book active-objective styling now makes ready-to-turn-in objectives visually distinct from in-progress objectives using placeholder-level overlay styling.
- [x] Existing notice board turn-in, completed-history, and replay-prevention flows were preserved.
- [x] `pnpm typecheck` — 0 errors.

#### Wave 4 — Content / World Expansion

- [x] Add a small new combat pocket, sub-area, or connected destination candidate
- [x] Expand waypoint/world progression presentation
- [x] Add modest enemy / loot / objective content expansion
- [x] Improve readability and spacing where needed

Task 353 status note:

- [x] Switched `blackwire_sewers` from the temporary fixed 3-runt `CombatRoom` layout to a conservative data-driven spawn-pocket pass using existing `spawnZones` content.
- [x] Added a small readable enemy mix in Blackwire Sewers using existing archetypes only: runt, skitter, and a single brute anchor.
- [x] Preserved the physical return gate from Task 346 and kept the entry/return handoff path on the existing TownRoom ↔ CombatRoom leave-and-join flow.
- [x] Reused existing server-authoritative enemy defeat reward paths in `CombatRoom` so enemy XP, world-loot drops, and objective progress happen on the server rather than on the client.
- [x] `sewer_cleanup` can now progress naturally in Blackwire Sewers because its target enemy types spawn in the room and kill progress is applied through the existing objective progress hook.
- [x] `pnpm typecheck` — 0 errors.

Task 355 status note:

- [x] Expanded the existing waypoint interaction panel from an activated-only destination list into a full catalog presentation: both known waypoints are always shown, with undiscovered ones rendered locked (`???`, dashed border, no Travel button) instead of being omitted.
- [x] Added a server-owned discovery progress readout (`Waypoints discovered: X/Y`) to the panel, computed from the same activation data already used to gate travel — no new persistence or systems were introduced.
- [x] Extended the shared `WaypointDestinationEntry` type with a `discovered` flag populated by `buildWaypointDestinations` in `waypointService.ts`; travel approval/rejection rules on `request_waypoint_travel` are unchanged.
- [x] Applied a small readability/spacing pass on two visibly cramped overlay panels: the character status chip (padding and inter-line gap were tighter than the rest of the overlay) and the notice board objective rows (row padding/gap).
- [x] No minimap/world map, new waypoints, or new travel destinations were introduced; this is presentation-only for the existing two-waypoint catalog.
- [x] `pnpm typecheck` — 0 errors.

#### Wave 5 — Polish and RC Closure

- [ ] Audit broadened-loop regressions
- [ ] Audit travel/loading race conditions
- [ ] Audit objective persistence and reward safety
- [ ] Audit waypoint/world progression persistence
- [ ] Audit migration readiness if schema work occurs
- [ ] Close toward controlled 0.4 RC / bugfix-only state

### Explicit Non-Goals / Deferred Items

- [x] No Vue / app-shell migration
- [x] No full class / skill overhaul
- [x] No pets / mounts / familiars
- [x] No professions
- [x] No housing
- [x] No guilds
- [x] No PvP
- [x] No large new zone
- [x] No full art pipeline
- [x] No full minimap / world map unless explicitly selected later

### Planning Exit Criteria

- [x] Core Build 0.4 has a clear theme
- [x] Core Build 0.4 has a clear goal
- [x] Core Build 0.4 has defined feature pillars
- [x] Core Build 0.4 has grouped candidate waves
- [x] Core Build 0.4 has explicit non-goals
- [x] Core Build 0.4 has an explicit risk list
- [x] Core Build 0.3 is clearly treated as RC / bugfix-only
- [x] The next implementation task can be selected directly from the plan