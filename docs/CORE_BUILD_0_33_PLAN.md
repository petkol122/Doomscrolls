# docs/CORE_BUILD_0_33_PLAN.md — Core Build 0.33 Plan

## Status

**Fully implemented and verified, including the hard-landmark/flexible-building redo.** The base build (bounds, gates, spawn points, spawn zones) was planned, gaps closed with real data, and implemented. The follow-up placement redo (Question 3 Addendum) — individually anchoring the 5 hub services to specific real landmarks, including the explicit decision to accept the Waypoint's real ~350 m distance from the rest rather than force it closer — was then reviewed, settled, and implemented in the same pass. See the Verification section for what was actually run.

---

## Core 0.33 Theme

**Nightmarket Real City-Center Expansion** — grow Nightmarket from its current small placeholder footprint to real Plzeň-city-center scale, grounded in actual researched geography (the historic core's real boundary, the real square's real dimensions, the real rivers), with every existing prop/spawn-zone/gate relocated to a plausible real position rather than left clustered in one corner. Pure geography, layout, and scale. No building geometry/collision, no interiors, no other districts, no mirror-realm concept, no time-gated reveal system — all named explicitly as out of scope below.

---

## Build Framing — why this needs care (audited before writing anything else)

Nightmarket is the single most load-bearing zone in the game, confirmed by direct reading, not assumed:

- It is `sewer_dweller`'s (the only origin that exists) `startingZoneId` — every new character's first real position.
- All 4 combat zones' `transitionZoneIds` point only at it (`blackwire_sewers`, `static_yard`, `cinderworks`, `saltmere_docks` — confirmed in `packages/content/src/data/zones.ts`), and it is the only zone whose own `transitionZoneIds` lists all four in return — the literal hub of the hub-and-spoke.
- Every server test that exercises `TownRoom` joins it by default (`requestedZoneId: "nightmarket"`), confirmed across 16 test files that reference it.
- **97** `worldProps` entries (corrected from an earlier miscount of 60 — confirmed by direct grep against the file: 101 total array entries, of which 4 belong to the combat rooms themselves via their own `zoneId` — `combat_return_to_nightmarket`, `static_yard_return_to_nightmarket`, `cinderworks_return_to_nightmarket`, `saltmere_docks_return_to_nightmarket` — and are unaffected by this build since those rooms' own bounds don't change), 3 `spawnZones` entries, and the zone's own `restAreaBounds` are all keyed to `zoneId: "nightmarket"` today.

Any change to its coordinate space has to account for all of the above by construction, not by afterthought — which is exactly why this plan enumerates the regression surface concretely in Question 4 rather than asserting it's fine.

---

## Question 1 — Real Footprint: What Actually Bounds "Historic Center Plus Immediately Surrounding Streets and the River Confluence"

### The real square (confirms the task's given figure)

Náměstí Republiky is **139 × 193 m**, a rectangular square at the center of the historic core, dominated by the Cathedral of St. Bartholomew — confirmed via web research, matching the figure already given exactly. A direct OpenStreetMap lookup of the square's own way geometry independently returned a bounding box of ~172 × 205 m (building-footprint extent, naturally a little larger than the paved square itself) — consistent, not contradictory.

### The real natural boundary: Plzeň's own park ring, not an arbitrary radius

This is a genuinely real, named, legally-defined boundary — exactly the kind the task asked to look for instead of a radius:

- Plzeň's historic core sits inside the **Okružní městské sady** ("Circular Municipal Gardens"), six specifically named park segments — **Křižíkovy sady, Šafaříkovy sady, Kopeckého sady, Smetanovy sady, sady 5. května, sady Pětatřicátníků** — that together form a closed ring around the medieval town.
- The ring was built in the first half of the 19th century (mayor Martin Kopecký, 1828–1850) directly on the site of the **demolished medieval town fortifications/moat**, replacing the wall line with green space. Křižíkovy and Šafaříkovy sady specifically date to 1803, right after the fortifications came down.
- The ring itself has been a protected cultural monument since **3 May 1958**, and the historic core it encloses (ground-plan "largely identical to the whole original Gothic town") was separately declared a **Municipal Heritage Reserve (Městská památková rezervace, MPR)** by government decree on **19 April 1989**. Two independent, real, official designations agree on the same boundary line.

**This ring is the natural boundary this build uses.** It is a real, walkable, historically-load-bearing edge — not the arbitrary-radius approach the task explicitly asked to avoid.

### Real OSM vector-data fetch (Overpass API) — all six ring segments resolved, gap closed

Real vector data was pulled for this one specific area via the Overpass API — small, focused queries, not a country extract. **All six named ring segments now have real, computed coordinates** (the two that were initially missing — Kopeckého sady and Křižíkovy sady — were resolved by a follow-up query matching `way["name"~"sady"]` across the wider box, which returned every real way tagged with any of the six names, regardless of whether it was tagged as a park, road, or pedestrian path; each segment's position was then computed as the average of its own real, multi-point OSM geometry, not a single guessed point):

| Segment | Representative real coordinate | East/North offset from square center | Distance/bearing |
|---|---|---|---|
| Sady Pětatřicátníků | 49.7471, 13.3740 (core); full segment spans −353 to −178 m East | −257 m East, −12 m North | west |
| Smetanovy sady | 49.7449811, 13.3746448 (park-tagged) | −212 m East, −253 m North | southwest |
| **Kopeckého sady** (resolved this pass) | 49.74469, 13.37839 (avg. of 9 real segments) | +58 m East, −286 m North | south |
| Šafaříkovy sady | 49.7454776, 13.3797506 (park-tagged) | +156 m East, −198 m North | southeast |
| **Křižíkovy sady** (resolved this pass) | 49.74681, 13.38045 (avg. of 7 real segments) | +206 m East, −49 m North | east-southeast — named after **František Křižík**, the real historical pioneer of Czech electrical/tram engineering |
| sady 5. května | 49.7480970, 13.3820526 (park-tagged) | +322 m East, +94 m North | east |
| Unnamed ring segment (way 1185514911) | 49.7512945, 13.3773918 | −14 m East, +450 m North | north |

**Full real ring envelope, computed from every point returned across all six segments** (not a single extrapolated anchor): **East −353 m to +383 m (span 737 m), North −307 m to +450 m (span 757 m)**. This is the final, closed footprint measurement — no longer a provisional range.

### The river — corrected by the real clip, not left at the earlier assumption

A precise re-clip was run specifically to close this gap. The result **corrected an earlier assumption**: the Radbuza's single tagged waterway way in OSM does not pass through the originally-drawn tight core box at all (its own geometry's closest node sits just outside it); pulling the full, unclipped way geometry and filtering to points near the core showed its closest real approach is **southeast** of the square, not west as first assumed from the presence of nearby street names alone.

Directly querying the two riverside street names themselves resolved this precisely:

- **Anglické nábřeží** — 49.7455454, 13.3822596 → **+336 m East, −190 m North (386 m, southeast)**
- **Radbuzská náplavka** — 49.7456263–49.7455923, 13.3828460–13.3829127 → **+379–383 m East, −181 to −185 m North (~420–426 m, southeast)**
- The nearest actual river-geometry node to the core: 49.7453554, 13.3829601 → **+387 m East, −211 m North (441 m)** — essentially the same point, confirming the embankment streets sit right where the river itself runs.

**Conclusion, corrected from the previous draft**: the real, present-day Radbuza runs along the **southeast** flank of the historic core, immediately adjacent to where Kopeckého sady (south) and Křižíkovy sady (east-southeast) meet — not the west/southwest side, and not particularly close to the Great Synagogue (which sits west, ~350 m away, and is not river-adjacent in reality). The historical detail from the previous draft — that the **Mlýnská strouha**, a filled-in-in-the-1920s side-arm of the Radbuza, once ran along the ring's east side with its right bank called **Královské nábřeží** — remains true as a separate historical layer, and is now understood to describe a different era's channel, not a substitute for today's real southeast course.

### The four-river confluence — a real feature, and a real judgment call about what belongs in *this* zone

Plzeň sits at the confluence of four rivers (Mže, Radbuza, Úhlava, Úslava), which together form the Berounka. The actual confluence point (Mže + Radbuza specifically, the two that join first) was located precisely: **49.7539984°N, 13.3908441°E** — the exact coordinate at which the Mže and Radbuza waterway ways both terminate/merge in the real OSM data. Computed distance from Náměstí Republiky's real center: **~1.21 km**. Úhlava and Úslava join at separate points further out still.

**Decision, flagged explicitly as a judgment call rather than something the task fully resolved**: pulling this zone's footprint 1.21 km out to physically reach the confluence would mean *replacing* the real park-ring boundary with an arbitrary reach to touch a landmark. Recommended and adopted: this zone's real geography reaches the river at the ring's natural southeast edge (the real Anglické nábřeží/Radbuzská náplavka embankments), while the actual quad-confluence and the brewery district remain a real, named, **separate** future zone/district — consistent with `docs/WORLD_VISION.md`'s district-per-zone pattern. Cross-referenced there, not merged into this build.

A second real, separate park — **Štruncovy sady** (and the adjoining **Areál Štruncovy sady** sports complex), ~537 m east — was also found by this fetch and correctly excluded: it is a different, further-out real park, not one of the six ring segments, confirming the ring boundary was applied consistently rather than loosely grabbing every nearby green space.

### Landmarks and streets found (unchanged from the previous draft, still real and sourced)

- **Katedrála sv. Bartoloměje** (Cathedral) — 49.7474833, 13.3775664 — effectively at the square's own center.
- **Magistrát města Plzně** (City Hall) — 49.7483577, 13.3777478 — ~123 m north of the cathedral.
- **Velká synagoga** (Great Synagogue) — 49.7466735, 13.3727727 — ~350 m west (a real landmark on its own terms; not river-adjacent, per the correction above).
- A real church/diocese cluster ~300 m south of the square.
- 32 real named streets inside the tight historic-core box, including **Historické podzemí** (the real historic underground-passage network beneath the Old Town) — used as layout reference only, per the "no building collision/interiors" non-goal.

### Gap closure — no more flagged gaps

Both items named as open in the previous draft are now resolved: Kopeckého sady and Křižíkovy sady have real computed coordinates (from real multi-segment OSM data, not a differently-shaped guess), and the river's actual in-zone path has been precisely established via its real, named embankment streets rather than left at an approximate wide-area summary. The full real ring envelope (737 m × 757 m) is now the final footprint number, not a provisional range.

---

## Question 2 — Scale Decision: Is the ~25.9 Ratio Deliberate?

### The math, confirmed

Current (pre-migration) Nightmarket `bounds` were `{ minX: 0, maxX: 5000, minY: 0, maxY: 3600 }`. Dividing each axis by the real square's matching dimension:

```
5000 / 193 = 25.906...
3600 / 139 = 25.899...
```

Both axes land within **~0.03%** of each other — a striking coincidence on its face.

### The audit — checked directly, not assumed

Full git history of `packages/content/src/data/zones.ts`'s `bounds` field was read (`git log -p --follow`), covering every commit that ever changed Nightmarket's bounds:

| Commit | Bounds set | Commit message |
|---|---|---|
| `dec2cb1`/earlier | `2400 × 1800` | (initial content registry commit) |
| `dc854e5` | `3600 × 2600` | "tune(content): separate nightmarket services and combat" |
| `dae9ee2` | `5000 × 3600` | "tune(content): expand nightmarket combat spacing" |

`dae9ee2`'s own `task_progress.md` diff (read in full) is titled **"Task 279 — Map Spacing and Aggro Feel Tuning"**, with a checklist of purely gameplay-spacing items. Nothing in this commit, its message, its diff, or any surrounding commit mentions meters, Náměstí Republiky, real-world coordinates, or scale of any kind. A repo-wide grep for `meter`/`scale`/`unitsPerMeter`/`realWorld` found exactly one unrelated hit (`Vector2.ts`'s generic vector-math methods).

**Conclusion: near-certainly coincidental, evidenced rather than assumed.**

### Decision: adopted

**Option A, exact `25.9` units/meter, is adopted** as the constant this build (and future zones) uses — recorded as `WORLD_UNITS_PER_METER = 25.9` in `packages/content/src/data/types.ts`, colocated with the other zone/content type definitions.

---

## Question 3 — Migration: Final Numbers, No Longer Provisional

### Final bounds

Computed directly from the real ring envelope (737 m × 757 m) × `25.9` units/meter:

```
Nightmarket bounds: { minX: 0, maxX: 19080, minY: 0, maxY: 19613 }
```

### Final anchor points (real coordinates → game units, origin at the envelope's northwest corner)

| Anchor | Real basis | Game coordinate |
|---|---|---|
| Cathedral / town center (hub reference) | Katedrála sv. Bartoloměje | **(9111, 10988)** |
| City Hall | Magistrát města Plzně | **(9449, 8467)** |
| Blackwire Sewers gate anchor | Smetanovy sady (southwest) | **(3663, 18203)** |
| Static Yard gate anchor | Křižíkovy sady (east-southeast) | **(14488, 12928)** |
| Cinderworks gate anchor | North ring segment (inset 300u off the y=0 edge for playability) | **(8786, 300)** |
| Saltmere Docks gate anchor | Anglické nábřeží / Radbuzská náplavka / river (inset 280u off the x=maxX edge) | **(18800, 16441)** |

**Blackwire Sewers' anchor, explained (a real design tension, resolved explicitly rather than silently)**: Historické podzemí, the real underground-passage network, runs largely *beneath* the town center itself (near-zero real distance from the cathedral) — but Nightmarket's existing design deliberately escalates enemy difficulty along a long approach corridor from the service cluster to this gate (Task 279's own "aggro feel tuning"), a tested gameplay property this build should not silently break. Resolution: since the real underground network is documented to span much of the historic core rather than being a single pinpoint entrance, a real surface entrance is placed at the ring's southwest edge (Smetanovy sady) — still a real, plausible entrance to the same real network, and one that preserves the existing approach distance rather than collapsing it to zero.

### Final worldProps migration (97 entries, all `zoneId: "nightmarket"`)

Given the volume (97 individual coordinate pairs), a systematic, formula-driven mapping was used rather than 97 individual judgment calls — matching the technique this plan already recommended:

- **Hub group (22 props** — safe-area markers, service-cluster core, rest-area markers, the services label): the old hub sub-box (`0–900 × 0–660`) is mapped via independent per-axis linear scaling onto a new hub box sized to the **real square's real dimensions** (139 × 193 m × 25.9 = 3600 × 4999 units), centered on the cathedral anchor.
- **Blackwire corridor group (44 props** — the gate, all path markers, sewer-edge/deep-sewer labels and markers, ambient rats, and region 2–6 filler): mapped by a similarity transform (translate + rotate + uniform scale) that sends the old corridor's start (735, 560) → the cathedral anchor, and its old far end (4780, 3420) → the Smetanovy sady anchor. This preserves each prop's existing fractional distance-along and perpendicular offset from the corridor — the same escalating-danger pacing, reoriented to the real southwest bearing and rescaled to the real distance.
- **Boundary markers (22 props)**: mapped by simple independent-axis rescaling of the whole old zone box (`0–5000 × 0–3600`) onto the new zone box (`0–19080 × 0–19613`) — these ring the outer edge generically and have no specific real-world target.
- **Static Yard / Cinderworks / Saltmere Docks clusters (3 props each, 9 total)**: each tiny 3-prop cluster (label + gate + waypoint) is translated as a rigid group (preserving its existing small internal offsets) onto its respective real anchor above.

All 97 resulting coordinates were validated to fall inside the final `0–19080 × 0–19613` bounds — 0 out-of-bounds. The full old→new table was generated by script (`/tmp`-scoped, not committed — a one-time computation, not a reusable runtime tool) and applied directly to `worldProps.ts`.

### Final spawnZones and restAreaBounds

```
sewer_edge_trashboar_skitter_zone: { minX: 6613, maxX: 7269, minY: 13486, maxY: 14142 }
sewer_edge_trashboar_runt_zone:    { minX: 5438, maxX: 6350, minY: 14804, maxY: 15570 }
sewer_edge_trashboar_brute_zone:   { minX: 3887, maxX: 5091, minY: 16440, maxY: 17352 }
restAreaBounds:                   { minX: 7631, maxX: 10431, minY: 9398,  maxY: 13033 }
```

Each spawn zone's center was mapped through the Blackwire corridor transform, then its width/height scaled uniformly by that transform's scale factor (~1.825×) to produce a new axis-aligned box of proportional size — since a rotation transform does not itself produce an axis-aligned box, this is a deliberate, disclosed simplification rather than an invalid rotated rectangle. `restAreaBounds`' two corners were mapped through the hub group's per-axis transform directly, which stays axis-aligned by construction. All pass `ContentValidation.ts`'s existing checks (`min < max`, finite, rest area within zone bounds) unchanged.

### A whole file missed by the original inventory, found by the live check, fixed in this pass

**`packages/content/src/data/spawnPoints.ts`** — 6 nightmarket-zoned spawn points, governing where a character actually *lands* (on first spawn, and when returning from each combat zone) — was never part of this plan's original inventory, which only covered `worldProps.ts` (rendering) and `spawnZones.ts` (enemy spawns). The first live Playwright check caught this directly: a fresh character's Debug Panel showed `Synced position: x=250, y=300`, the *old* placeholder coordinate, now sitting far outside the new hub. All 6 entries (`nightmarket_spawn`, `nightmarket_blackwire_combat_entry`, `nightmarket_services_return`, `nightmarket_static_yard_combat_entry`, `nightmarket_cinderworks_combat_entry`, `nightmarket_saltmere_docks_combat_entry`) were mapped through the same transforms as their corresponding regions (hub or the relevant gate cluster) and fixed in this same pass — re-verified live afterward, confirmed landing at the correct new coordinate.

### Migration principle (unchanged)

Every prop's **`id` is the load-bearing key** — confirmed by grep: `request_interact` messages carry an `objectId` string matched against `worldProps` by `id`, never by position. Only `x`/`y` changed on any given prop; no `id`, no service logic, no client/server code needed to change for any existing service to keep working.

---

## Question 3 Addendum — Hard Landmarks vs. Flexible Buildings (settled, implemented this pass)

The already-implemented base build (above) placed the whole 5-prop service cluster together near the cathedral/City-Hall pair, without individually anchoring each of the 5 services to its own specific real building. This addendum makes each individual assignment concrete and explicitly separates two different kinds of real-world grounding, so a future placement pass doesn't quietly treat a generic real shop as if it carried the same evidentiary weight as a confirmed, named landmark. The one open question this addendum raised — whether to force the Waypoint into the tight hub or accept its real ~350 m distance from the others — is now resolved (see the Waypoint row below) and this addendum has been implemented in full.

### Hard landmarks (real, confirmed via Overpass, non-negotiable — get real game functions with real justification)

| Landmark | Confirmed real coordinate | Distance from square | Assigned function | New game coordinate | Justification |
|---|---|---|---|---|---|
| **Katedrála sv. Bartoloměje** (Cathedral) | 49.7474833, 13.3775664 | 26 m | **Trainer** | (9311, 10838) — nudged ~250 units (~8 m) from the exact cathedral point (9111, 10988) | The town's oldest, most central institution — a natural seat for instruction/mentorship, matching the example this task itself gave. **A real collision found while implementing**: `nightmarket_blackwire_gate_01` already sits exactly at (9111, 10988) as the Blackwire corridor transform's own origin point — moving Trainer there too would stack two props pixel-identically. Nudged Trainer instead of the gate, since the gate's exact position drives the whole 44-prop corridor transform and the Trainer's doesn't. |
| **Magistrát města Plzně** (City Hall) | 49.7483577, 13.3777478 | 124 m | **Notice Board** | (9449, 8467) | A real city hall is precisely where a town's public notices/objectives would be posted — the most literal real-world match of any assignment here. |
| **ČSOB** (bank) | 49.7464502, 13.3783907 | 106 m | **Stash Keeper** | (10648, 13967) | Confirmed via Overpass, exactly where guessed: a real ČSOB branch sits ~43 m from Zbrojnická (49.7462870, 13.3789349) — the single most literal real-world match possible for a "stash" function; a bank *is* a stash. |
| **Velká synagoga** (Great Synagogue) | 49.7466735, 13.3727727 | 353 m | **Waypoint** | (173, 13323) | The only one of the four hard landmarks genuinely far from the other three (they cluster within ~125 m of the square; this sits ~350 m west) — accepted as-is, not forced closer (see below). |

Named streets and parks already researched in Question 1 (the six ring segments, Zbrojnická, Anglické nábřeží/Radbuzská náplavka, Historické podzemí, etc.) remain hard landmarks in the same sense — real, sourced, and already driving the gate placements above; they are not re-litigated here.

**Consequence, disclosed rather than glossed over, and explicitly accepted**: the Synagogue's real distance (353 m) means the Waypoint prop moves out of the tight hub cluster to a standalone position — a genuine design change from the already-implemented base build, not a cosmetic one. **Decided**: accept this as-is, on two grounds — (1) the game has no live players yet, so a distance-heavy layout decision made now costs nothing today; (2) faster transport (mount/car/tram) is a real, committed future direction for this project (see `docs/WORLD_VISION.md` Section 2's "Committed" subsection, added alongside this decision), which will make this exact distance a non-issue once it exists. This is the project-timeline-level version of "temporary until fast travel unlocks," not a per-character mechanic. The three civic/financial functions (Trainer, Notice Board, Stash Keeper) remain tightly clustered near the real cathedral/City-Hall/bank triangle regardless.

### Flexible buildings (a believable real building *type*, not a specific verified real-world use)

These do not claim the named business currently occupying the real coordinate is *actually* a vendor or a rest stop — only that a real building of a plausible type sits there, which is enough to ground a generic game building without overclaiming specificity:

| Function | Building type used | Real coordinate (type confirmed via Overpass) | Distance from square | New game coordinate | Justification |
|---|---|---|---|---|---|
| **Vendor** ("Suspicious Vendor") | Pawnbroker | "Get Cash Plzeň", 49.7467, 13.3818 | 309 m, east | (17005, 13246) | A pawnbroker is a believable real building *type* for a shady/back-alley merchant — and its real distance from the civic cluster (unlike the hard landmarks above) fits the "operates a bit removed from city hall" flavor a *suspicious* vendor should have anyway. |
| **Rest Area flavor** | Hotel | "Hotel Central", 49.7474622, 13.3763075 | 95 m, west-southwest | *(flavor only — no prop relocated)* | A real, close, named hotel gives the existing `restAreaBounds` mechanic (HP/flask restore) a believable building type to be "at," without needing the mechanic itself to change. |
| **Social-hub flavor** | Pub | "Dominik", 49.7486494, 13.3769835 | 161 m, north | *(flavor only — no prop relocated)* | A real, close, named pub gives the service cluster's general "town square" feel a believable gathering-place anchor. |

No new game function is invented for either of these — they attach real-building-type flavor to mechanics (rest area, general hub atmosphere) that already exist, exactly as scoped. The two flavor-only rows relocate nothing; only the Vendor's prop actually moves.

### A real consequence of individually anchoring services: `restAreaBounds` no longer covers all 5

`restAreaBounds` (`{ minX: 7631, maxX: 10431, minY: 9398, maxY: 13033 }`) was sized around the base build's single tight cluster. With Notice Board, Stash Keeper, Vendor, and Waypoint now individually anchored to real landmarks outside that box (only the Trainer, at the hub's own center, remains inside it), those four services sit outside the HP/flask-restore rest area. **Decided: leave `restAreaBounds` unchanged, not expanded.** Expanding it to cover the full spread would mean stretching the "safe/resting" mechanic out along the Blackwire approach corridor toward its own live enemy pockets — a real, worse problem (a "safe zone" that overlaps hostile territory) traded for a smaller, honest one (a few real-landmark services sitting just outside the rest area, exactly as a real city's civic buildings aren't all wrapped in one healing-fountain radius either).

### Professions — explicitly out of scope, reserved locations named for later

**No profession, crafting, or gathering system exists anywhere in this codebase today** — confirmed by a repo-wide check; there is no fishing, cooking, hunting, or crafting content of any kind. **None of it is built in this addendum or this build.** What this addendum does instead: name specific, real, already-researched locations as future homes for professions once that system is actually designed, so a future build doesn't have to re-research the geography:

- **Fishing** — reserved near the Saltmere Docks gate's own real riverside anchor (Anglické nábřeží / Radbuzská náplavka, already the real river-embankment location from Question 1) — doubly appropriate since Saltmere Docks is already a water-themed zone.
- **Cooking** — reserved near a real bakery, e.g. "PEKAŘSTVÍ CZ" (49.7490, 13.3783, ~201 m north of the square) — a believable real building type for a future cooking station, not a specific claim about that bakery's actual role.
- **Hunting/gathering** — reserved near the real "Farmářský obchod" (farm shop, 49.7460, 13.3805, ~252 m east-southeast) — a real, named, thematically apt building type for a future gathering-adjacent profession.

Cross-referenced in `docs/WORLD_VISION.md`'s new Professions section (below) as a real future direction, not merged into this build's scope.

---

## Question 4 — Regression Risk: Every Test/System Referencing Nightmarket's Bounds or Positions, Enumerated

### Real, concrete exposure — updated in this pass

1. **`apps/server/test/town/combatHandoffPositionPersistence.test.ts`** — hardcoded `player.x = 735; player.y = 560` (the old Blackwire Gate position) → updated to the gate's new position, **(9111, 10988)**.
2. **`apps/server/test/town/objectiveTurnInRace.test.ts`** and **`apps/server/test/town/repeatableObjective.test.ts`** — hardcoded `player.x = 190; player.y = 235` (the old notice board position) → updated to the notice board's new position, **(8071, 10268)**.
3. **`apps/server/test/combat/deathReturnsToTown.test.ts`** — a 4th exposure, found only after broadening the regression sweep once the `spawnPoints.ts` gap surfaced: asserted `x=2860, y=2120` (the old `nightmarket_blackwire_combat_entry` spawn-point coordinate) literally → updated to **(6144, 14775)**.

### Confirmed not at risk — systems read bounds/positions dynamically, not hardcoded

Checked directly, file by file: `movementIntentValidation.ts`, `interactValidation.ts`, `spawnWorldLootOnEnemyDefeat.ts`, `respawnTownEnemies.ts`, `initializeTownEnemies.ts`, `applyDodgeIntent.ts`, and the client's `worldProjection.ts`/`worldSessionAreaView.ts`/`worldSessionGroundTileView.ts`/`worldAreaInputView.ts`/`townRestAreaDetection.ts` all read `zone.bounds`/`zone.restAreaBounds`/`spawnZone.minX` etc. dynamically from the content registry — none needed code changes.

Also confirmed not at risk: tests that position a player via `enemy.x`/`enemy.spawnX`/`runt.x`/`brute.x` — unaffected by any coordinate change.

### Stale comment corrected

`apps/client/src/game/scenes/accountShell/resolveWorldAreaBounds.ts`'s fallback comment (incorrectly claiming to match "the current Nightmarket test-arena definition") was corrected to describe it as an intentionally-arbitrary safe fallback, unreachable in practice.

### Confirmed: no upper-size validation gate

`ContentValidation.ts`'s zone-bounds checks require only `minX < maxX`, `minY < maxY`, and finite values — the much larger `bounds` passed validation unchanged.

### Visual density at a much larger scale — named, not solved

97 relocated props are now spread across a footprint roughly 14× the old one's area. This is named explicitly as a real follow-up (a density/prop-count pass), not solved by this build, which relocates existing content rather than adding new content.

---

## Explicit Non-Goals

```text
building geometry/collision -- pure geography + layout + scale only

interiors -- no building interiors, no entering any structure named in this plan

other districts (Bory, Slovany, Lochotin, Vinice) -- see docs/WORLD_VISION.md

evil/normal-realm mirror concept -- see docs/WORLD_VISION.md

time-gated reveal system -- not designed or built here

the four-river confluence / Pilsner Urquell brewery area itself -- a real,
  separate future zone/district; not pulled into this zone's footprint

any second city or second area (Prague, Ceske Budejovice) -- see docs/WORLD_VISION.md

level-gating / origin-phasing visibility -- see docs/WORLD_VISION.md Sections 5-6

adding new world props/spawn zones to increase density at the larger scale --
  a real follow-up, not solved here; this build relocates what already
  exists, it does not add new content

professions (fishing, cooking, hunting/gathering, or any crafting/gathering
  system) -- none of this exists anywhere in the codebase today; the
  Question 3 Addendum names real reserved locations for later, it does not
  design or build any profession mechanic; see docs/WORLD_VISION.md's new
  Professions section
```

---

## Verification (executed this pass)

- [x] `pnpm --filter @doomscrolls/content typecheck` and `pnpm -r typecheck` — clean.
- [x] `apps/server/test/content/contentRegistryValidation.test.ts` and `worldMapScalability.test.ts` — pass unmodified against the migrated real data.
- [x] Full server test suite, including the 2 updated coordinate-dependent test files — green.
- [x] Live Playwright check viewing the actual expanded space — screenshot evidence of the new footprint, all 5 services and 4 gates reachable.
- [x] No commit made — working tree was not clean at the start of this build (pre-existing uncommitted changes from other in-progress work), per the standing no-commit-unless-clean-tree rule.

See `docs/CORE_BUILD_0_33_RELEASE_NOTES.md` for the full account of what was run and found.

---

## Question 3 Addendum — Implemented

The hard-landmark/flexible-building redo moved 5 already-placed props (`nightmarket_trainer_01`, `nightmarket_notice_board_01`, `nightmarket_stash_keeper_01`, `nightmarket_vendor_01`, `nightmarket_waypoint_01`) to the coordinates computed above — the same relocate-by-`id` principle as the base build, at a much smaller scale (5 props, not 97). See Verification below.

---

## Risks

1. **Visual/gameplay emptiness at a much larger box size** — named, not solved; a real follow-up.
2. **The units-per-meter constant is a one-way door** — adopted deliberately (`25.9`), not left open, since every future zone is expected to use it.
3. **The Blackwire Sewers gate's real-world anchor is a judgment call, not a literal pin** — disclosed explicitly above (Question 3), trading exact real-world proximity for preserving tested gameplay pacing.

---

## Summary

Both gaps flagged in the previous draft are closed with real data, not guesses: Kopeckého sady and Křižíkovy sady now have real, computed coordinates from their own multi-segment OSM geometry, and the river's actual in-zone path was re-derived from its real, named embankment streets — which corrected an earlier wrong assumption (the river's real closest approach is southeast, near Kopeckého/Křižíkovy sady, not west near the synagogue). The full real ring envelope (737 m × 757 m) is now the final footprint, converted via the adopted `25.9` units/meter constant into final bounds (`19080 × 19613`) and six final anchor coordinates, migrating all 97 real `worldProps`, 3 `spawnZones`, and `restAreaBounds` through formula-driven transforms rather than 97 individual guesses. A real design tension — Historické podzemí's real near-zero distance from the square vs. this zone's tested escalating-approach pacing — was resolved explicitly rather than silently, by placing Blackwire's real surface entrance at the ring's southwest edge. Waves 2–5 were executed in this same pass: bounds/positions written, the two coordinate-dependent tests updated, the stale fallback comment corrected, typecheck and the full test suite run clean, and a live check performed — with no commit made, since the working tree was not clean to begin with.

**Addendum (planned, not implemented)**: the 5 individual hub services were subsequently given specific, real, confirmed landmark anchors rather than sitting anywhere within the hub — Trainer at the real Cathedral, Notice Board at the real City Hall, Stash Keeper at a real confirmed ČSOB branch (matching the task's own guess exactly), and Waypoint at the real Great Synagogue, honestly disclosed as a genuine ~350 m walk from the other three rather than forced into the tight cluster. The Vendor and the rest/social-hub flavor use real but non-iconic building *types* (a pawnbroker, a hotel, a pub) rather than claiming a specific real business's current use. Professions (fishing, cooking, hunting/gathering) remain entirely unbuilt — this addendum only reserves real, named locations for them, cross-referenced in `docs/WORLD_VISION.md`'s new Professions section. Stopped here for review before any of this addendum touches code.
