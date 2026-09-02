# docs/CORE_BUILD_0_13_CHECKLIST.md — Core Build 0.13 Checklist

---

## Core 0.13 Checklist

**Date:** implemented in a prior, undocumented session (after the `0.10-0.12` commit, before Core Build 0.14's planning); this checklist written retroactively on 2026-09-02
**Build:** Core Build 0.13
**Theme:** Combat Zone Entry/Exit Position Integrity
**Status:** Implemented and left uncommitted in a prior session with no accompanying docs. Identified, verified still green, and retroactively documented during Core Build 0.14's planning pass.

### How this build was found

- [x] Core Build 0.14's planning pass noticed the working tree already contained a complete, coherent, uncommitted diff unrelated to anything in 0.10-0.12's committed scope
- [x] Confirmed via `git diff c211a10` that the diff is real, additional work on top of the `0.10-0.12` commit, not part of it
- [x] Confirmed via file mtimes that every file in this diff was last written between `2026-09-01 23:44` and `2026-09-02 00:20` — after the `0.10-0.12` commit (`23:01:04`) and before Core Build 0.14's own session began
- [x] Searched all `docs/`, `task_progress.md`, git stash, and other branches for any mention of this fix — found none; it existed only as unlabeled diffs in this one working tree
- [x] User flagged that Core Build 0.14's docs were treating this as an anonymous "starting point" rather than giving it its own identity, and asked for it to be a discrete, named unit
- [x] Retroactively documented here as Core Build 0.13, and Core Build 0.14's own docs (originally drafted under the working title "0.13") renumbered to make room for it

### Root Cause #1 — `onLeave` Races an Approved Handoff

- [x] `TownRoom.onLeave` gated on a `pendingRoomHandoff` flag set by the town→combat handoff path, skipping its own `updateCharacterLocation` persistence when set
- [x] `CombatRoom.onLeave` gated on `hasPendingAction && pendingActionType === "zone_transition"`, set by `registerCombatReturnHandler`, using `CombatRoom`'s own existing pending-action mechanism rather than importing `TownRoom`'s

### Root Cause #2 — Combat Zone Entry Landing Position

- [x] `waypointService.ts`: added `COMBAT_ZONE_ENTRY_X`/`COMBAT_ZONE_ENTRY_Y` (derived from `COMBAT_SPAWN_BOX`'s center); `resolveRouteTravel`'s combat-gate branch returns this as the real landing position instead of the Nightmarket-side spawn's raw coordinates, which are now used only as a content-integrity check
- [x] `buildCombatPlayerPresence.ts`: added a zone-match guard (`restoredZoneId === input.resolvedZoneId`) before trusting any restored position; changed the no-restored-position fallback from raw `(0, 0)` to `COMBAT_SPAWN_BOX`'s own center

### Bundled Client-Side Fixes

- [x] `combat_return_gate` is now directly clickable in the world (`WorldInteractionIntent.ts`'s new `CombatReturnIntent`, `resolveWorldInteraction.ts` routing, `dispatchWorldInteraction.ts`/`pendingInteractTracker.ts` handling, new `apps/client/src/net/combatReturnIntentClient.ts`, `worldSessionAreaView.ts`/`worldSessionInteractablesView.ts` hit-test/move-closer support)
- [x] HUD character chip shows the real current zone name/kind instead of a hardcoded `"The Nightmarket"` string (`worldSessionAreaBannerView.ts`'s `resolveZoneDisplayName` exported; `worldSessionOverlayView.ts`'s `resolveCurrentZoneId`/`resolveZoneKindLabel` added)

### Verification

- [x] `apps/server/test/town/combatHandoffPositionPersistence.test.ts` added: proves `onLeave` does not double-persist after an approved handoff, and that the persisted position is the real combat-zone interior entry point (`138, 470`), not a Nightmarket-scale one
- [x] `pnpm -r typecheck` passes (0 errors, all 5 workspace packages) — reconfirmed at the start of Core Build 0.14's planning
- [x] `pnpm --filter @doomscrolls/server test` passes (13 files / 22 tests) — reconfirmed at the start of Core Build 0.14's planning

### Explicit Non-Goals

- [x] No balance/tuning changes
- [x] No new zones, classes, skills, or enemy types
- [x] No death/respawn consequences, loadout system, or objectives/quest depth

### Working-Tree Discipline

- [x] Not committed by this build or by Core Build 0.14 — remains working-tree only, alongside 0.14's own changes, pending a future commit that should land this build's diff separately and first, in build order
