# docs/CORE_BUILD_0_17_RELEASE_NOTES.md — Core Build 0.17 Release Notes

---

## Task — Content Breadth, Round Two: Role Parity and a Rarity Gap Closed

**Date:** 2026-09-02
**Build:** Core Build 0.17
**Status:** Implemented and verified in one pass. Working-tree only — nothing committed.

### Summary

0.16 made the case that a new combat zone was cheap because
`waypointService.ts`'s `COMBAT_ZONE_ROUTES` table and the room
initializers already read purely from `contentRegistry`. That's still
true — but this build's judgment call was that a 4th zone would be the
third repetition of an increasingly formulaic shape (two enemies, one
loot table, a rare, an epic family, two objectives, plus the
gate/waypoint plumbing a same-zone addition skips entirely). Instead,
0.17 read the data before proposing anything and found two concrete,
narrower gaps worth closing directly: Blackwire Sewers has a
common/skirmisher/heavy 3-role enemy structure that Static Yard and
Cinderworks don't (both shipped with only skirmisher + heavy), and the
item rarity tiers are uneven — 11 common, 3 rare, 9 epic, counted
directly from `items.ts` — with rare now the actual thin tier despite
0.16 fixing "epic is thin." Worse, of the 3 rares only two zones can
call one their own: Static Yard's only rare, `signal_scarred_amulet`, is
shared with Blackwire's own sewer tables (confirmed from
`lootTables.ts` directly — a nearby 0.7-era code comment claims Static
Yard already "has its own distinct rare entry," which the data
contradicts). And the feet equipment slot has exactly one item in the
entire game, `sewer_treads` (common) — the only slot with zero rare-or-
above coverage.

One new item, one per-zone enemy, and two objectives close all of that
in a single small pass: cheaper in new-system surface than a 4th zone,
and it fills real gaps in what already exists rather than adding a
fourth copy of an established pattern.

Planning doc: `docs/CORE_BUILD_0_17_PLAN.md`.

### What changed — enemy role parity

- **`enemies.ts`**: `yard_drudge` (Static Yard's own common/starter
  tier, stats mirroring `trashboar_runt`'s role) and `ash_rat`
  (Cinderworks' equivalent). Neither zone's heavy anchor or skirmisher
  changed; both new enemies join their zone's existing single loot
  table (`static_yard_loot`/`cinderworks_loot`) rather than getting a
  table of their own, matching the one-table-per-zone precedent those
  zones already established.
- **`zones.ts`**: both zones' `enemyIds` gained the new enemy.
- **`spawnZones.ts`**: one pocket per zone (`x300-440, y300-420` in
  both, mirrored placement) — genuinely free space, clear of every
  existing pocket and the shared `COMBAT_SPAWN_BOX` entry area.

### What changed — a rarity gap, closed with one item

- **`items.ts`**: `voltbound_treads` — rare, feet slot, Static Yard's
  own loot identity. Closes two gaps in one addition: Static Yard gets
  a rare item it can call its own for the first time, and the feet slot
  gets its first item above common tier anywhere in the game. Stat
  shape (`moveSpeed +0.22`, `armor +1`) is an upgrade over
  `sewer_treads`' moveSpeed-only common design, not a change to
  `sewer_treads` itself.
- **`lootTables.ts`**: added to `static_yard_loot` at the same rare-tier
  weight (2) as `signal_scarred_amulet`, with a comment correcting the
  nearby 0.7-era claim that Static Yard already had its own distinct
  rare.
- Rarity counts: **11 common / 3 rare / 9 epic → 11 / 4 / 9**. Rare
  remains the numerically thinnest tier — this build closes the
  "Static Yard has no owned rare" and "feet slot has no rare+ item"
  gaps specifically, not the broader rare-tier count, which is flagged
  in the plan rather than claimed fixed.

### What changed — objectives

- **`objectives.ts`**: `drudge_patrol` (4x `yard_drudge`, Static Yard)
  and `ash_cull` (5x `ash_rat`, Cinderworks) — the same zone-coverage
  `targetEnemyIds` pattern 0.15 built for `skitter_hunt`/
  `static_cleanup` and 0.16 reused for `slag_hunt`/`foundry_purge`.
  Both appended to `NOTICE_BOARD_OBJECTIVE_SEQUENCE`. The concurrent-
  slot system and the kill-tracking mechanism itself needed no changes
  — both are pre-existing systems exercised as-is by new data.
- **Localization**: `en.ts` and `LocaleTypes.ts`'s
  `REQUIRED_LOCALIZATION_KEYS` both gained every key this build's
  content references (2 enemies, 1 item, 2 objectives).

### What did not change

No `waypointService.ts`, `interactValidation.ts`, `CombatRoom.ts`,
`TownRoom.ts`, `initializeCombatEnemies.ts`, or
`initializeCombatInteractables.ts` changes — confirmed, not assumed, by
the same reasoning 0.16 used: none of this build's additions are a new
zone or a new gate, and every one of those files already resolves
enemy/objective data purely from `contentRegistry`, filtered by zone,
with no per-enemy branching to extend.

### Verification

Per `AGENTS.md`'s "Verification Must Be Permanent" rule:

**In-process (`pnpm --filter @doomscrolls/server test` — 23 files, 34
tests, all passing, up from this build's own starting point of 22 files
/ 33 tests):**

- `test/combat/staticYardObjectiveCoverage.test.ts` (new): Static Yard
  had never had a dedicated objective-coverage integration test (0.15
  added `static_cleanup` as data only, relying on Blackwire's
  `skitter_hunt` test to prove the shared mechanism; 0.16 gave
  Cinderworks its own test but skipped Static Yard). This build's
  `yard_drudge`/`drudge_patrol` addition closed that real,
  pre-existing gap: a `yard_drudge` kill in Static Yard's `CombatRoom`
  advances `drudge_patrol`. Regression-checked: temporarily swapped the
  `yard_drudge` spawn pocket to `trashboar_brute`, confirmed the test
  fails (no `yard_drudge` spawned in the room), restored, re-verified
  green.
- Cinderworks' `ash_rat`/`ash_cull` deliberately does not get a second,
  near-identical integration test — the same room and the same generic
  kill-tracking path are already proven for Cinderworks by 0.16's
  `cinderworksObjectiveCoverage.test.ts`; a second test would prove the
  identical mechanism twice. Data correctness is still covered by the
  content-registry validator below. Flagged explicitly per the plan,
  not silently skipped.
- `test/content/contentRegistryValidation.test.ts` (0.16's addition,
  re-run automatically): regression-checked against this build's new
  data specifically — temporarily typo'd `voltbound_treads`'s id inside
  `static_yard_loot`, confirmed the test fails with `Unknown item id:
  voltbound_treads_typo`, restored, re-verified green.

**Typecheck:** `pnpm -r typecheck` — 0 errors across all 5 workspace
packages. Required rebuilding `@doomscrolls/localization` and
`@doomscrolls/content` dist output first, same as 0.16 (`
ContentLocalizationKey` resolves through built `.d.ts` for cross-package
imports).

**Test-run stability note:** the transient Windows-native Prisma
query-engine crash first documented in 0.15
(`0xC0000005`/`failed to delete napi ref`, occasionally a plain
segfault) surfaced more often this session than 0.15's original "two of
many runs" — six-plus occurrences across this build's verification
passes, each at a different, non-deterministic file boundary. The
varying crash location itself is evidence this is the same
pre-existing native-binding teardown issue rather than something this
build's changes caused: a fully clean pass (23 files / 34 tests, exit
0) was obtained mid-session with all of this build's changes in place,
and again as the final confirmation after every regression-check edit
had been reverted and restored. Noted here in case the elevated
frequency recurs in a future session and is worth investigating on its
own — it was not investigated further in this build, as it is
orthogonal to content correctness and already flagged as environmental
in 0.15.

### Non-goals held

No balance/tuning changes to existing enemies/items. No 4th zone. No
new loot tables — both new enemies join their zone's existing table. No
new mechanics of any kind — enemy roles, loot tables, zone-coverage
objectives, and item slots are all pre-existing shapes being filled in,
not new systems.

### Working-tree state

Nothing was committed at any point in this build. This build's changes
land on top of the existing uncommitted Core Build 0.13–0.16 diffs
already in the tree; a future commit sequence should land all builds
separately, in build order.
