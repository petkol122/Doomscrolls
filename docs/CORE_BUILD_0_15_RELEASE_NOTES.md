# docs/CORE_BUILD_0_15_RELEASE_NOTES.md — Core Build 0.15 Release Notes

---

## Task — Quest Depth: Concurrent Objectives, Real Coverage, and a Repeatable Grind

**Date:** 2026-09-02
**Build:** Core Build 0.15
**Status:** All three pillars implemented and verified in one pass. Working-tree only — nothing committed.

### Summary

Objectives/quest depth was declined at 0.6 and again at 0.9 for being lower-priority than other gaps, not for lacking a real case. This build found that the actual system is far more built out than its own code comments claim: `TownRoom.ts` already had a selectable objective catalog, per-character completion history, and fully correct (but never exercised) gating logic for repeatable objectives. That discovery is what made a real slice — not just more content — responsibly in-scope for one pass: **two objectives can now be active at once**, closing the code's own five-build-old "no multi-objective support" complaint, with zero DB migration required (`ObjectiveRepository` was already keyed by `(characterId, objectiveId)`, already slot-agnostic). Two supporting pillars round it out: kills in Blackwire Sewers and Static Yard — the game's own dedicated combat zones — now actually count toward something, and a repeatable objective is live for the first time, surfacing and fixing a real latent bug along the way.

Start-of-session check (per this build's explicit instruction): diffed the working tree against the `0.10-0.12` commit and compared it to what Core Builds 0.13 and 0.14 documented — an exact match, nothing unexplained sitting in the tree.

Planning doc: `docs/CORE_BUILD_0_15_PLAN.md`.

### What changed — Pillar 1: Two Concurrent Active Objectives

- **`apps/server/src/realtime/rooms/PlayerPresence.ts`**: added a second full 8-field objective slot (`hasObjective2`, `objectiveId2`, ...), mirroring the existing skill-slot-cooldown pattern of duplicated named fields rather than an array.
- **`apps/server/src/realtime/rooms/advanceObjectiveProgress.ts`**: added `readObjectiveSlot`/`writeObjectiveSlot` (snapshot a slot into a plain object, write it back after mutation) and `advanceObjectiveProgressAllSlots` (loops both slots through the existing, unchanged `advanceObjectiveProgress`). No existing exported function's logic changed — only how callers reach it.
- **`apps/server/src/persistence/repositories/ObjectiveRepository.ts`**: added `startOrRestart`, a Prisma `upsert` on the existing `(characterId, objectiveId)` unique key. `request_start_board_objective` now calls this instead of `create`, because a repeatable objective's second start would otherwise hit that unique constraint and fail.
- **`apps/server/src/realtime/rooms/TownRoom.ts`**: the notice-board turn-in handler, `request_start_board_objective`, `request_reset_objective`, and join-time restoration are all now slot-aware — pick the first empty slot, reject only when both are full, restore up to two persisted objectives on reconnect.
- **`apps/server/src/realtime/rooms/CombatRoom.ts`**: both kill-progress call sites (basic attack, skill cast) advance whichever slot(s) actually match the killed enemy; join-time restoration mirrors TownRoom's.
- **`buildPlayerPresence.ts`/`buildCombatPlayerPresence.ts`**: a new shared `applyPersistedObjectiveSlot` restores either slot from DB state.
- **Protocol**: `ObjectiveUpdatedServerMessage`/`RequestResetObjectiveClientMessage` both gained a required `slot: 1 | 2` field.
- **Client**: `townRoomPresence.ts` reads both slots into `objective`/`objective2`; the compact HUD tracker and the expandable Objectives panel (`worldSessionOverlayView.ts`) both render up to two active cards side by side, with independent reset buttons.

### What changed — Pillar 2: Combat-Zone Objective Coverage

- **`packages/content/src/data/objectives.ts`**: added `skitter_hunt` (Blackwire Sewers, `trashboar_skitter`) and `static_cleanup` (Static Yard, `static_wretch`). Kill-progress tracking already fired in `CombatRoom` for every enemy kill — the actual gap was that no objective's `targetEnemyIds` had ever included either enemy, so a kill of either, in the game's own dedicated combat zones, advanced nothing. Pure content addition, zero new mechanics.

### What changed — Pillar 3: Repeatable Objectives, Actually Turned On

- **`objectives.ts`**: `sewer_patrol` (`trashboar_runt`, 2 kills, reward rate matching the existing objectives' per-kill rate) is the first objective ever marked `repeatable: true`.
- **A real bug found and fixed while verifying this**: the notice-board turn-in handler persisted `rewardGranted = true` to the database, but never actually set the in-memory `objectiveRewardGranted` flag on the slot — a pre-existing gap (not introduced by this build) that had gone unnoticed because no test had ever exercised the turn-in path before this build's first-ever objective tests. Fixed in the same turn-in block this build already touched for slot-awareness.
- The gating logic that lets a repeatable objective bypass the completion-block (`isObjectiveRepeatable`/`isObjectiveStartBlockedByCompletion`) already existed and required no changes — it had simply never been exercised, since no objective had ever set the flag.

### Verification

Per `AGENTS.md`'s "Verification Must Be Permanent" rule:

**In-process (`pnpm --filter @doomscrolls/server test` — 19 files, 30 tests, all passing, up from 0.14's 16 files / 27 tests):**

- `test/town/concurrentObjectiveSlots.test.ts` (new): fills both slots (`break_the_brute` → slot 1, `sewer_patrol` → slot 2), confirms a third start is rejected, then kills a `trashboar_runt` and a `trashboar_brute` in turn and confirms each kill advances only the slot whose `targetEnemyIds` actually includes that enemy — the other slot's progress is provably untouched.
- `test/combat/combatZoneObjectiveCoverage.test.ts` (new): a `trashboar_skitter` kill in `CombatRoom` (Blackwire Sewers) advances `skitter_hunt` — the exact "kills here count for nothing" gap this build closes.
- `test/town/repeatableObjective.test.ts` (new): turns in a completed `sewer_patrol`, confirms the in-memory state clears correctly, then starts it again and confirms the restart succeeds (not rejected) with progress reset to 0 — the first real exercise of the repeatable-objective path, and the test that caught the `objectiveRewardGranted` bug above.
- **Regression-check discipline** (per 0.9-0.14's established practice): the empty-slot-picking logic, `skitter_hunt`'s target enemy list, and the `objectiveRewardGranted` fix were each reverted in turn and the corresponding test confirmed to fail before being restored and re-verified green.
- **One verification gap flagged explicitly, not silently claimed**: `startOrRestart`'s specific real-world value — avoiding a Postgres unique-constraint violation on a repeatable objective's second start — is not independently regression-tested. `ObjectiveRepository` is fully mocked throughout this test suite (the same convention every other repository-touching test here uses), so a mocked `.create()` and a mocked `.startOrRestart()` resolve identically regardless of which is called; a test swap between them would prove nothing. Confidence rests on Prisma's `upsert` being the well-established, correct-by-construction operation for a create-or-reset-on-existing-key case, not on an executed integration test against a real database.

**Typecheck:** `pnpm -r typecheck` — 0 errors across all 5 workspace packages.

**Note on test-run stability:** two full-suite runs hit a native Prisma query-engine crash during teardown (`0xC0000005` / "failed to delete napi ref"), both confirmed transient on immediate retry (clean pass, same test count) — a Windows-native binding issue unrelated to any code change in this build, not a regression.

### Non-goals held

No balance/tuning changes to combat formulas; no more than 2 concurrent objective slots (a fixed number, not a generic N-slot system); no new objective types (still kill-count only — no fetch/deliver/escort); no quest chains, branching, or dialogue; no DB schema/migration changes; no loadout/build-choice system (confirmed via a separate scoping pass this build to require a DB migration, new content, and new UI — out of proportion for a single build) — all exactly as scoped in the plan.

### Working-tree state

Nothing was committed at any point in this build. All changes land on top of the existing uncommitted Core Build 0.13 and 0.14 diffs already in the tree; a future commit sequence should land all three builds separately, in build order.

---

## Hotfix: Notice-Board Turn-In Double-Grant Race

**Date:** 2026-09-02
**Status:** Implemented and verified

### Summary

Found during this build's own regression trace while re-verifying the `objectiveRewardGranted` fix above — unrelated to what 0.15 shipped, and predates it. The notice-board turn-in handler (`TownRoom.ts`) left a slot's `hasObjective` gate open across three awaited calls (`markRewardGranted`, `incrementMoneyCopper`, `grantFlatXpReward`). Colyseus processes one room's messages sequentially but yields to the next queued message at each `await`, so two `request_interact` messages arriving before the first one's awaits resolved (e.g. a rapid double-click) could both snapshot `hasObjective: true`, both take the turn-in branch, and both grant the reward.

### What changed

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: the turn-in branch now closes the slot's gate (`hasObjective: false`, `objectiveRewardGranted: true`, HUD fields cleared) synchronously, immediately after capturing the locals it needs (`turnInObjId`, `turnInLabel`, `copperReward`, `xpReward`) and before the first `await` — not after all three. A second concurrent invocation's own snapshot now sees the slot already closed and falls through without re-entering the branch. If `markRewardGranted` itself fails, the gate is reopened from a pre-close snapshot so the slot stays retryable rather than being silently cleared with nothing persisted.

### Verification

- New `apps/server/test/town/objectiveTurnInRace.test.ts`: slows the mocked `markRewardGranted` with a real 30ms delay (giving a concurrent second `request_interact` a real window to interleave, the same shape of window the original bug relied on), fires two turn-in requests without awaiting between them, and asserts `markRewardGranted` was only ever actually invoked once.
- Regression-check: reverted the fix (gate closed late again, matching the original code), confirmed the test fails (`markRewardGranted` called twice — `expected 2 to be 1`), restored, re-verified green.
- `pnpm -r typecheck` — 0 errors across all 5 workspace packages.
- Full suite: 20 files, 31 tests, all passing (up from this build's own 19 files / 30 tests). Two of three full-suite runs hit the same transient native Prisma query-engine crash already noted above; the third was clean with the same test count — unrelated to this fix.
