# docs/CORE_BUILD_0_16_CHECKLIST.md — Core Build 0.16 Checklist

---

## Core 0.16 Checklist

**Date:** 2026-09-02
**Build:** Core Build 0.16
**Theme:** Content Breadth — Cinderworks, the third combat zone
**Status:** Implemented and verified in one pass.

### Start-of-session check

- [x] Diffed working tree against `c211a10` and compared to what Core
      Builds 0.13/0.14/0.15 + the same-day hotfix documented — exact
      match (33 modified + 19 untracked: 10 code/test + 9 docs), nothing
      unexplained
- [x] Confirmed `pnpm -r typecheck` clean and the full server test suite
      (20 files / 31 tests) green before starting

### Zone — Cinderworks

- [x] `zones.ts`: new `cinderworks` combat zone, same shared
      `bounds: 0-800 x 0-600` as Blackwire/Static Yard; `nightmarket`'s
      `transitionZoneIds` gained it
- [x] `types.ts`: extended `EnemyId`, `LootTableId`, `ObjectiveId`,
      `ZoneContentId`, `SpawnPointContentId`, `CombatInteractableId`
- [x] `spawnPoints.ts`/`worldProps.ts`: nightmarket-side gate, waypoint,
      area label, and the zone's own `combat_return_gate`, all in the
      map's previously-unused north stretch (~x4300,y300), clear of the
      existing hub-sewer-yard diagonal and Static Yard's SE corner
- [x] `waypointService.ts`: one new `COMBAT_ZONE_ROUTES` entry — no
      other server logic touched (confirmed: `initializeCombatEnemies`,
      `initializeCombatInteractables`, `CombatRoom.ts`, `TownRoom.ts` all
      already read purely from `contentRegistry`)
- [x] `interactValidation.ts`: one new gate-prompt branch (the one spot
      still per-object-id, matching Blackwire's and Static Yard's own
      branches here)

### Enemies

- [x] `enemies.ts`: `slag_hound` (fast skirmisher, mirrors Skitter/Wretch's
      role) and `foundry_warden` (heavy anchor with telegraphed heavy
      attack, mirrors Trashboar Brute's role) — both new, not a reused
      Brute, so the zone has two real enemy types
- [x] Both point at one shared `cinderworks_loot` table (Static Yard's
      one-table-per-zone precedent, not Blackwire's older three-way split)

### Items

- [x] `items.ts`: 1 common material (`cinder_ash`), 1 rare
      (`slagbound_charm`, a *belt*-slot rare — the belt slot had no rare
      option before this), 3-item epic family pool (`slagforged_maul`
      weapon, `cinderplate_hauberk` chest, `cinderfist_gauntlets` hands)
      — stat combinations checked against all 6 pre-existing epics, none
      duplicated
- [x] `lootTables.ts`: `cinderworks_loot` — its own material leads the
      common pool ahead of the shared `blackwire_scrap`, its own rare and
      epic family, matching Static Yard's "own identity" precedent
- [x] Epic tier: 6 → 9 items; item total: 18 → 23

### Objectives

- [x] `objectives.ts`: `slag_hunt` (4x slag_hound) and `foundry_purge`
      (1x foundry_warden, mirrors `break_the_brute`'s single-heavy shape)
      — the same zone-coverage pattern 0.15 established for
      `skitter_hunt`/`static_cleanup`; both appended to
      `NOTICE_BOARD_OBJECTIVE_SEQUENCE`
- [x] No changes to the concurrent-slot or zone-coverage mechanisms
      themselves — both are 0.15 systems exercised as-is by new data

### Localization

- [x] `en.ts` + `LocaleTypes.ts`'s `REQUIRED_LOCALIZATION_KEYS`: all new
      keys added (zone, 2 enemies, 5 items, 2 objectives, gate/waypoint/
      area-label/spawn labels, route prompt) — every key required by
      content data now has both an `en.ts` entry and a
      `REQUIRED_LOCALIZATION_KEYS` entry

### Verification

- [x] `pnpm -r typecheck` — 0 errors across all 5 workspace packages
      (required rebuilding `@doomscrolls/localization` and
      `@doomscrolls/content` dist output first — `ContentLocalizationKey`
      resolves through the built `.d.ts`, not live from `src`)
- [x] `pnpm --filter @doomscrolls/server test` — 22 files, 33 tests, all
      passing (up from this build's own starting point of 20 files / 31
      tests)
- [x] **New**: `test/content/contentRegistryValidation.test.ts` — calls
      `assertValidContentRegistry`'s underlying `validateContentRegistry`
      directly. This function already existed and already runs on server
      boot (`main.ts`) but nothing in the automated suite exercised it —
      a permanent regression asset for all content, not just this
      build's additions. Regression-checked: temporarily pointed
      `slag_hound.lootTableId` at a typo'd id, confirmed the test fails
      with `Unknown loot table id: cinderworks_loot_typo`, restored,
      re-verified green.
- [x] **New**: `test/combat/cinderworksObjectiveCoverage.test.ts` —
      mirrors 0.15's `combatZoneObjectiveCoverage.test.ts` pattern: a
      `slag_hound` kill in a `cinderworks` `CombatRoom` advances
      `slag_hunt`. Regression-checked: temporarily swapped both hound
      spawn pockets to `foundry_warden`, confirmed the test fails
      (`expected undefined to be defined` — no `slag_hound` spawned),
      restored, re-verified green.

### Non-Goals Held

- [x] No balance/tuning changes to existing zones/items/enemies
- [x] No new mechanics — spawn zones, loot tables, zone-coverage
      objectives, concurrent slots, epic drop-only convention all
      pre-existing
- [x] No vendor stock changes (epics stay drop-only)
- [x] No client-side map art (all three zones ship with
      `map_*_placeholder`, an established convention)
- [x] No loadout/build system, no quest chains

### Working-Tree Discipline

- [x] Nothing committed at any point in this build — all changes land on
      top of the existing uncommitted 0.13–0.15+hotfix diffs already in
      the tree
