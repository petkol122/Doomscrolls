# docs/CORE_BUILD_0_20_CHECKLIST.md — Core Build 0.20 Checklist

---

## Core 0.20 Checklist

**Date:** 2026-09-02
**Build:** Core Build 0.20
**Theme:** The standing objective, everywhere except where it started
**Status:** Implemented and verified in one pass.

### Start-of-session check

- [x] Confirmed via `git log`/`git status` that nothing was committed
      since `c211a10` and the working tree still matches exactly what
      0.13–0.19 left off — same file set, nothing unexplained
- [x] `pnpm -r typecheck` clean before starting

### Case-checking before proposing anything

- [x] Checked for a 5th-zone case: computed the full rarity matrix from
      `items.ts` (every slot has common/rare/epic as of 0.19), confirmed
      every combat zone has an identical, fully-owned 3-role enemy
      roster, confirmed every zone already claims at least one item slot
      as its own — no structural gap left for a new zone to close
- [x] Checked for a new-enemy-role case: all 4 combat zones already have
      3 zone-owned roles each with a full item family — no zone is
      missing a role the way Static Yard was before 0.19
- [x] Read `objectives.ts` in full: found `repeatable: true` used by
      exactly 1 objective in the whole game (`sewer_patrol`, 0.15) and
      multi-enemy `targetEnemyIds` used by exactly 2, both Blackwire's
      oldest (`cull_trashboars`, `sewer_cleanup`) — neither ever
      combined, and multi-target kill-tracking has never actually been
      proven by a test even for those 2
- [x] Read `spawnZones.ts` pocket-by-pocket: found Saltmere Docks is the
      only post-0.16 combat zone without the second common-tier pocket
      Static Yard and Cinderworks both have (6 total enemies vs. 8-9)

### Part 1 — "Zone patrol" objectives (the primary content)

- [x] `objectives.ts`: `yard_patrol` (Static Yard), `cinder_patrol`
      (Cinderworks), `dock_patrol` (Saltmere Docks) — each
      `repeatable: true`, each targeting that zone's full 3-enemy
      roster, each `requiredKills: 2` / `xpReward: 3` / `copperReward: 2`
      copied exactly from `sewer_patrol`'s own numbers, not invented
- [x] All three appended to `NOTICE_BOARD_OBJECTIVE_SEQUENCE`
- [x] `types.ts`: `ObjectiveId` gained all three
- [x] After this build every combat zone has a standing, always-
      available objective — not just Blackwire

### Part 2 — Saltmere Docks spawn-density parity

- [x] `spawnZones.ts`: `saltmere_docks_crawler_pocket_south` (2x
      `brine_crawler`), same mid-room coordinates Static Yard/Cinderworks
      already use for their own extra common-tier pocket

### Non-goals held

- [x] No 5th zone — checked directly, not just declined by default
- [x] No new enemy roles — checked directly, same reasoning
- [x] No balance/tuning changes to any existing item, enemy, or
      objective's numbers
- [x] No new mechanics — `repeatable` and multi-target `targetEnemyIds`
      both already existed; this build only combines them and adds one
      spawn pocket, all pure data

### Localization

- [x] `en.ts` + `LocaleTypes.ts`'s `REQUIRED_LOCALIZATION_KEYS`: 3 new
      objective title/description pairs

### Verification

- [x] `pnpm -r typecheck` — 0 errors across all 5 workspace packages
      (rebuilt `@doomscrolls/localization` and `@doomscrolls/content`
      dist output first)
- [x] `pnpm --filter @doomscrolls/server test` — 25 files, 40 tests, all
      passing (up from the 25 files / 39 tests this build started from)
- [x] **New**: a third `it` in
      `test/combat/staticYardObjectiveCoverage.test.ts` — starts
      `yard_patrol`, kills a `static_wretch` (skirmisher) then a
      `yard_drudge` (common, different target type), asserts progress
      advances 0→1→2 and completes on the second kill. This is the
      first test in the suite to actually exercise multi-target
      `targetEnemyIds` kill-tracking against two different enemy types
      in one objective. Regression-checked: temporarily narrowed
      `yard_patrol`'s `targetEnemyIds` to `["static_wretch"]` only,
      confirmed the test fails (`Timed out waiting for message
      "objective_updated"` — the drudge kill no longer advanced
      anything), restored, re-verified green
- [x] Regression-checked `test/content/contentRegistryValidation.test.ts`
      against this build's new data: temporarily typo'd the new spawn
      pocket's `enemyId` (`brine_crawler_typo`), confirmed the test
      fails with `Unknown enemy id: brine_crawler_typo`, restored,
      re-verified green. (A parallel attempt to typo an objective's
      `targetEnemyIds` entry was caught by `tsc` itself before the test
      even ran — `EnemyId` is a closed literal union there with no `as`
      cast, unlike `spawnZones.ts`'s enemy id field — so that path
      wasn't useful for exercising the runtime validator specifically.)

### Working-Tree Discipline

- [x] Nothing committed at any point in this build — all changes land on
      top of the existing uncommitted 0.13–0.19 diffs already in the
      tree
