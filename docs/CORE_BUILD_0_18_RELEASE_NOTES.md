# docs/CORE_BUILD_0_18_RELEASE_NOTES.md — Core Build 0.18 Release Notes

---

## Task — Saltmere Docks: the Fourth Combat Zone, Closing a Real Rarity Cliff

**Date:** 2026-09-02
**Build:** Core Build 0.18
**Status:** Implemented and verified in one pass. Working-tree only — nothing committed.

### Summary

0.17 explicitly turned down a 4th zone: with all three existing combat
zones sharing an identical shape (skirmisher + heavy, one loot table, a
rare, an epic family, two objectives), a fourth would have been a third
repetition of a now-formulaic pattern. This build's brief reopened the
question — "now actually on the table again if the case is there" — so
the bar was to show a 4th zone adds something the existing three don't,
not just one more of the same.

The case, found by reading `items.ts`'s full rarity × equipment-slot
matrix before proposing anything: **weapon, head, chest, and hands each
jump straight from common to epic, with zero rare items in any of
them.** That's a worse gap than the one 0.17 closed (feet had *a* rare,
just not one Static Yard could call its own) — this is four of the
game's core gear slots with a real cliff in the itemization curve, not
a cosmetic ownership gap. Rare is also the numerically thinnest tier
overall (4 items vs. epic's 9), so this is where the next rarity pass
belonged, not more epics.

A 4th zone turned out to be the right vehicle for that fix rather than
a detour from it: every existing zone's rares/epics are zone-flavored
drops with their own identity, so the same pattern naturally produces
four zone-flavored rares that land exactly in the four empty slots —
giving **Saltmere Docks** a real, distinct itemization identity ("the
rare-tier zone") instead of being a fourth copy of "1 rare + 3-item
epic family." No new epics shipped this build — a deliberate choice,
not an oversight, stated in the plan up front.

Planning doc: `docs/CORE_BUILD_0_18_PLAN.md`.

### What changed — the zone and its footprint

- **`packages/content/src/data/zones.ts`**: new `saltmere_docks` combat
  zone — a flooded, salt-corroded dockyard, thematically distinct from
  sewage (Blackwire), live current (Static Yard), and furnace heat
  (Cinderworks). `nightmarket.transitionZoneIds` gained it. Same shared
  `bounds: 0-800 x 0-600` every combat zone already uses.
- **`spawnPoints.ts`/`worldProps.ts`**: gate/waypoint/area-label cluster
  around (400, 2200) — checked directly against every existing
  `worldProps.ts` coordinate first; the entire west-central stretch of
  the map (x<1200, y>1000) had nothing but two far-west boundary
  markers, and it's a different compass direction from all three
  existing zone gates (NE/E/SE), plus Saltmere Docks' own
  `combat_return_gate` inside the zone.
- **`apps/server/src/realtime/rooms/waypointService.ts`**: one new
  `COMBAT_ZONE_ROUTES` entry — the table exists specifically so a 4th
  zone is a data row, not a new branch, exactly as proven for
  Cinderworks in 0.16.
- **`apps/server/src/realtime/rooms/interactValidation.ts`**: one new
  gate-prompt branch, matching every prior zone's own branch here.
- **No `CombatRoom.ts`/`TownRoom.ts`/`initializeCombatEnemies.ts`/
  `initializeCombatInteractables.ts` changes.** All four were confirmed,
  not assumed, to already resolve zone/enemy/interactable data purely
  from `contentRegistry`, filtered by `zoneId`.

### What changed — enemies, items, objectives

- **`enemies.ts`**: `brine_crawler` (common/starter), `tide_stalker`
  (fast skirmisher), `drowned_hauler` (heavy anchor with a telegraphed
  heavy attack) — all three launched together. Unlike Static Yard and
  Cinderworks, which shipped with only 2 roles and needed a 0.17
  follow-up to reach the common/skirmisher/heavy structure Blackwire
  had from the start, Saltmere Docks starts complete. All three share
  one `saltmere_docks_loot` table, matching the one-table-per-zone
  precedent the last two zones established.
- **`items.ts`/`lootTables.ts`**: `brine_salt` (common material,
  loot-table filler) plus four rares — `tideworn_cutlass` (weapon),
  `brinemask_visor` (head), `saltcrust_vest` (chest), `brinewrap_gloves`
  (hands). Each stat value was picked as a genuine numeric middle step
  between that slot's existing common and epic numbers rather than an
  arbitrary pick — e.g. chest: common `armor+2/maxHp+5` → new rare
  `armor+3/maxHp+10` → epic `armor+5/maxHp+15`. Rarity counts:
  11 common / 4 rare / 9 epic → 12 / 8 / 9 (rare doubled); item total:
  24 → 29.
- **`objectives.ts`**: `brine_cull` (4x `brine_crawler`), `tide_hunt`
  (4x `tide_stalker`), `hauler_purge` (1x `drowned_hauler`, mirroring
  `break_the_brute`'s single-heavy-kill shape) — the same zone-coverage
  pattern every build since 0.15 has reused. All three appended to
  `NOTICE_BOARD_OBJECTIVE_SEQUENCE`.
- **Localization**: `en.ts` and `LocaleTypes.ts`'s
  `REQUIRED_LOCALIZATION_KEYS` both gained every key this build's
  content references (zone, 3 enemies, 5 items, 3 objectives,
  gate/waypoint/area-label/spawn labels, route prompt).

### Verification

Per `AGENTS.md`'s "Verification Must Be Permanent" rule:

**In-process (`pnpm --filter @doomscrolls/server test` — 24 files, 35
tests, all passing, up from this build's own starting point of 23 files
/ 34 tests):**

- `test/combat/saltmereDocksObjectiveCoverage.test.ts` (new): mirrors
  0.16's `cinderworksObjectiveCoverage.test.ts` — a `brine_crawler` kill
  in a `saltmere_docks` `CombatRoom` advances `brine_cull`, proving the
  full join → spawn → kill → objective-progress chain for the new zone,
  not just that the data is well-formed. Regression-checked: temporarily
  swapped the `brine_crawler` spawn pocket to `drowned_hauler`,
  confirmed the test fails (no `brine_crawler` spawned in the room),
  restored, re-verified green.
- `test/content/contentRegistryValidation.test.ts` (0.16's addition,
  re-run automatically): regression-checked specifically against this
  build's new data — temporarily typo'd `saltcrust_vest`'s id inside
  `saltmere_docks_loot`, confirmed the test fails with `Unknown item id:
  saltcrust_vest_typo`, restored, re-verified green.

**Typecheck:** `pnpm -r typecheck` — 0 errors across all 5 workspace
packages. Required rebuilding `@doomscrolls/localization` and
`@doomscrolls/content` dist output first, same as every content build
since 0.16.

**Test-run stability note:** full-suite runs hit the already-documented,
already-root-caused transient Windows-native Prisma query-engine crash
(`failed to delete napi ref`, sometimes a plain segfault) 5 times across
9 attempts during this build's verification — an elevated rate
consistent with what 0.17 first flagged, not a new issue. See
`docs/PRISMA_WINDOWS_TEARDOWN_CRASH_INVESTIGATION.md` for the full,
already-checked root-cause analysis (repeated real `PrismaClient`
creation across Vitest's per-file module isolation) and the follow-up
confirming which 8 `test/town/*.test.ts` files are genuinely
DB-dependent — none of which changed in this build. Every crash resolved
on retry, as it has in every prior session; a fully clean pass (24 files
/ 35 tests, exit 0) was captured as this build's final confirmation
after all regression-check edits were restored.

### Non-goals held

No balance/tuning changes to existing zones/items/enemies. **No new
epics** — a deliberate scope decision, not an oversight: epic tier
already had 9 items and wasn't the gap that needed closing. No new
mechanics — spawn zones, loot tables, zone-coverage objectives, and the
`COMBAT_ZONE_ROUTES` table are all pre-existing shapes extended with one
more row each. Remaining rarity gaps are named, not silently left open:
`ring_1`/`amulet` still have only their single rare each (no common or
epic tier at all), and `feet`/`belt`/`flask_1` still have no epic —
candidates for a future rarity-depth pass, not claimed as fixed here.

### Working-tree state

Nothing was committed at any point in this build. This build's changes
land on top of the existing uncommitted Core Build 0.13–0.17 diffs
already in the tree; a future commit sequence should land all builds
separately, in build order.
