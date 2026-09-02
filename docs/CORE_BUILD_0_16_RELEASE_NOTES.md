# docs/CORE_BUILD_0_16_RELEASE_NOTES.md — Core Build 0.16 Release Notes

---

## Task — Content Breadth: Cinderworks, the Third Combat Zone

**Date:** 2026-09-02
**Build:** Core Build 0.16
**Status:** Implemented and verified in one pass. Working-tree only — nothing committed.

### Summary

0.10–0.15 were systems builds — combat integrity, a second class, a
persistent test harness, itemization payoff, quest depth. This build's
brief asked for the opposite: more of the game to actually play, not
another mechanic. The brief itself named the highest-leverage option — a
third combat zone, since Core 0.6's Wave 2 refactor (a content-driven
`COMBAT_ZONE_ROUTES` table, `initializeCombatEnemies`/
`initializeCombatInteractables` reading purely from `contentRegistry`)
means adding one no longer touches room logic at all. That was verified
by reading all four call sites before writing any content, not assumed.

The result, **Cinderworks**, is a scrap-smelting foundry yard — the map's
third zone — and it compounds the other three options for free, exactly
as the brief's own framing predicted: two new enemies because the zone
needed its own identity (not a Trashboar Brute reskin), two new
zone-coverage objectives spending 0.15's already-built concurrent-slot
and combat-zone-coverage systems, and a third epic-tier item family
(6 → 9 epics) closing the "epic tier is thin" gap the brief flagged,
including a rare item in the belt slot, which previously had no rare
option at all.

Planning doc: `docs/CORE_BUILD_0_16_PLAN.md`.

### What changed — the zone and its footprint

- **`packages/content/src/data/zones.ts`**: new `cinderworks` combat
  zone; `nightmarket.transitionZoneIds` gained it. Same shared
  `bounds: 0-800 x 0-600` every combat zone already uses, so
  `COMBAT_SPAWN_BOX` and its derived entry point work unchanged.
- **`spawnPoints.ts`/`worldProps.ts`**: nightmarket-side gate, waypoint,
  and area label cluster around (4300, 300) — the map's previously-unused
  north stretch, away from the existing hub→sewer→Static-Yard diagonal —
  plus Cinderworks' own `combat_return_gate` inside the zone.
- **`apps/server/src/realtime/rooms/waypointService.ts`**: one new
  `COMBAT_ZONE_ROUTES` entry. This table exists specifically so a third
  zone is a data row, not a new branch — confirmed by using it as such.
- **`apps/server/src/realtime/rooms/interactValidation.ts`**: one new
  `objectId === "nightmarket_cinderworks_gate_01"` branch for the gate's
  hover-prompt text — the one place still per-object-id rather than
  table-driven (Blackwire and Static Yard each have their own such
  branch here too).
- **No `CombatRoom.ts`/`TownRoom.ts`/`initializeCombatEnemies.ts`/
  `initializeCombatInteractables.ts` changes.** All four were read in
  full before starting; each already resolves zone/enemy/interactable
  data purely from `contentRegistry`, filtered by `zoneId`.

### What changed — enemies, items, objectives

- **`enemies.ts`**: `slag_hound` (fast, low-HP skirmisher — the role
  Skitter/Wretch play in their own zones) and `foundry_warden` (heavy
  anchor with a telegraphed heavy attack, same shape as Trashboar Brute)
  — both new enemy types, not a reused Brute, so Cinderworks has two real
  enemies instead of one new + one reskin. Both share one
  `cinderworks_loot` table, matching Static Yard's own one-table-per-zone
  precedent rather than Blackwire's older three-way split.
- **`items.ts`/`lootTables.ts`**: `cinder_ash` (common material, leads
  the table's common pool ahead of the shared `blackwire_scrap`),
  `slagbound_charm` (rare, belt slot — previously the only equipment slot
  with no rare-tier item at all), and a 3-item epic family
  (`slagforged_maul` weapon, `cinderplate_hauberk` chest,
  `cinderfist_gauntlets` hands), each checked against all 6 pre-existing
  epics for a distinct stat combination. Epic tier: 6 → 9 items; item
  total: 18 → 23.
- **`objectives.ts`**: `slag_hunt` (4x `slag_hound`) and `foundry_purge`
  (1x `foundry_warden`, mirroring `break_the_brute`'s single-heavy-kill
  shape) — the exact zone-coverage pattern 0.15 built for
  `skitter_hunt`/`static_cleanup`. Both appended to
  `NOTICE_BOARD_OBJECTIVE_SEQUENCE`. Neither the concurrent-slot system
  nor the zone-coverage kill-tracking mechanism needed any change — both
  are 0.15 systems exercised as-is by new data.
- **Localization**: `en.ts` and `LocaleTypes.ts`'s
  `REQUIRED_LOCALIZATION_KEYS` both gained every key the new content
  references (zone, 2 enemies, 5 items, 2 objectives, gate/waypoint/
  area-label/spawn labels, route prompt).

### Verification

Per `AGENTS.md`'s "Verification Must Be Permanent" rule:

**In-process (`pnpm --filter @doomscrolls/server test` — 22 files, 33
tests, all passing, up from this build's own starting point of 20 files /
31 tests):**

- `test/combat/cinderworksObjectiveCoverage.test.ts` (new): mirrors
  0.15's `combatZoneObjectiveCoverage.test.ts` — a `slag_hound` kill in a
  `cinderworks` `CombatRoom` advances `slag_hunt`. Regression-checked:
  temporarily swapped both hound spawn pockets to `foundry_warden`,
  confirmed the test fails (no `slag_hound` spawned in the room),
  restored, re-verified green.
- `test/content/contentRegistryValidation.test.ts` (new): calls
  `validateContentRegistry` directly against the full content registry.
  This validation function (checks every enemy's loot-table reference,
  every zone's enemy/transition ids, every loot entry's item id, every
  localization key content actually references, and more) already
  existed and already runs on server boot via `main.ts`, but nothing in
  the automated suite exercised it before this build — a content typo
  would only have surfaced at runtime server start. Adding this test is
  a **permanent regression asset for all content**, not scoped to this
  build's additions alone. Regression-checked: temporarily pointed
  `slag_hound.lootTableId` at a typo'd id, confirmed the test fails with
  `Unknown loot table id: cinderworks_loot_typo`, restored, re-verified
  green.

**Typecheck:** `pnpm -r typecheck` — 0 errors across all 5 workspace
packages. Required rebuilding `@doomscrolls/localization` and
`@doomscrolls/content` dist output before the check passed —
`ContentLocalizationKey` (`keyof typeof en`) resolves through the built
`.d.ts` for cross-package imports, not live from `src`, so new
localization keys weren't visible to `packages/content`'s own typecheck
until `pnpm --filter @doomscrolls/localization build` ran first. Noted
here since it isn't obvious and would otherwise look like a spurious
type error on a future content-only build.

### Non-goals held

No balance/tuning changes to existing zones/items/enemies. No new
mechanics — every system used (spawn zones, loot tables, zone-coverage
objectives, concurrent slots, epic drop-only convention) already existed
and was already exercised by Blackwire Sewers/Static Yard. No vendor
stock changes (epics stay drop-only, per 0.7's convention). No
client-side map art — all three zones ship with a `map_*_placeholder`
`mapKey`, an established placeholder convention this build continues. No
loadout/build system, no quest chains — out of scope, unrelated to this
brief.

### Working-tree state

Nothing was committed at any point in this build. This build's changes
land on top of the existing uncommitted Core Build 0.13–0.15+hotfix diffs
already in the tree; a future commit sequence should land all builds
separately, in build order.
