# docs/CORE_BUILD_0_19_RELEASE_NOTES.md — Core Build 0.19 Release Notes

---

## Task — Rarity Matrix, Fully Closed + Static Yard's Last Borrowed Enemy

**Date:** 2026-09-02
**Build:** Core Build 0.19
**Status:** Implemented and verified in one pass. Working-tree only — nothing committed.

### Summary

0.18 closed the worst rarity cliff in the game (weapon/head/chest/hands
had zero rare items) by shipping a 4th zone, and named — rather than
silently left open — what it deliberately didn't touch: `ring_1` and
`amulet` had only their single rare each, and `feet`/`belt`/`flask_1`
had no epic. Reading `items.ts` directly before proposing anything for
this build turned up one thing 0.18's own summary understated:
`flask_1` isn't just missing an epic, it had **no rare either** —
`starter_blood_flask` was the only flask item in the game. That's the
same single-tier shape as `ring_1`/`amulet`, just not labeled that way.

0.18's own bar for shipping a 4th zone was explicit: show it closes a
structural gap the existing zones don't, not just repeat the formula
(0.17 had already turned down a zone for being exactly that repeat).
That gap — a whole rarity tier missing across four core slots — is now
fully closed by this build's item pass, and there's no comparably
concrete gap left to justify a 5th zone. A 5th zone this build would
have been the manufactured repeat 0.17 already declined once. The two
gaps that *are* concrete and sitting in the code right now are the rest
of the rarity matrix, and Static Yard's heavy anchor — still a reused
`trashboar_brute` from Blackwire, the only combat zone without a fully
zone-owned enemy roster. Both got closed this build; nothing else was
manufactured to pad it out.

Planning doc: `docs/CORE_BUILD_0_19_PLAN.md`.

### What changed — items (8 new, every equipment slot now has all 3 tiers)

- **`ring_1`**: `frayed_signet` (common, armor+1) and `voidglass_band`
  (epic, armor+2/maxHp+14) join `rustbound_ring` (rare) in the same 3
  sewer loot tables it already lived in.
- **`amulet`**: `scavenged_cord` (common, mind+1) and `resonant_choker`
  (epic, mind+4/moveSpeed+0.1) join `signal_scarred_amulet` (rare) in
  the same 4 tables it already lived in (3 sewer tables +
  `static_yard_loot`).
- **`flask_1`**: `sealed_blood_flask` (rare, restoreHpInstant 35/3
  charges) and `vital_reserve_flask` (epic, restoreHpInstant 45/4
  charges). Flasks have only ever been vendor-obtainable — the rare
  follows that path (new vendor stock entry); the epic follows the 0.7
  "epics are drop-only" rule instead, joining the shared Blackwire-
  family epic pool.
- **`feet`**: `voltbound_greaves` (epic, moveSpeed+0.28/armor+2) —
  joins Static Yard's own epic pool, completing the slot the zone
  already claims via `voltbound_treads` (rare).
- **`belt`**: `cinderbound_girdle` (epic, toughness+3/armor+2) — joins
  Cinderworks' own epic pool, completing the slot it already claims via
  `slagbound_charm` (rare).

`vendorStocks.ts` gained 3 entries: the two new commons (matching 0.5's
precedent of giving every equipment-slot-coverage common item a
guaranteed non-RNG path) and the new flask rare. No existing item's
stats or loot placement changed. Item total: 29 → 37.

### What changed — Static Yard's own heavy anchor

- **`enemies.ts`**: `arc_sentinel` — same heavy-attack telegraph shape
  and stat profile as `foundry_warden`/`drowned_hauler` (maxHp 34,
  damage 4/heavy 7, armor 1).
- **`zones.ts`** / **`spawnZones.ts`**: replaces `trashboar_brute` in
  `static_yard.enemyIds` and in the zone's heavy anchor spawn pocket.
  Static Yard's roster is now fully its own, matching every other
  combat zone — no `CombatRoom.ts`/`TownRoom.ts` changes needed, the
  swap is pure content data.
- **`objectives.ts`**: `arc_purge` (1x `arc_sentinel`, xp 10, copper 6)
  — closes a second gap this surfaced along the way: Static Yard never
  had a single-heavy-kill "purge" objective the way Cinderworks
  (`foundry_purge`) and Saltmere Docks (`hauler_purge`) do. Appended to
  `NOTICE_BOARD_OBJECTIVE_SEQUENCE`.

### Verification

Per `AGENTS.md`'s "Verification Must Be Permanent" rule:

**In-process (`pnpm --filter @doomscrolls/server test` — 25 files, 39
tests, all passing, up from this build's own starting point of 25
files / 38 tests):**

- `test/combat/staticYardObjectiveCoverage.test.ts` gained a second
  `it`: an `arc_sentinel` kill in a `static_yard` `CombatRoom` advances
  `arc_purge` — proves the roster swap actually spawns the new enemy
  and the new objective's kill-tracking works, not just that the data
  is well-formed. Regression-checked: temporarily pointed the heavy
  anchor spawn pocket back at `trashboar_brute`, confirmed the test
  fails (`expected undefined to be defined`), restored, re-verified
  green.
- `test/content/contentRegistryValidation.test.ts` (0.16's addition,
  re-run automatically): regression-checked against this build's new
  data — temporarily typo'd `cinderbound_girdle`'s id inside
  `cinderworks_loot`, confirmed the test fails with `Unknown item id:
  cinderbound_girdle_typo`, restored, re-verified green.

**Typecheck:** `pnpm -r typecheck` — 0 errors across all 5 workspace
packages. Required rebuilding `@doomscrolls/localization` and
`@doomscrolls/content` dist output first, same as every content build
since 0.16.

**Test-run stability note:** the full suite ran clean on the first
attempt every time it was run this session — no instance of the
already-documented, already-root-caused transient Windows-native Prisma
query-engine crash (see
`docs/PRISMA_WINDOWS_TEARDOWN_CRASH_INVESTIGATION.md`). Not evidence
the flake is gone, just this session's observed rate; the investigation
that closed it (§10/§11) remains the reference for what to do if it
recurs (rerun the suite).

### Non-goals held

No 5th zone — 0.18's own bar for a new zone (close a structural gap the
existing zones don't) is fully satisfied by this build's item pass;
nothing comparably concrete remains to justify one. No speculative
"elite" enemy added to the three zones that already have a fully-owned
roster — only Static Yard had an actual, concrete gap. No balance or
tuning changes to any existing item or enemy. No new mechanics — every
change here is a new row in an existing table (items, loot table
entries, vendor stock, one enemy, one objective).

### Working-tree state

Nothing was committed at any point in this build. This build's changes
land on top of the existing uncommitted Core Build 0.13–0.18 diffs
already in the tree; a future commit sequence should land all builds
separately, in build order.
