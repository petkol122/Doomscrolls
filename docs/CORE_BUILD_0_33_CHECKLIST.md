# docs/CORE_BUILD_0_33_CHECKLIST.md — Core Build 0.33 Checklist

---

## Core 0.33 Checklist

**Date:** 2026-09-07
**Build:** Core Build 0.33
**Theme:** Nightmarket Real City-Center Expansion
**Status:** Implemented and verified, including the follow-up hard-landmark/flexible-building placement redo. Two Overpass research gaps (Kopeckého sady/Křižíkovy sady coordinates, precise river clip) were closed with real data, final numbers were computed, and Waves 2–5 were executed in the same pass. A real gap (a whole missed content file, `spawnPoints.ts`) was found by the live check and fixed before closing this checklist. A second follow-up pass then individually re-anchored the 5 hub services to specific real landmarks (Cathedral, City Hall, a confirmed ČSOB branch, the Great Synagogue, a real pawnbroker), including the explicit, accepted decision to leave the Waypoint ~350 m from the rest at the real Synagogue — see the new section below.

### Follow-up: Hard-Landmark / Flexible-Building Placement Redo

- [x] Confirmed the task's own guess via Overpass: a real ČSOB branch sits ~43 m from Zbrojnická
- [x] Found and resolved real pubs/bars/hotels/shops within the historic core (12 bars, 7 pubs, 9 hotels, 167 shops) to ground the flexible-building assignments in real, named, existing buildings — not invented ones
- [x] Assigned Trainer→Cathedral, Notice Board→City Hall, Stash Keeper→ČSOB, Waypoint→Great Synagogue (hard landmarks); Vendor→a real pawnbroker (flexible building)
- [x] Named real reserved locations for future professions (fishing near Saltmere Docks' riverside anchor, cooking near a real bakery, hunting/gathering near a real farm shop) — none built; added `docs/WORLD_VISION.md` Section 8
- [x] Added an explicit "Committed" subsection to `docs/WORLD_VISION.md` Section 2: faster transport (mount/car/tram) is a real future direction, not speculative, and is the reasoning behind accepting the Waypoint's real distance now (no live players yet)
- [x] **Real collision found and fixed while implementing**: `nightmarket_trainer_01`'s planned exact-Cathedral coordinate was identical to `nightmarket_blackwire_gate_01`'s already-shipped position (the Blackwire corridor transform's own origin) — nudged Trainer ~250 units instead of disturbing the gate's corridor math
- [x] Updated `objectiveTurnInRace.test.ts`/`repeatableObjective.test.ts` to the notice board's new City Hall coordinate
- [x] `pnpm -r typecheck` clean
- [x] Full test suite green (41/75) — a first run hit a known, pre-existing, transient Windows worker crash unrelated to these changes; a clean re-run passed fully
- [x] Live Playwright check: confirmed via the zone's debug overview that Waypoint renders isolated near the west edge, Notice Board/Stash Keeper render as separated points, Trainer/Blackwire Gate render close but distinguishable (collision fix confirmed); zero console errors
- [x] `restAreaBounds` consequence (4 of 5 services now sit outside the rest area) disclosed explicitly, not expanded — expanding it would stretch the "safe" mechanic into the corridor's own live enemy pockets
- [x] `docs/CORE_BUILD_0_33_RELEASE_NOTES.md` updated with a new "Follow-up" section
- [x] No commit made — working tree was not clean at the start

### Planning Deliverables

- [x] Create `docs/CORE_BUILD_0_33_PLAN.md`
- [x] Create `docs/CORE_BUILD_0_33_CHECKLIST.md`
- [x] Confirm Nightmarket's load-bearing status by direct reading: `startingZoneId` for the only origin (`sewer_dweller`), all 4 combat zones' `transitionZoneIds` pointing back to it, 16 server test files that reference it, and — corrected by direct grep against the file before implementation — **97** `worldProps` (not the original miscount of 60) + 3 `spawnZones` + 1 `restAreaBounds` keyed to it
- [x] Research the real footprint: confirmed Náměstí Republiky is 139 × 193 m
- [x] Found a real, named, legally-defined natural boundary: the Okružní městské sady six-segment park ring, built on the demolished medieval fortification line, a protected monument since 1958, coincident with the Municipal Heritage Reserve declared in 1989
- [x] **Closed both remaining research gaps with real data**: a follow-up Overpass query (`way["name"~"sady"]`, avoiding diacritics-encoding risk) resolved Kopeckého sady's and Křižíkovy sady's own real coordinates from their actual multi-segment OSM geometry (9 and 7 real points respectively, averaged); a precise river re-clip **corrected an earlier wrong assumption** — the Radbuza's real closest approach to the core is southeast (near real streets Anglické nábřeží/Radbuzská náplavka), not west/southwest as first assumed from nearby street names alone
- [x] Computed the full real ring envelope from every point across all six segments (not a single anchor): **737 m × 757 m**
- [x] Confirmed/refuted the ~25.9 units-per-meter coincidence via a full `git log -p` audit — concluded near-certainly coincidental; **adopted `WORLD_UNITS_PER_METER = 25.9` deliberately** (Option A)
- [x] Computed final bounds (`19080 × 19613`) and 6 final anchor coordinates (cathedral/hub, City Hall, and 4 gate anchors) from the real footprint × the adopted constant
- [x] Generated the full old→new coordinate mapping (all 97 `worldProps`, 3 `spawnZones`, `restAreaBounds`) via systematic, formula-driven transforms (a per-axis hub scale, a Blackwire-corridor similarity transform, a whole-zone boundary rescale, 3 rigid gate-cluster translations) — validated 0 out-of-bounds results before applying

### Core 0.33 Scope Guardrails

- [x] No building geometry/collision system added
- [x] No interiors added
- [x] No other district (Bory/Slovany/Lochotín/Vinice) added — cross-reference only, per `docs/WORLD_VISION.md`
- [x] No evil/mirror-realm content added — cross-reference only
- [x] No time-gated reveal system added
- [x] The four-river confluence/brewery area is not pulled into this zone's footprint (real confluence point precisely located, ~1.21 km out, deliberately excluded)
- [x] Every relocated prop/spawn-zone/spawn-point keeps its existing `id` — only coordinates changed
- [x] All 4 combat-zone gates and all 5 service NPCs remain reachable and functional after relocation — confirmed both by the passing real-integration server tests (which exercise `request_interact` at the exact new coordinates) and by a live Playwright session
- [x] All 4 identified hardcoded test-literal exposures updated in the same pass as the coordinate migration, not left stale
- [x] `pnpm -r typecheck` clean
- [x] Full existing test suite green (41 files / 75 tests), including all 4 updated tests

### Candidate Wave Checklist

#### Wave 1 — Planning
- [x] Plan and checklist written, then updated twice (gap closure, then implementation)
- [x] Real footprint researched, gaps closed, sourced
- [x] Scale coincidence audited via real git history, adopted deliberately
- [x] Migration approach and regression risk enumerated concretely
- [x] Plan approved per explicit instruction to proceed straight to implementation once gaps were closed

#### Wave 2 — Real Measurement
- [x] Follow-up Overpass query resolved Kopeckého sady's and Křižíkovy sady's own coordinates
- [x] River re-clip corrected the earlier west/southwest assumption to the real southeast course
- [x] Full real ring envelope computed (737 m × 757 m)
- [x] Units-per-meter constant confirmed (`25.9`, adopted as `WORLD_UNITS_PER_METER`)
- [x] Final Nightmarket `bounds` computed (`19080 × 19613`)

#### Wave 3 — Migration
- [x] Full old→new coordinate mapping table generated by script (97 `worldProps`, 3 `spawnZones`, `restAreaBounds`, plus 6 `spawnPoints` found and added mid-pass)
- [x] Mapping applied to `worldProps.ts`, `spawnZones.ts`, `zones.ts`, `spawnPoints.ts`
- [x] `WORLD_UNITS_PER_METER` constant added to `types.ts`, re-exported from `index.ts`
- [x] All 4 identified test files updated to new coordinates (`combatHandoffPositionPersistence.test.ts`, `objectiveTurnInRace.test.ts`, `repeatableObjective.test.ts`, `deathReturnsToTown.test.ts`)
- [x] Stale comment in `resolveWorldAreaBounds.ts` corrected

#### Wave 4 — Verification (priority)
- [x] Full suite green (41/75) including all 4 updated tests
- [x] `pnpm -r typecheck` clean
- [x] Live Playwright check: real registration → character creation → "Enter World", Debug Panel confirms `Zone ID: nightmarket`, real spawn position matches the computed new coordinate exactly, "World Area" debug overview visually confirms the relocated service cluster, the Blackwire corridor with live escalating enemies, and the Cinderworks gate rendering far north. Zero console errors across two full live runs.

### Real bug found during the live check, fixed before closing this checklist

- [x] **A whole content file, `spawnPoints.ts`, was missed by the original inventory** (which covered only `worldProps.ts` and `spawnZones.ts`). The first live check showed a fresh character's Debug Panel reporting `Synced position: x=250, y=300` — the old placeholder spawn coordinate, now far outside the new hub.
- [x] Root-caused directly: `spawnPoints.ts` governs where a character lands, a distinct concern from where props render or enemies spawn.
- [x] Fixed: all 6 nightmarket spawn points remapped through the same transforms as their corresponding regions.
- [x] Broadened the regression sweep once this surfaced, catching a 4th coordinate-dependent test (`deathReturnsToTown.test.ts`) — fixed in the same pass.
- [x] Re-verified live, not just typechecked: a fresh character now spawns at `(8311, 10761)`, the exact new `nightmarket_spawn` coordinate, confirmed via the Debug Panel in a second live run. Zero console errors.

#### Wave 5 — Docs
- [x] `docs/CORE_BUILD_0_33_RELEASE_NOTES.md` written, naming the `spawnPoints.ts` gap explicitly and the follow-up sequence (density pass, real district additions, the confluence/brewery area as a future zone, a closer visual pass on the Static Yard/Saltmere Docks gates specifically)

### Explicit Non-Goals / Deferred Items

- [x] Building geometry/collision — not this build
- [x] Interiors — not this build
- [x] Other districts (Bory, Slovany, Lochotín, Vinice) — see `docs/WORLD_VISION.md`
- [x] Evil/normal-realm mirror concept — see `docs/WORLD_VISION.md`
- [x] Time-gated reveal system — not this build
- [x] Four-river confluence / brewery area — future zone, not this footprint
- [x] Second city/area (Prague, České Budějovice) — see `docs/WORLD_VISION.md`
- [x] Level-gating / origin-phasing visibility — see `docs/WORLD_VISION.md`
- [x] New world props/spawn zones for density at the larger scale — real follow-up, not solved here

### Exit Criteria

- [x] Core Build 0.33 has a clear theme grounded in a direct audit of Nightmarket's current load-bearing role
- [x] The real-footprint question was answered with actual sourced, fully-closed research (no remaining flagged gaps) — including a real correction (the river's actual southeast course) found only by re-clipping
- [x] The scale-coincidence question was answered by auditing real git history and adopted deliberately, not left open
- [x] The migration approach preserved every existing service's functionality by construction (`id`-based, not position-based) — confirmed by both automated tests and a live session
- [x] Regression risk was enumerated concretely, and a real gap in that enumeration (`spawnPoints.ts`, a 4th test) was found live and fixed, not silently missed
- [x] Explicit non-goals are named, cross-referencing `docs/WORLD_VISION.md` where relevant
- [x] All waves completed: planning, real measurement, migration, verification (typecheck + full suite + live check), docs
- [x] No commit made — the working tree was not clean at the start of this build, per the standing no-commit-unless-clean-tree rule
