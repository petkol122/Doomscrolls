# docs/CORE_BUILD_0_33_RELEASE_NOTES.md — Core Build 0.33 Release Notes

---

## Task — Nightmarket Real City-Center Expansion

**Date:** 2026-09-07
**Build:** Core Build 0.33
**Status:** Implemented and verified.

### Summary

Nightmarket's coordinate space grew from a small placeholder box (`5000 × 3600` units) to real Plzeň-historic-center scale (`19080 × 19613` units), grounded in real OpenStreetMap geography researched and fetched live during planning — a real, named, legally-protected park-ring boundary (Okružní městské sady, built on the demolished medieval fortification line), the real square's real dimensions, and real riverside streets. Every existing service, gate, spawn point, and spawn zone was relocated (not rebuilt) to a real-world-grounded position via systematic, formula-driven transforms rather than hand-guessed coordinates. Pure geography, layout, and scale — no new content, no building geometry/collision, no interiors.

### What changed

- **`packages/content/src/data/types.ts`** — new `WORLD_UNITS_PER_METER = 25.9` constant, adopted deliberately after a full git-history audit found the exact same ratio already implicit in Nightmarket's old bounds (a coincidence, not something anyone had intended — see the plan's Question 2).
- **`packages/content/src/index.ts`** — re-exports `WORLD_UNITS_PER_METER`.
- **`packages/content/src/data/zones.ts`** — Nightmarket's `bounds` → `{ minX: 0, maxX: 19080, minY: 0, maxY: 19613 }`; `restAreaBounds` → `{ minX: 7631, maxX: 10431, minY: 9398, maxY: 13033 }`.
- **`packages/content/src/data/worldProps.ts`** — all 97 nightmarket-zoned props relocated (a corrected count — an earlier miscount of 60 was caught and fixed before implementation). Every `id`, `kind`, `label`, and `labelKey` is unchanged; only `x`/`y` moved, via one of four transforms: a per-axis hub scale (service cluster, sized to the real square's real 139×193m footprint), a rotate+scale+translate similarity transform for the Blackwire approach corridor (44 props, oriented toward the real Smetanovy sady bearing), a whole-zone rescale for the 22 generic boundary markers, and three rigid gate-cluster translations (Static Yard → Křižíkovy sady, Cinderworks → the real north ring point, Saltmere Docks → the real riverside embankments).
- **`packages/content/src/data/spawnZones.ts`** — the 3 nightmarket spawn zones (`sewer_edge_trashboar_runt_zone`/`_skitter_zone`/`_brute_zone`) relocated along the same Blackwire corridor transform, box size scaled uniformly to match.
- **`packages/content/src/data/spawnPoints.ts`** — all 6 nightmarket spawn points relocated. **Found live, not in the original migration pass**: the first live Playwright check showed a fresh character spawning at `(250, 300)` — the *old* placeholder coordinate, now far outside the new hub — because `spawnPoints.ts` was a whole content file this build's original inventory missed entirely (it tracks *where a player lands*, distinct from `worldProps.ts`'s *where a prop renders*). Fixed in the same pass: all 6 entries remapped through the same transforms as their corresponding worldProps groups.
- **`apps/server/test/town/combatHandoffPositionPersistence.test.ts`**, **`objectiveTurnInRace.test.ts`**, **`repeatableObjective.test.ts`** — updated hardcoded coordinates (Blackwire Gate, notice board) to their real new positions.
- **`apps/server/test/combat/deathReturnsToTown.test.ts`** — a 4th coordinate-dependent test, found during the same broadened sweep that caught the `spawnPoints.ts` gap: asserted the old `nightmarket_blackwire_combat_entry` spawn-point coordinates literally; updated to the new ones.
- **`apps/client/src/game/scenes/accountShell/resolveWorldAreaBounds.ts`** — corrected a stale comment that had claimed to match "the current Nightmarket test-arena definition" (false since well before this build).

### Real research behind the placements (see `docs/CORE_BUILD_0_33_PLAN.md` for full detail)

- Plzeň's historic core is bounded by a real, named, twice-legally-protected boundary: the Okružní městské sady park ring (six segments — Křižíkovy, Šafaříkovy, Kopeckého, Smetanovy, sady 5. května, sady Pětatřicátníků), built on the demolished medieval fortification line, a monument since 1958, enclosing the Municipal Heritage Reserve declared in 1989.
- All six ring segments now have real, computed coordinates from actual Overpass API data (two — Kopeckého sady, Křižíkovy sady — were resolved in a follow-up query after the first pass found them by name only).
- A real river re-clip **corrected an earlier wrong assumption**: the Radbuza's real, present-day closest approach to the core is southeast (near real riverside streets Anglické nábřeží/Radbuzská náplavka), not west/southwest as first assumed from nearby street names alone.
- Real footprint: **737 m × 757 m** (measured, not estimated), giving final bounds of `19080 × 19613` at `25.9` units/meter.
- Static Yard's gate anchors to Křižíkovy sady — genuinely named after František Křižík, the real historical pioneer of Czech electrical/tram engineering, a sourced match for a tram-yard zone with an enemy literally named `arc_sentinel`.
- Blackwire Sewers' gate anchors to Smetanovy sady (southwest) rather than literally atop the real Historické podzemí underground-passage network (which sits almost exactly at the square) — an explicit, disclosed judgment call preserving this zone's existing tested escalating-danger approach pacing (Task 279's own "aggro feel tuning") rather than collapsing that distance to zero.

### A real gap found and fixed by the live check, not left as a "found, not fixed" note

The first live Playwright check (real account registration → character creation → "Enter World", in a real headless Chromium session) showed the Debug Panel's own `Synced position: x=250, y=300` — the old placeholder spawn coordinate — for a character that should have landed inside the new hub. Root cause, confirmed directly: `spawnPoints.ts` governs where a player actually lands and was never part of the original 97-prop inventory, which only covered `worldProps.ts` (where things render) and `spawnZones.ts` (where enemies spawn). Fixed by migrating all 6 nightmarket spawn points through the same transforms as their corresponding regions, and by broadening the regression sweep, which caught a 4th coordinate-dependent test (`deathReturnsToTown.test.ts`) referencing one of those same spawn points. Re-verified live: a fresh character now spawns at `(8311, 10761)`, exactly the computed new `nightmarket_spawn` position, confirmed via the Debug Panel in a second live run.

### Verification

- **`pnpm -r typecheck`** — clean across all 5 relevant workspace packages (unchanged from before this build; no new locale keys were added).
- **Full server test suite**: 41 files / 75 tests, all green — including the 4 updated coordinate-dependent tests (`combatHandoffPositionPersistence.test.ts`, `objectiveTurnInRace.test.ts`, `repeatableObjective.test.ts`, `deathReturnsToTown.test.ts`) and the unmodified `contentRegistryValidation.test.ts`/`worldMapScalability.test.ts`, which pass against the real migrated registry automatically.
- **Live Playwright check** (scratchpad-only, a one-time `npm install playwright` in the scratchpad directory, no repo dependency added): real account registration, real character creation (`sewer_dweller` origin, `gravewalker` class), real "Enter World" join, confirmed via the in-game Debug Panel — `Room kind: town`, `Zone ID: nightmarket`, `Synced position: x=8311, y=10761` (the new `nightmarket_spawn`'s exact computed coordinate) — and via the zone's own "World Area" debug overview, which visually renders the relocated service cluster (notice board, vendor, stash keeper, trainer, waypoint, Blackwire Gate all clustered together near the town center), the Blackwire approach corridor with its live enemies (Trashboar Skitter, Trashboar Brute, correct HP) escalating correctly toward the southwest, and the Cinderworks Gate rendering far to the north as intended. Zero console errors across two full live runs (pre-fix and post-fix).
- **No commit made**: the working tree was not clean at the start of this build (pre-existing uncommitted changes from other in-progress work, per the initial git status), so per the standing no-commit-unless-clean-tree rule, all changes remain in the working tree for the user's own review and commit.

### Non-goals held

No building geometry/collision; no interiors; no other districts (Bory, Slovany, Lochotín, Vinice — see `docs/WORLD_VISION.md`); no evil/mirror-realm concept; no time-gated reveal system; the four-river confluence and Pilsner Urquell brewery area were explicitly not pulled into this zone's footprint; no second city/area; no level-gating; no new world props/spawn zones added for density.

### Queued follow-ups (named explicitly)

1. **A density/prop-count pass** — 97 relocated props are now spread across a footprint roughly 14× the old one's area. Adding new ambient content at the larger scale is real follow-up work, not solved here (this build relocates existing content, it does not add new content).
2. **Real district additions** (Bory, Slovany, Lochotín, Vinice) — per `docs/WORLD_VISION.md`'s district-per-zone pattern, one at a time.
3. **The four-river confluence / Pilsner Urquell brewery area** as its own future zone — real, named, ~1.21 km from the square, deliberately excluded from this build's footprint.
4. **Static Yard and Saltmere Docks gates were not individually screenshotted up close** in this pass's live check (the "World Area" debug overview's own fixed display width visually clipped before reaching them); their coordinates were computed by the same validated transform as every other gate and are covered by the passing automated test suite, but a closer visual pass on those two specifically would be a reasonable, cheap follow-up.

---

## Follow-up — Hard-Landmark / Flexible-Building Placement Redo

**Date:** 2026-09-07 (same day, follow-up pass)
**Status:** Implemented and verified.

### Summary

The 5 hub service props (Trainer, Notice Board, Stash Keeper, Vendor, Waypoint), which the base build above placed together as one cluster, were individually re-anchored to specific real landmarks researched via the Overpass API — splitting "hard landmarks" (real, confirmed, non-negotiable) from "flexible buildings" (a believable real building *type*, not a claim about a specific business's current use). See `docs/CORE_BUILD_0_33_PLAN.md`'s Question 3 Addendum for the full research and reasoning.

### What changed

- **`packages/content/src/data/worldProps.ts`**:
  - `nightmarket_trainer_01` → `(9311, 10838)` — the real Cathedral (Katedrála sv. Bartoloměje), nudged ~250 units (~8 m) from the exact landmark point to avoid sitting pixel-identical to `nightmarket_blackwire_gate_01`, which already occupies that exact coordinate as the Blackwire corridor's own transform origin. **A real collision found and fixed while implementing**, not left as a stacked-prop bug.
  - `nightmarket_notice_board_01` → `(9449, 8467)` — the real City Hall (Magistrát města Plzně).
  - `nightmarket_stash_keeper_01` → `(10648, 13967)` — a real, confirmed ČSOB branch (~43 m from Zbrojnická) — the task's own guess, verified correct via Overpass.
  - `nightmarket_vendor_01` → `(17005, 13246)` — a real pawnbroker ("Get Cash Plzeň"), a flexible-building assignment (believable type, not a specific-use claim).
  - `nightmarket_waypoint_01` → `(173, 13323)` — the real Great Synagogue, genuinely ~350 m from the other three hard landmarks. **Accepted deliberately, not forced closer**: the game has no live players yet, and faster transport (mount/car/tram) is a real, committed future direction for this project (see below) that will make this exact distance a non-issue once it exists.
- **`docs/WORLD_VISION.md`** — new "Committed" subsection under Section 2 (Scale philosophy): faster transport is now stated as a real committed future direction, not left implied, with this exact Waypoint-at-Synagogue decision cross-referenced as a concrete example of the principle in practice. Section 6's "undecided" list updated to reflect that *whether* faster transport exists is no longer open — only its concrete form and timing remain undecided.
- **`apps/server/test/town/objectiveTurnInRace.test.ts`**, **`repeatableObjective.test.ts`** — updated the notice board's hardcoded coordinate to its new City Hall position.

### Verification

- **`pnpm -r typecheck`** — clean.
- **Full server test suite**: 41 files / 75 tests, all green (a first run hit a transient Windows worker access-violation crash unrelated to these changes — a known class of pre-existing flakiness in this environment, see `docs/PRISMA_WINDOWS_TEARDOWN_CRASH_INVESTIGATION.md`; a clean re-run passed fully).
- **Live Playwright check**: real registration → character creation → "Enter World," confirmed via the zone's "World Area" debug overview that the Waypoint now renders clearly isolated near the zone's west edge, Notice Board and Stash Keeper render as distinct points separated from the original cluster (north and south respectively), and Trainer/Blackwire Gate render close together but visually distinguishable (confirming the collision fix). Zero console errors. Vendor's own new position, like the base build's Static Yard/Saltmere Docks gates, sits past this debug panel's own fixed display width and wasn't individually screenshotted — covered by the passing test suite and the same validated transform as everything else.

### A real consequence, disclosed and accepted

`restAreaBounds` (the HP/flask-restore rest area) was sized around the base build's single tight cluster and was **not** expanded to cover the newly-spread-out services — only the Trainer (at the nudged near-Cathedral point) still sits inside it. Notice Board, Stash Keeper, Vendor, and Waypoint are now real destinations a player walks to for a specific service, outside the rest area proper. Expanding the rest area to cover the full spread was considered and rejected: it would stretch the "safe" mechanic out along the Blackwire corridor toward its own live enemy pockets.

### Validation

```bash
pnpm -r typecheck
pnpm --filter @doomscrolls/server test
```

No commit made — the working tree was not clean going into this build (pre-existing uncommitted changes from other in-progress work sat in the tree beforehand), per the standing no-commit-unless-clean-tree rule.
