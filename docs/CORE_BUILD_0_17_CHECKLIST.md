# docs/CORE_BUILD_0_17_CHECKLIST.md — Core Build 0.17 Checklist

---

## Core 0.17 Checklist

**Date:** 2026-09-02
**Build:** Core Build 0.17
**Theme:** Content Breadth, Round Two — role parity + rarity depth in
the 3 existing zones, no 4th zone
**Status:** Implemented and verified in one pass.

### Start-of-session check

- [x] Confirmed working tree still matches exactly what 0.13–0.16 (+
      0.15's hotfix) documented — same file set, nothing unexplained,
      still zero commits on top of `c211a10`
- [x] `pnpm -r typecheck` clean and `pnpm --filter @doomscrolls/server
      test` green (22 files / 33 tests) before starting — one retry
      needed past the already-documented transient Windows-native
      Prisma query-engine crash

### Enemy role parity

- [x] `yard_drudge` — Static Yard's own common/starter tier, completing
      its 3-role structure (drudge / wretch / brute) to match
      Blackwire's shape; stats mirror `trashboar_runt`'s own role
- [x] `ash_rat` — Cinderworks' own common/starter tier, same fix
      (rat / hound / warden)
- [x] Both reuse their zone's existing single loot table
      (`static_yard_loot`/`cinderworks_loot`) — no new loot tables
- [x] `zones.ts`: both zones' `enemyIds` arrays extended;
      `types.ts`: `EnemyId` extended
- [x] `spawnZones.ts`: one new pocket per zone, placed in genuinely free
      space (x300-440, y300-420 in both zones) clear of every existing
      pocket and the shared `COMBAT_SPAWN_BOX` entry area

### Rarity depth

- [x] `voltbound_treads` — new rare, **feet slot** (previously the only
      equipment slot with zero rare-or-above items — confirmed by
      grepping every item's `allowedEquipmentSlots` before proposing
      this), dropped from `static_yard_loot`
- [x] Closes Static Yard's own long-standing gap: it never had a rare
      item of its own identity (its only rare, `signal_scarred_amulet`,
      is shared with Blackwire's sewer tables) — confirmed directly
      from `lootTables.ts`, not from the 0.7-era code comment claiming
      otherwise (left a correcting comment in place)
- [x] Rarity counts: 11 common / 3 rare / 9 epic → 11 / 4 / 9 — rare
      tier's undercount (fewer items than epic) partially addressed;
      flagged as still the thinnest tier in the plan, not claimed fixed

### Objectives

- [x] `drudge_patrol` (4x `yard_drudge`, Static Yard) and `ash_cull`
      (5x `ash_rat`, Cinderworks) — same zone-coverage `targetEnemyIds`
      pattern 0.15 built and 0.16 reused; both appended to
      `NOTICE_BOARD_OBJECTIVE_SEQUENCE`
- [x] `types.ts`: `ObjectiveId` extended
- [x] No changes to the concurrent-slot or zone-coverage mechanisms
      themselves

### Localization

- [x] `en.ts` + `LocaleTypes.ts`'s `REQUIRED_LOCALIZATION_KEYS`: all new
      keys added (2 enemies, 1 item, 2 objectives) — every key new
      content references now has both an `en.ts` entry and a
      `REQUIRED_LOCALIZATION_KEYS` entry

### No zone-plumbing touched (confirmed, not assumed)

- [x] `waypointService.ts` — unchanged (no new zone, no new route)
- [x] `interactValidation.ts` — unchanged (no new gate)
- [x] `CombatRoom.ts`/`TownRoom.ts`/`initializeCombatEnemies.ts`/
      `initializeCombatInteractables.ts` — unchanged; all already
      resolve enemy/objective data purely from `contentRegistry`,
      filtered by zone, with no per-enemy branching

### Verification

- [x] `pnpm -r typecheck` — 0 errors across all 5 workspace packages
      (required rebuilding `@doomscrolls/localization` and
      `@doomscrolls/content` dist output first, same as 0.16)
- [x] `pnpm --filter @doomscrolls/server test` — 23 files, 34 tests, all
      passing (up from this build's own starting point of 22 files / 33
      tests). Full-suite runs hit the documented transient Windows-native
      Prisma query-engine crash (`0xC0000005`/`failed to delete napi
      ref`/segfault) more often this session than 0.15 first noted —
      seen at varying, non-deterministic file boundaries across 6+
      attempts, with clean full passes obtained both mid-session and as
      the final confirmation after all regression-check edits were
      restored. The varying crash location each attempt is itself
      evidence this is the same pre-existing native-binding teardown
      issue, not something this build's changes caused.
- [x] **New**: `test/combat/staticYardObjectiveCoverage.test.ts` — Static
      Yard had never had a dedicated objective-coverage integration test
      (0.15 added `static_cleanup` as data only; 0.16 gave Cinderworks
      one but skipped Static Yard). Proves a `yard_drudge` kill in
      Static Yard's `CombatRoom` advances `drudge_patrol`.
      Regression-checked: temporarily swapped the `yard_drudge` spawn
      pocket to `trashboar_brute`, confirmed the test fails (`expected
      undefined to be defined` — no `yard_drudge` spawned), restored,
      re-verified green.
- [x] Cinderworks' `ash_rat`/`ash_cull` deliberately does **not** get a
      second near-identical integration test — the same room/mechanism
      is already proven for Cinderworks by 0.16's
      `cinderworksObjectiveCoverage.test.ts`, and the content-registry
      validator covers data correctness. Flagged explicitly in the plan,
      not silently skipped.
- [x] Regression-checked `contentRegistryValidation.test.ts` (0.16's
      addition) against this build's new data: temporarily typo'd
      `voltbound_treads`'s id inside `static_yard_loot`, confirmed the
      test fails with `Unknown item id: voltbound_treads_typo`,
      restored, re-verified green.

### Non-Goals Held

- [x] No balance/tuning changes to existing enemies/items
- [x] No 4th zone
- [x] No new loot tables — both new enemies join their zone's existing
      table
- [x] No new mechanics — enemy roles, loot tables, zone-coverage
      objectives, and item slots are all pre-existing shapes being
      filled in

### Working-Tree Discipline

- [x] Nothing committed at any point in this build — all changes land on
      top of the existing uncommitted 0.13–0.16 diffs already in the
      tree
