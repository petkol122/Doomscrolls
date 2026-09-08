# docs/CORE_BUILD_0_20_RELEASE_NOTES.md — Core Build 0.20 Release Notes

---

## Task — The Standing Objective, Everywhere Except Where It Started

**Date:** 2026-09-02
**Build:** Core Build 0.20
**Status:** Implemented and verified in one pass. Working-tree only — nothing committed.

### Summary

0.19 closed the last structural gap that justified a new zone (the
rarity-tier hole) and the last borrowed-enemy gap (Static Yard's own
heavy). That put a 5th zone technically back on the table, but this
build's brief was explicit that "technically allowed" isn't a case —
so before proposing anything, both a 5th zone and a 4th enemy role per
zone were checked directly rather than assumed. Neither had one:
`items.ts`'s full rarity matrix (computed, not eyeballed) shows every
slot at common/rare/epic; every combat zone has an identical,
fully-owned 3-role roster with no missing piece. Shipping either
anyway would have been the manufactured-repeat move 0.17 and 0.19 both
already declined.

Reading `objectives.ts` in full instead turned up the actual gap:
`repeatable: true` has been used by exactly one objective in the whole
game since it was added — `sewer_patrol`, built in 0.15 specifically to
prove the flag works. Every one of the nine objectives 0.16 through
0.19 shipped is one-and-done; Static Yard, Cinderworks, and Saltmere
Docks each have exactly 3 objectives (one per enemy role), and once a
player clears all 3, the Notice Board has nothing standing left to
offer for that zone. Blackwire alone has had an evergreen reason to
keep returning. A second thing turned up alongside it: multi-enemy
`targetEnemyIds` (an objective that advances from killing *any* of
several enemy types) only exists in Blackwire's two oldest objectives,
and checking the test suite found neither of those had ever actually
been exercised by a kill — `concurrentObjectiveSlots.test.ts` kills a
runt and a brute, but against two disjoint *single*-target objectives
in different slots, never one multi-target objective.

Planning doc: `docs/CORE_BUILD_0_20_PLAN.md`.

### What changed — "zone patrol" objectives

- **`objectives.ts`**: `yard_patrol` (Static Yard), `cinder_patrol`
  (Cinderworks), `dock_patrol` (Saltmere Docks) — each `repeatable:
  true`, each targeting that zone's full 3-enemy roster (common +
  skirmisher + heavy), each `requiredKills: 2` / `xpReward: 3` /
  `copperReward: 2`. Those numbers are copied exactly from
  `sewer_patrol`'s own values, not invented — only the target pool
  changes, generalized from 1 enemy to 3. After this build, every
  combat zone has the same standing, always-available objective
  Blackwire has had since 0.15. All three appended to
  `NOTICE_BOARD_OBJECTIVE_SEQUENCE`.
- No `CombatRoom.ts`/`TownRoom.ts`/`advanceObjectiveProgress.ts`
  changes — `targetEnemyIds.includes(enemyId)` and
  `objective.repeatable === true` are both already fully generic; this
  build is the first to combine them in one objective, but needs no new
  code to do it.

### What changed — Saltmere Docks spawn-density parity

- **`spawnZones.ts`**: `saltmere_docks_crawler_pocket_south` (2x
  `brine_crawler`). Checked pocket-by-pocket while reading the file:
  every combat zone built since 0.16 gets an extra common-tier pocket
  beyond its entrance cluster (Static Yard's `static_yard_drudge_pocket`,
  Cinderworks' `cinderworks_rat_pocket`) except Saltmere Docks, which
  never got the equivalent — tied with Blackwire for the lowest total
  enemy count (6) against Static Yard's 8 and Cinderworks' 9. Same
  mid-room coordinates (`300-440, 300-420`) the other two already use
  for their own extra pocket.

### Verification

Per `AGENTS.md`'s "Verification Must Be Permanent" rule:

**In-process (`pnpm --filter @doomscrolls/server test` — 25 files, 40
tests, all passing, up from this build's own starting point of 25
files / 39 tests):**

- A third `it` added to `test/combat/staticYardObjectiveCoverage.test.ts`:
  starts `yard_patrol`, kills a `static_wretch` (skirmisher), then a
  `yard_drudge` (common — a *different* target type in the same
  objective), and asserts progress advances 0→1→2, completing on the
  second kill. This is the first test in the suite to actually exercise
  multi-target kill-tracking against two different enemy types within
  one objective — `cull_trashboars`/`sewer_cleanup` have had a 2-enemy
  `targetEnemyIds` since 0.4/0.15 with nothing ever proving it works.
  Regression-checked: temporarily narrowed `yard_patrol`'s
  `targetEnemyIds` to `["static_wretch"]` only, confirmed the test fails
  (`Timed out waiting for message "objective_updated"` — the drudge
  kill stopped advancing anything), restored, re-verified green.
- `test/content/contentRegistryValidation.test.ts` (0.16's addition,
  re-run automatically): regression-checked against this build's new
  spawn pocket — temporarily typo'd its `enemyId`
  (`brine_crawler_typo`), confirmed the test fails with `Unknown enemy
  id: brine_crawler_typo`, restored, re-verified green. A parallel
  attempt to typo an objective's `targetEnemyIds` entry instead was
  caught by `tsc` itself before the test could even run (`EnemyId` is a
  closed literal union with no `as` cast on that field, unlike
  `spawnZones.ts`'s), so that path was redirected to actually exercise
  the runtime validator.

**Typecheck:** `pnpm -r typecheck` — 0 errors across all 5 workspace
packages. Required rebuilding `@doomscrolls/localization` and
`@doomscrolls/content` dist output first, same as every content build
since 0.16.

### Non-goals held

No 5th zone and no new enemy roles — both checked directly against the
current data before being ruled out, not defaulted away. No
balance/tuning changes to any existing item, enemy, or objective's
numbers. No new mechanics — every change here is a new row in an
existing table, or two already-existing, already-independently-proven
flags combined for the first time.

### Working-tree state

Nothing was committed at any point in this build. This build's changes
land on top of the existing uncommitted Core Build 0.13–0.19 diffs
already in the tree; a future commit sequence should land all builds
separately, in build order.
