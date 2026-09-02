# docs/CORE_BUILD_0_15_CHECKLIST.md — Core Build 0.15 Checklist

---

## Core 0.15 Checklist

**Date:** 2026-09-02
**Build:** Core Build 0.15
**Theme:** Quest Depth — Concurrent Objectives, Real Coverage, and a Repeatable Grind
**Status:** All three pillars implemented and verified in one pass, plus a same-day hotfix: the notice-board turn-in handler had a request race allowing a double-grant, found during this build's own regression trace and fixed and verified in the same session. See `docs/CORE_BUILD_0_15_RELEASE_NOTES.md`'s "Hotfix: Notice-Board Turn-In Double-Grant Race" entry.

### Start-of-session check

- [x] Diffed working tree against `c211a10` and compared to what Core Builds 0.13/0.14 documented — exact match (25 modified + 12 new files), nothing unexplained
- [x] Confirmed `pnpm -r typecheck` and the full server test suite (16 files / 27 tests) green before starting

### Pillar 1 — Two Concurrent Active Objectives

- [x] `PlayerPresence.ts`: added 8 slot-2 fields mirroring the existing slot-1 objective fields
- [x] `advanceObjectiveProgress.ts`: added `readObjectiveSlot`/`writeObjectiveSlot`/`ObjectiveSlot` and `advanceObjectiveProgressAllSlots` (loops both slots via snapshot-in/write-back, existing single-slot functions unchanged)
- [x] `ObjectiveRepository.ts`: added `startOrRestart` (upsert) — `request_start_board_objective` now uses it instead of `create`, since a repeatable objective's second start would otherwise hit the `(characterId, objectiveId)` unique constraint
- [x] `TownRoom.ts`: `buildAvailableNoticeBoardObjectives` excludes objectives active in either slot; notice-board turn-in handler loops both slots; `request_start_board_objective` picks the first empty slot, rejects only when both are full; `request_reset_objective` takes an explicit `slot`; join-time restoration collects up to two persisted objectives
- [x] `CombatRoom.ts`: both kill-progress call sites use `advanceObjectiveProgressAllSlots`; join-time restoration collects up to two persisted objectives
- [x] `buildPlayerPresence.ts`/`buildCombatPlayerPresence.ts`: `applyPersistedObjectiveSlot` (shared) restores either slot
- [x] Protocol: `ObjectiveUpdatedServerMessage.slot` (required), `RequestResetObjectiveClientMessage.slot` (required)
- [x] Client: `townRoomPresence.ts` reads both slots (`objective`/`objective2`); `worldSessionOverlayView.ts`'s compact HUD tracker and the expandable Objectives panel both render up to two active cards; `resetObjectiveClient.ts`/`WorldSessionScene.ts` thread the slot through
- [x] No DB migration — `ObjectiveRepository` was already keyed by `(characterId, objectiveId)`, already slot-agnostic
- [x] Regression-check: reverted the empty-slot-picking logic to single-slot, confirmed `concurrentObjectiveSlots.test.ts` fails (timeout), restored, re-verified green

### Pillar 2 — Combat-Zone Objective Coverage

- [x] `objectives.ts`: added `skitter_hunt` (Blackwire, trashboar_skitter) and `static_cleanup` (Static Yard, static_wretch); both added to `NOTICE_BOARD_OBJECTIVE_SEQUENCE`
- [x] Localization: title/description keys added to `en.ts` and `LocaleTypes.ts`'s `REQUIRED_LOCALIZATION_KEYS`
- [x] Regression-check: temporarily emptied `skitter_hunt.targetEnemyIds`, confirmed `combatZoneObjectiveCoverage.test.ts` fails (timeout), restored, re-verified green

### Pillar 3 — Repeatable Objectives, Actually Turned On

- [x] `objectives.ts`: added `sewer_patrol` (trashboar_runt, 2 kills, `repeatable: true`) — the first objective ever to set this flag
- [x] Found and fixed a real, pre-existing latent bug while writing the first-ever turn-in test: the notice-board turn-in handler persisted `rewardGranted = true` to the DB but never actually set the in-memory `objectiveRewardGranted` flag on the slot. Fixed in the same turn-in block this build already touched for slot-awareness.
- [x] Confirmed `isObjectiveRepeatable`/`isObjectiveStartBlockedByCompletion` (pre-existing, unused until now) correctly bypass the completion-block for a repeatable objective — no changes needed there
- [x] Regression-check: the `objectiveRewardGranted` fix was confirmed necessary by the test's own natural fail-then-pass (failed with the bug present, passed after the one-line fix) — see Verification below for why the `startOrRestart`-vs-`create` distinction itself isn't independently regression-tested

### Hotfix (same day) — Notice-Board Turn-In Double-Grant Race

- [x] **Fixed:** the turn-in handler's `hasObjective` gate stayed open across three awaited calls (`markRewardGranted`, `incrementMoneyCopper`, `grantFlatXpReward`); two `request_interact` messages arriving before the first resolved could both pass the gate and both grant the reward. Fixed by closing the gate synchronously, before the first await (reopened from a pre-close snapshot if `markRewardGranted` itself fails). Found during this build's own regression trace, predates 0.15, unrelated to what it shipped.
- [x] New `apps/server/test/town/objectiveTurnInRace.test.ts`: slows the mocked `markRewardGranted` to open a real race window, fires two turn-in requests without awaiting between them, asserts it was invoked exactly once
- [x] Regression-check: reverted the fix, confirmed the test fails (`markRewardGranted` called twice), restored, re-verified green
- [x] `pnpm -r typecheck` clean; full suite 20 files / 31 tests, all passing

### Verification

- [x] `pnpm -r typecheck` — 0 errors across all 5 workspace packages
- [x] `pnpm --filter @doomscrolls/server test` — 19 files, 30 tests, all passing (up from 0.14's 16 files / 27 tests); 20 files / 31 tests after the same-day hotfix above
- [x] `test/town/concurrentObjectiveSlots.test.ts` (new): fills both slots, rejects a third, proves a kill only advances the slot(s) whose `targetEnemyIds` actually match
- [x] `test/combat/combatZoneObjectiveCoverage.test.ts` (new): a `trashboar_skitter` kill in `CombatRoom` (Blackwire Sewers) advances `skitter_hunt`
- [x] `test/town/repeatableObjective.test.ts` (new): turn in `sewer_patrol`, confirm it's immediately restartable with progress reset to 0
- [x] All three regression-checked (revert → confirm fail → restore → confirm pass)
- [~] The `startOrRestart` upsert's specific claim (avoids a real Postgres unique-constraint violation on restart) is **not** independently regression-tested — `ObjectiveRepository` is fully mocked in this test suite (the established convention for every other repository-touching test here too), so a mocked `.create()` and a mocked `.startOrRestart()` both resolve identically regardless of which is called; swapping one for the other in a test run would prove nothing. Confidence instead rests on Prisma's `upsert` being the well-established, correct-by-construction operation for exactly this create-or-reset-on-existing-key case. Flagged explicitly rather than claimed as independently verified.
- [x] Two Windows-native Prisma query-engine crashes during full-suite runs (`0xC0000005` / `failed to delete napi ref`) confirmed transient on retry, unrelated to any code change — not this build's regression

### Non-Goals Held

- [x] No balance/tuning changes to combat formulas
- [x] No more than 2 concurrent objective slots
- [x] No new objective types (still kill-count only)
- [x] No quest chains/branching/dialogue
- [x] No DB schema/migration changes
- [x] No loadout/build-choice system (confirmed in scoping research to need a DB migration + new content + new UI — out of proportion for this build)

### Working-Tree Discipline

- [x] Nothing committed at any point in this build — all changes land on top of the existing uncommitted Core Build 0.13 + 0.14 diffs already in the tree
