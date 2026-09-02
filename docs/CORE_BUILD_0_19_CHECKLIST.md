# docs/CORE_BUILD_0_19_CHECKLIST.md — Core Build 0.19 Checklist

---

## Core 0.19 Checklist

**Date:** 2026-09-02
**Build:** Core Build 0.19
**Theme:** Rarity matrix, fully closed + Static Yard's last borrowed
enemy
**Status:** Implemented and verified in one pass.

### Start-of-session check

- [x] Confirmed working tree still matches exactly what 0.13–0.18 (+
      the production hotfix at §11/§11.1 of the Prisma investigation
      doc) left off — same file set, nothing unexplained, still zero
      commits
- [x] `pnpm -r typecheck` clean before starting

### Part 1 — Rarity matrix, fully closed

- [x] Confirmed by reading `items.ts` directly: `ring_1`/`amulet` were
      rare-only (no common, no epic); `flask_1` was common-only (no
      rare, no epic — a gap 0.18's own notes understated as "no epic");
      `feet`/`belt` had common+rare but no epic
- [x] `items.ts`: 8 new items — `frayed_signet`/`voidglass_band`
      (ring_1 common/epic), `scavenged_cord`/`resonant_choker` (amulet
      common/epic), `sealed_blood_flask`/`vital_reserve_flask` (flask_1
      rare/epic), `voltbound_greaves` (feet epic), `cinderbound_girdle`
      (belt epic) — every item plugs one named cell, none added for its
      own sake
- [x] `lootTables.ts`: new ring_1/amulet items added to the same tables
      their existing rare already lives in (extending distribution, not
      redesigning it); flask_1's epic joins the shared Blackwire-family
      epic pool (0.7's "epics are drop-only" rule); feet's epic joins
      Static Yard's own epic pool; belt's epic joins Cinderworks' own
      epic pool
- [x] `vendorStocks.ts`: new commons (`frayed_signet`, `scavenged_cord`)
      get guaranteed vendor obtainability, matching the 0.5 precedent;
      flask_1's new rare (`sealed_blood_flask`) is vendor-sold, matching
      `starter_blood_flask`'s own vendor-only acquisition path and how
      `signal_scarred_amulet` is already vendor-sold at rare
- [x] After this build every equipment slot in the game has common,
      rare, and epic representation — a clean, verifiable stopping
      point

### Part 2 — Static Yard's last borrowed enemy

- [x] Confirmed by reading `zones.ts`: Static Yard was the only combat
      zone still reusing another zone's enemy (`trashboar_brute`) for
      its heavy role; Cinderworks/Saltmere Docks both got a fully
      zone-original heavy when built
- [x] `enemies.ts`: `arc_sentinel` — Static Yard's own heavy anchor,
      same heavy-attack telegraph shape and stat profile as
      `foundry_warden`/`drowned_hauler`
- [x] `zones.ts`: `static_yard.enemyIds` — `trashboar_brute` replaced
      with `arc_sentinel`
- [x] `spawnZones.ts`: heavy anchor pocket (`static_yard_brute_anchor`
      → `static_yard_sentinel_anchor`) now spawns `arc_sentinel`
- [x] `objectives.ts`: new `arc_purge` (1x `arc_sentinel`, xp 10,
      copper 6) — closes the second gap this surfaced: Static Yard had
      never had a single-heavy-kill "purge" objective the way
      Cinderworks/Saltmere Docks do. Appended to
      `NOTICE_BOARD_OBJECTIVE_SEQUENCE`
- [x] `types.ts`: `EnemyId` gained `arc_sentinel`, `ObjectiveId` gained
      `arc_purge`

### Non-goals held

- [x] No 5th zone — 0.18's own bar for a new zone (closes a structural
      gap the existing zones don't) is fully satisfied by this build's
      item pass; nothing comparably concrete left to hang a 5th zone on
- [x] No speculative "elite" enemies added to the three zones that
      already have a fully-owned roster — only Static Yard had an
      actual, concrete gap (a borrowed enemy)
- [x] No balance/tuning changes to any existing item or enemy
- [x] No new mechanics — every change is a new row in an existing table

### Localization

- [x] `en.ts` + `LocaleTypes.ts`'s `REQUIRED_LOCALIZATION_KEYS`: all new
      keys added (1 enemy, 8 items, 1 objective)

### Verification

- [x] `pnpm -r typecheck` — 0 errors across all 5 workspace packages
      (rebuilt `@doomscrolls/localization` and `@doomscrolls/content`
      dist output first)
- [x] `pnpm --filter @doomscrolls/server test` — 25 files, 39 tests, all
      passing (up from the 25 files / 38 tests this build started from)
- [x] **New**: `test/combat/staticYardObjectiveCoverage.test.ts` gained
      a second `it` — an `arc_sentinel` kill in a `static_yard`
      `CombatRoom` advances `arc_purge`, proving the roster swap
      actually spawns the new enemy and the new objective's kill-
      tracking works. Regression-checked: temporarily pointed the heavy
      anchor spawn pocket back at `trashboar_brute`, confirmed the new
      test fails (`expected undefined to be defined` — no
      `arc_sentinel` spawned), restored, re-verified green
- [x] Regression-checked `test/content/contentRegistryValidation.test.ts`
      against this build's new data: temporarily typo'd
      `cinderbound_girdle`'s id inside `cinderworks_loot`, confirmed the
      test fails with `Unknown item id: cinderbound_girdle_typo`,
      restored, re-verified green
- [x] Full suite ran clean on the first attempt both before and after
      this build's changes — no Prisma crash hit during this session's
      verification passes (consistent with the already-documented
      transient/known Windows-only flake, not evidence it's gone)

### Working-Tree Discipline

- [x] Nothing committed at any point in this build — all changes land on
      top of the existing uncommitted 0.13–0.18 diffs already in the
      tree
