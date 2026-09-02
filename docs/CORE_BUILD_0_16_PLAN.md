# docs/CORE_BUILD_0_16_PLAN.md — Core Build 0.16 Plan

## Theme: Content Breadth — a Third Zone That Pays for Itself

0.10–0.15 were systems work: combat integrity, a second class, a persistent
test harness, itemization payoff, and quest depth. All of it plumbing that
makes more *content* cheap to add, but none of it added more of the game
itself. 0.16's brief is explicit: more of the game to actually play, not
another mechanic. The right move is the one the brief already names as
proven and cheap — **a third combat zone** — because Core 0.6's own Wave 2
refactor (`waypointService.ts`'s `COMBAT_ZONE_ROUTES` table,
`initializeCombatEnemies`/`initializeCombatInteractables` reading purely
from `contentRegistry`) means a new combat zone no longer touches room
logic at all. Confirmed by reading both: `initializeCombatEnemies` filters
`contentRegistry.spawnZones` by `zoneId`, `initializeCombatInteractables`
filters `contentRegistry.worldProps` by `zoneId` + `kind`, and
`COMBAT_ZONE_ROUTES` is a data array, not a branch. A third zone is a
content-data-only change, exactly as Static Yard proved.

## Why a zone, not just more enemies/objectives/items in isolation

A new zone is not competing with the other three options — it produces all
of them for free, which is the brief's own "compounds" framing:

- **Enemy variety**: a zone needs its own enemies to not feel like a
  reskin. Two new enemy types (not enemy-count padding — a fast skirmisher
  and a heavy anchor, the same two-role shape Static Yard used) land
  *because* the zone needs them.
- **Objectives**: 0.15 built two systems this build gets to spend for free
  — concurrent slots (already live, no code touches it) and zone-coverage
  objectives (the `targetEnemyIds` pattern from `skitter_hunt`/
  `static_cleanup`). Two new zone-coverage objectives are pure data, using
  a mechanism that already works.
- **Itemization**: the brief flags epic tier as "thin." Every existing
  combat zone (Blackwire, Static Yard) established its own 3-item epic
  family pool (weapon + chest + one utility piece) plus one zone-flavored
  rare. A third zone gets its own family pool the same way, taking epic
  tier from 6 items to 9 and giving the loot pool a third distinct
  identity instead of leaving it split two ways forever.

## The zone: Cinderworks

A scrap-smelting foundry yard — the third leg of Nightmarket's map, sitting
on a previously-empty stretch north of the existing hub↔sewer↔yard
diagonal (existing props run from the ~(400,300) hub southeast to
~(4900,3500); Cinderworks' gate cluster sits at ~(4300,300), an unused
corner). Reuses the same `bounds: 0-800 x 0-600` and `COMBAT_SPAWN_BOX`
every combat zone already shares — no new physics/spawn-box logic.

**Enemies** (2 new, mirroring the fast-skirmisher / heavy-anchor split
already used in every zone):
- `slag_hound` — fast, low-HP skirmisher (role: what Skitter/Wretch are to
  their zones).
- `foundry_warden` — heavy anchor with a telegraphed heavy attack (role:
  what Trashboar Brute is elsewhere), Cinderworks' own instead of reusing
  Brute again, so the zone has two real enemies, not one new + one reskin.

Both share one loot table (`cinderworks_loot`), matching Static Yard's own
precedent of one zone-wide table rather than Blackwire's older three-way
split.

**Items** (5 new): 1 common material (`cinder_ash`, zone-flavored filler
alongside the shared `blackwire_scrap`), 1 rare (`slagbound_charm`, a
*belt*-slot rare — the belt slot currently has no rare option at all, so
this closes a real gap rather than adding a fourth ring/amulet), and the
3-item epic family pool (`slagforged_maul` weapon, `cinderplate_hauberk`
chest, `cinderfist_gauntlets` hands) with stat combinations distinct from
every existing item (checked against all 6 existing epics).

**Objectives** (2 new, zone-coverage pattern): `slag_hunt` (4x
`slag_hound`) and `foundry_purge` (1x `foundry_warden`, mirroring
`break_the_brute`'s single-heavy-kill shape). Both added to
`NOTICE_BOARD_OBJECTIVE_SEQUENCE`.

## Full file footprint (content-data only, per the 0.6 precedent)

- `packages/content/src/data/types.ts` — extend `EnemyId`, `LootTableId`,
  `ObjectiveId`, `ZoneContentId`, `SpawnPointContentId`,
  `CombatInteractableId` unions.
- `zones.ts`, `enemies.ts`, `items.ts`, `lootTables.ts`, `objectives.ts`,
  `spawnZones.ts`, `spawnPoints.ts`, `worldProps.ts` — new rows.
- `apps/server/src/realtime/rooms/waypointService.ts` — one new
  `COMBAT_ZONE_ROUTES` entry (data, not logic — the table exists
  specifically so this is the only touch needed).
- `apps/server/src/realtime/rooms/interactValidation.ts` — one new
  `if (objectId === ...)` branch for the gate's hover prompt text (the one
  spot that's still per-object-id rather than table-driven; both Blackwire
  and Static Yard have their own such branch here).
- `packages/localization/src/locales/en.ts` +
  `packages/localization/src/LocaleTypes.ts` — new keys for the zone,
  2 enemies, 5 items, 2 objectives, gate/waypoint/area-label/spawn labels,
  and the route prompt.

No `CombatRoom.ts`/`TownRoom.ts`/`initializeCombatEnemies.ts`/
`initializeCombatInteractables.ts` changes — confirmed by reading all four;
they resolve everything from `contentRegistry` already.

## Verification-first addition: a real content-integrity test

`packages/content/src/ContentValidation.ts`'s `assertValidContentRegistry`
already checks referential integrity end-to-end (every enemy's loot table
exists, every zone's enemy/transition ids exist, every loot entry's item
exists, every localization key referenced by content exists, etc.) and
`apps/server/src/main.ts` calls it on server boot — but nothing in the
automated test suite exercises it; a typo in this build's hand-written data
would only surface at runtime server boot, not in CI. Adding one test that
calls it directly is a one-time, permanent regression asset for *all*
content, not just this build's additions. In-scope for this build's
verification, not a separate task.

Plus one integration test mirroring 0.15's own
`combatZoneObjectiveCoverage.test.ts` pattern: a `slag_hound` kill in a
`cinderworks` `CombatRoom` advances `slag_hunt` — proving the new zone's
enemy-kill-objective chain actually fires, not just that the data is
well-formed.

## Non-goals

No balance/tuning changes to existing zones/items/enemies. No new mechanics
— every system used (spawn zones, loot tables, zone-coverage objectives,
concurrent slots, epic-tier drop-only convention) already exists and is
already exercised by Blackwire/Static Yard. No vendor stock changes (epics
stay drop-only, per 0.7's established convention). No client-side map art
(all three zones already ship with `mapKey: "map_*_placeholder"`, an
established placeholder convention this build continues). No loadout/build
system, no quest chains — out of scope, unrelated to this brief.

## Start-of-session check

Diffed working tree against `c211a10` and compared to what Core Builds
0.13/0.14/0.15 + the same-day hotfix documented: exact match (33 modified +
19 untracked — 10 code/test files + 9 docs), nothing unexplained.
`pnpm -r typecheck` confirmed clean (0 errors, 5 packages) before this
build's own changes began.
