# docs/CORE_BUILD_0_19_PLAN.md — Core Build 0.19 Plan

## Theme: Close the Rarity Matrix, Close Static Yard's Last Borrowed Enemy

0.18 closed the worst rarity cliff (weapon/head/chest/hands: zero rares)
by shipping a 4th zone, and named what it deliberately left open:
`ring_1`/`amulet` have only their single rare each (no common, no
epic), and `feet`/`belt`/`flask_1` have no epic. Reading `items.ts`
directly (not trusting the 0.18 text) turns up one more thing 0.18's
own summary understates: `flask_1` isn't just missing an epic, it has
**no rare either** — `starter_blood_flask` is the only flask item in
the game, common tier only. That's the same single-tier shape as
`ring_1`/`amulet`, just not labeled that way.

## Why this build's mix is item-depth + one enemy fix, not a 5th zone

0.18's bar for a new zone was explicit: show it closes something the
existing zones don't, not just repeat the formula (0.17 already turned
down a 4th zone for being exactly that). The structural hole that
justified 0.18 — a whole rarity tier missing across four core slots —
is fully closed by this build's item pass; there's no comparably
concrete gap left to hang a 5th zone on. Manufacturing one anyway would
be exactly the "formulaic repeat" 0.17 declined. The two gaps that
*are* concrete and sitting in the code right now are the rest of the
rarity matrix, and Static Yard's heavy anchor.

## Part 1 — Rarity matrix, fully closed

Current state (read from `items.ts` before proposing anything):

| Slot | Common | Rare | Epic |
|---|---|---|---|
| ring_1 | none | rustbound_ring | none |
| amulet | none | signal_scarred_amulet | none |
| flask_1 | starter_blood_flask | none | none |
| feet | sewer_treads | voltbound_treads | none |
| belt | scrapcord_belt | slagbound_charm | none |

Every other slot (weapon/head/chest/hands) already has all three tiers
as of 0.18. This build adds exactly the missing cells — 8 items — so
that after this build **every equipment slot in the game has common,
rare, and epic representation**. That's a clean, verifiable stopping
point, not an open-ended expansion.

- `ring_1`: `frayed_signet` (common, armor+1) and `voidglass_band`
  (epic, armor+2/maxHp+14) — added to the same 3 sewer tables
  `rustbound_ring` already lives in, extending its existing
  distribution rather than redesigning it.
- `amulet`: `scavenged_cord` (common, mind+1) and `resonant_choker`
  (epic, mind+4/moveSpeed+0.1) — added to the same 4 tables
  `signal_scarred_amulet` already lives in (3 sewer tables +
  `static_yard_loot`).
- `flask_1`: `sealed_blood_flask` (rare, restoreHpInstant 35/3 charges)
  and `vital_reserve_flask` (epic, restoreHpInstant 45/4 charges).
  Flasks have only ever been vendor-obtainable (never in a loot
  table) — the rare follows that same path (new vendor stock entry,
  matching how `signal_scarred_amulet` is already vendor-sold at rare).
  The epic follows the established "epics are drop-only" rule (0.7)
  instead: added to the shared Blackwire-family epic pool.
- `feet`: `voltbound_greaves` (epic, moveSpeed+0.28/armor+2) — added to
  `static_yard_loot`'s epic pool, completing the common→rare→epic
  pipeline for the slot Static Yard already claims via
  `voltbound_treads`.
- `belt`: `cinderbound_girdle` (epic, toughness+3/armor+2) — added to
  `cinderworks_loot`'s epic pool, same reasoning for the slot
  Cinderworks already claims via `slagbound_charm`.

All new commons also get vendor stock entries, matching the 0.5
precedent of giving every equipment-slot-coverage common item a
guaranteed non-RNG obtainability path.

No items are added for the sake of filling out a set — every one plugs
a cell in the matrix above. No balance changes to any existing item.

## Part 2 — Static Yard's last borrowed enemy

Static Yard is the only combat zone that still doesn't own its full
enemy roster: `static_wretch` (skirmisher) and `yard_drudge` (common,
added 0.17) are its own, but the heavy anchor is still a reused
`trashboar_brute` — Blackwire's enemy. Cinderworks (`foundry_warden`)
and Saltmere Docks (`drowned_hauler`) both got a fully zone-original
heavy when they were built; Static Yard never got the equivalent
follow-up 0.17 gave its common tier.

Adds `arc_sentinel` — Static Yard's own heavy anchor, same
heavy-attack telegraph shape every other zone's anchor already uses
(stats mirror `foundry_warden`/`drowned_hauler` directly: maxHp 34,
damage 4/heavy 7, armor 1). Replaces `trashboar_brute` in
`zones.ts`'s `static_yard.enemyIds` and in `spawnZones.ts`'s heavy
anchor pocket — Static Yard's roster becomes fully its own, matching
every other combat zone. Uses the existing `static_yard_loot` table
(no new table needed, same precedent as every other zone's heavy).

This also closes a second, smaller gap: Static Yard has never had a
single-heavy-kill "purge" objective the way Cinderworks
(`foundry_purge`) and Saltmere Docks (`hauler_purge`) do. New
`arc_purge` (1x `arc_sentinel`, xp 10, copper 6) fills that in with
the same shape.

Not doing: adding a 4th "elite" role to every zone speculatively. The
other three zones already have a fully-owned, distinctly-statted
3-role roster with no missing piece — there's no equivalent concrete
gap to close there, and manufacturing one would be decorative padding,
not the kind of change this project's builds have made so far.

## Non-goals

No 5th zone (see above). No balance/tuning changes to existing
items/enemies. No new mechanics — every change here is a new row in an
existing table (items, loot table entries, vendor stock, one enemy,
one objective).

## File footprint

`items.ts`, `lootTables.ts`, `vendorStocks.ts`, `enemies.ts`,
`zones.ts`, `spawnZones.ts`, `objectives.ts`, `types.ts` (EnemyId +
ObjectiveId extended) — content-data rows only. `en.ts` +
`LocaleTypes.ts` — new keys. No `CombatRoom.ts`/`TownRoom.ts`/
`waypointService.ts`/`interactValidation.ts` changes — no new zone, no
new gate, nothing here needs room logic, only content data every one
of those already resolves generically from `contentRegistry`.

## Verification

`test/content/contentRegistryValidation.test.ts` (existing) re-checks
every new row automatically — regression-checked the same way 0.18 did
(temporarily typo an id, confirm it fails, restore).
`test/combat/staticYardObjectiveCoverage.test.ts` gets a second `it`:
an `arc_sentinel` kill in a `static_yard` `CombatRoom` advances
`arc_purge` — proves the roster swap actually spawns the new enemy and
the new objective's kill-tracking works, not just that the data is
well-formed. Regression-checked the same way as every prior zone
test (temporarily point the heavy anchor spawn pocket back at
`trashboar_brute`, confirm the new test fails, restore).

## Start-of-session check

Working tree confirmed to match exactly what 0.13–0.18 (+ the
production hotfix at §11 of the Prisma investigation doc) left off —
same file set, nothing unexplained, still zero commits. `pnpm -r
typecheck` clean before starting.
