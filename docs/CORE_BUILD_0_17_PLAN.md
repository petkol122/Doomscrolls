# docs/CORE_BUILD_0_17_PLAN.md — Core Build 0.17 Plan

## Theme: Content Breadth, Round Two — Depth Over a Fourth Zone

0.16 made the case that a new combat zone was cheap because the plumbing
(`COMBAT_ZONE_ROUTES`, `initializeCombatEnemies`/
`initializeCombatInteractables` reading purely from `contentRegistry`)
was already proven. That's still true for a 4th zone — but the *shape*
of what a zone adds has become formulaic: two enemies (skirmisher +
heavy anchor), one shared loot table, a rare, an epic family, two
zone-coverage objectives, plus a full gate/waypoint/spawn-point/
return-gate footprint in `waypointService.ts`/`interactValidation.ts`
that a same-zone content addition doesn't need at all. A 4th zone would
be the third repetition of that exact formula. This build makes a
different case: **finish the 3-role structure the first zone already
has, in the two zones that don't, and spend the plumbing-footprint
savings on closing a real rarity gap** — more playable substance for
less new-system surface than a 4th zone would cost.

## The actual gaps, read from the data before proposing anything

- **Enemy roles are uneven across zones.** Blackwire Sewers has three
  roles: a common/starter tier (`trashboar_runt`), a skirmisher
  (`trashboar_skitter`), and a heavy anchor (`trashboar_brute`). Static
  Yard has only two: `static_wretch` (skirmisher-ish) and a *reused*
  `trashboar_brute` for its heavy — no common/starter tier of its own.
  Cinderworks (0.16) also shipped with only two: `slag_hound`
  (skirmisher) and `foundry_warden` (heavy) — same missing tier. Both
  newer zones read thinner than Blackwire specifically because of this
  gap, not because they have fewer enemies in absolute terms.
- **Rarity tiers are now uneven.** Counted directly from `items.ts`:
  **11 common, 3 rare, 9 epic**. 0.16 fixed "epic is thin" (6 → 9) but in
  doing so left rare as the actual outlier — fewer rare items exist than
  epic ones, which inverts the tier's usual role as the broad middle
  step. Worse: of the 3 rares, only 2 zones have one they can call their
  own. `rustbound_ring` is Blackwire's; `signal_scarred_amulet` is
  shared by Blackwire *and* Static Yard's loot tables — Static Yard has
  never had a rare item of its own identity, unlike Cinderworks
  (`slagbound_charm`, added in 0.16). And checked directly against every
  item's `allowedEquipmentSlots`: the **feet slot has exactly one item
  in the entire game** (`sewer_treads`, common) — no rare or epic option
  exists for it anywhere, the only equipment slot with zero above-common
  coverage.

One new item closes both of the last two gaps in a single addition: a
rare **feet-slot** item, dropped from Static Yard, gives that zone the
owned-rare identity Cinderworks already has *and* gives the feet slot
its first non-common option.

## The mix

1. **`yard_drudge`** — Static Yard's own common/starter-tier enemy,
   completing its 3-role structure (drudge / wretch / brute) to match
   Blackwire's shape.
2. **`ash_rat`** — Cinderworks' own common/starter-tier enemy, same fix
   (rat / hound / warden).
3. **`voltbound_treads`** — new rare, feet slot, Static Yard's own loot
   identity, dropped from `static_yard_loot` (including from the new
   `yard_drudge`). Closes both the "Static Yard has no owned rare" gap
   and the "feet slot has no rare+ item" gap at once.
4. **Two new zone-coverage objectives** (`drudge_patrol` targeting
   `yard_drudge`, `ash_cull` targeting `ash_rat`) — the same
   `targetEnemyIds` pattern 0.15 built and 0.16 reused, spent again for
   free on this build's two new enemies.

Both new enemies reuse their zone's existing single loot table
(`static_yard_loot`/`cinderworks_loot`) rather than getting a table of
their own — matching the "one zone-wide table" precedent those two zones
already established in 0.6/0.16, and keeping this build's footprint to
content rows only, no new loot-table plumbing.

## Why not a 4th zone instead

Not ruled out on principle — the brief lists it as a live option and the
plumbing is proven — but this build's judgment call is that the
marginal playable substance per unit of new-surface is higher here.
A 4th zone repeats a now-three-times-used formula and requires touching
`waypointService.ts`'s route table and `interactValidation.ts`'s gate
prompt again; this build's two new enemies touch neither — pure
`enemies.ts`/`spawnZones.ts`/`items.ts`/`lootTables.ts`/`objectives.ts`/
`types.ts`/localization rows, landing inside zones and rooms that are
already fully wired and already covered by existing integration tests.
That's strictly less new-system surface for two new enemies + one new
item + two new objectives than a 4th zone would cost for two new
enemies + items + two objectives *plus* the gate/waypoint footprint on
top.

## File footprint

- `packages/content/src/data/types.ts` — extend `EnemyId`, `ObjectiveId`
  unions (no `LootTableId`/`ZoneContentId` change — no new tables or
  zones).
- `enemies.ts`, `spawnZones.ts`, `items.ts`, `lootTables.ts`,
  `objectives.ts`, `zones.ts` (just the two zones' `enemyIds` arrays) —
  new rows.
- `packages/localization/src/locales/en.ts` +
  `packages/localization/src/LocaleTypes.ts` — new keys for 2 enemies,
  1 item, 2 objectives.
- No `waypointService.ts`, `interactValidation.ts`, `CombatRoom.ts`,
  `TownRoom.ts`, `initializeCombatEnemies.ts`,
  `initializeCombatInteractables.ts` changes — confirmed by the same
  reasoning 0.16 used: all of these already resolve purely from
  `contentRegistry`, filtered by zone, with no per-enemy branching.

## Verification

- `test/content/contentRegistryValidation.test.ts` (0.16's addition)
  already re-runs automatically and covers referential integrity for
  every new row this build adds — no new test needed for that.
- New: `test/combat/staticYardObjectiveCoverage.test.ts` — Static Yard has
  never had a dedicated objective-coverage integration test (0.15 added
  `static_cleanup` as data only; 0.16 gave Cinderworks one via
  `cinderworksObjectiveCoverage.test.ts` but Static Yard was skipped).
  This build's `yard_drudge`/`drudge_patrol` addition is the right time
  to close that real, pre-existing gap — proving a kill in Static
  Yard's `CombatRoom` advances an objective, not just that the data is
  well-formed.
- Cinderworks' `ash_rat`/`ash_cull` addition does not get its own
  dedicated integration test: the identical mechanism is already proven
  for Cinderworks by 0.16's `cinderworksObjectiveCoverage.test.ts`
  (same room, same generic kill-tracking path, different enemy id) and
  by the content-registry validator for data correctness — a second
  near-identical integration test would prove the same thing twice.
  Flagged explicitly, not silently skipped.
- Both new tests/changes regression-checked (revert → confirm fail →
  restore → confirm pass) per standing rules.

## Non-goals

No balance/tuning changes to existing enemies/items. No new zone. No new
loot tables (both new enemies join their zone's existing table). No new
mechanics of any kind — enemy roles, loot tables, zone-coverage
objectives, and item slots are all pre-existing shapes being filled in,
not new systems.

## Start-of-session check

Working tree confirmed to match exactly what 0.13–0.16 (+ the 0.15
hotfix) documented — same 39 modified/untracked file set, nothing
unexplained, still zero commits on top of `c211a10`.
`pnpm -r typecheck` clean (0 errors, 5 packages) and
`pnpm --filter @doomscrolls/server test` green (22 files / 33 tests)
before this build's own changes began — one retry needed after the
already-documented transient Windows-native Prisma query-engine crash
(`0xC0000005`), consistent with 0.15's note that this is environmental,
not a regression.
