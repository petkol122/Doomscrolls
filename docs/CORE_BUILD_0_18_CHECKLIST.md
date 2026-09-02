# docs/CORE_BUILD_0_18_CHECKLIST.md — Core Build 0.18 Checklist

---

## Core 0.18 Checklist

**Date:** 2026-09-02
**Build:** Core Build 0.18
**Theme:** Content Breadth, Round Three — Saltmere Docks, the fourth
combat zone, closing the rare-tier equipment-slot gap
**Status:** Implemented and verified in one pass.

### Start-of-session check

- [x] Confirmed working tree still matches exactly what 0.13–0.17
      (+ the 0.15 hotfix, + the two post-0.17 investigation docs) left
      off — same file set, nothing unexplained, still zero commits on
      top of `c211a10`
- [x] `pnpm -r typecheck` clean and `pnpm --filter @doomscrolls/server
      test` green (23 files / 34 tests) before starting — one retry
      needed past the already-documented transient Windows-native
      Prisma crash

### The zone: Saltmere Docks

- [x] `zones.ts`: new `saltmere_docks` combat zone, same shared
      `bounds: 0-800 x 0-600` every combat zone reuses;
      `nightmarket.transitionZoneIds` gained it
- [x] `types.ts`: extended `EnemyId`, `LootTableId`, `ObjectiveId`,
      `ZoneContentId`, `SpawnPointContentId`, `CombatInteractableId`
- [x] `spawnPoints.ts`/`worldProps.ts`: gate/waypoint/area-label cluster
      at (400, 2200) — checked directly against every existing
      `worldProps.ts` coordinate first; the west-central stretch
      (x<1200, y>1000) had nothing but two far-west boundary markers
- [x] `waypointService.ts`: one new `COMBAT_ZONE_ROUTES` entry — no
      other room logic touched (confirmed: `CombatRoom.ts`, `TownRoom.ts`,
      `initializeCombatEnemies.ts`, `initializeCombatInteractables.ts`
      all still resolve purely from `contentRegistry`)
- [x] `interactValidation.ts`: one new gate-prompt branch

### Enemies — launched with full role parity from day one

- [x] `enemies.ts`: `brine_crawler` (common/starter), `tide_stalker`
      (skirmisher), `drowned_hauler` (heavy anchor) — all three shipped
      together, unlike Static Yard/Cinderworks which launched with 2
      and needed a 0.17 follow-up to reach role parity
- [x] All three share one `saltmere_docks_loot` table (one-zone-wide-
      table precedent, not Blackwire's older three-way split)

### Items — the rare-tier gap, closed for 4 slots

- [x] `items.ts`: confirmed by reading every item's rarity × slot before
      proposing anything — weapon/head/chest/hands each had **zero**
      rare items (common → epic directly). Added `tideworn_cutlass`
      (weapon), `brinemask_visor` (head), `saltcrust_vest` (chest),
      `brinewrap_gloves` (hands), each a genuine numeric middle step
      between that slot's existing common and epic values, plus
      `brine_salt` (common material, loot-table filler)
- [x] **Deliberately no new epics** — epic tier is not thin (9 items);
      this zone's whole itemization contribution is rare tier, where the
      actual gap was
- [x] Rarity counts: 11 common / 4 rare / 9 epic → 12 / 8 / 9; item
      total: 24 → 29
- [x] Remaining gaps named, not silently left: `ring_1`/`amulet` still
      have only their single rare each (no common or epic); `feet`,
      `belt`, `flask_1` still have no epic

### Objectives

- [x] `brine_cull` (4x `brine_crawler`), `tide_hunt` (4x `tide_stalker`),
      `hauler_purge` (1x `drowned_hauler`, mirrors the single-heavy-kill
      shape) — the same zone-coverage `targetEnemyIds` pattern every
      build since 0.15 has reused; all three appended to
      `NOTICE_BOARD_OBJECTIVE_SEQUENCE`

### Localization

- [x] `en.ts` + `LocaleTypes.ts`'s `REQUIRED_LOCALIZATION_KEYS`: all new
      keys added (zone, 3 enemies, 5 items, 3 objectives, gate/waypoint/
      area-label/spawn labels, route prompt)

### Verification

- [x] `pnpm -r typecheck` — 0 errors across all 5 workspace packages
      (required rebuilding `@doomscrolls/localization` and
      `@doomscrolls/content` dist output first, same as every prior
      content build)
- [x] `pnpm --filter @doomscrolls/server test` — 24 files, 35 tests, all
      passing (up from this build's own starting point of 23 files / 34
      tests)
- [x] **New**: `test/combat/saltmereDocksObjectiveCoverage.test.ts` —
      mirrors 0.16's `cinderworksObjectiveCoverage.test.ts`: a
      `brine_crawler` kill in a `saltmere_docks` `CombatRoom` advances
      `brine_cull`. Regression-checked: temporarily swapped the
      `brine_crawler` spawn pocket to `drowned_hauler`, confirmed the
      test fails (`expected undefined to be defined` — no
      `brine_crawler` spawned), restored, re-verified green.
- [x] Regression-checked `test/content/contentRegistryValidation.test.ts`
      (0.16) against this build's new data: temporarily typo'd
      `saltcrust_vest`'s id inside `saltmere_docks_loot`, confirmed the
      test fails with `Unknown item id: saltcrust_vest_typo`, restored,
      re-verified green.
- [x] Full-suite runs hit the already-documented transient Windows-
      native Prisma query-engine crash repeatedly this session (5 of 9
      attempts across this build's verification passes) before landing
      clean — consistent with the elevated-frequency pattern already
      noted in 0.17's release notes and fully root-caused in
      `docs/PRISMA_WINDOWS_TEARDOWN_CRASH_INVESTIGATION.md`; not
      re-investigated here since it's a known, already-checked
      conclusion, not a new issue

### Non-Goals Held

- [x] No balance/tuning changes to existing zones/items/enemies
- [x] No new epics — deliberate, stated plainly in the plan, not an
      oversight
- [x] No new mechanics — spawn zones, loot tables, zone-coverage
      objectives, and the `COMBAT_ZONE_ROUTES` table are all pre-existing
      shapes extended with one more row each

### Working-Tree Discipline

- [x] Nothing committed at any point in this build — all changes land on
      top of the existing uncommitted 0.13–0.17 diffs already in the
      tree
