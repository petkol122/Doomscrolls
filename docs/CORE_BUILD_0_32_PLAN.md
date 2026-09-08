# docs/CORE_BUILD_0_32_PLAN.md — Core Build 0.32 Plan

## Status

**Implemented and verified.** Plan approved; all waves completed in this session. A real bug was found by the live Playwright check (a missing `leaflet.css` import breaking the map's visual layout entirely) — fixed and re-verified live, not left as a "found, not fixed" note, since it was a defect in this build's own new code, not an unrelated pre-existing issue. See `docs/CORE_BUILD_0_32_RELEASE_NOTES.md` for full detail.

---

## Core 0.32 Theme

**World Map Foundation** — a real-world-coordinate map screen (Pilsen/Plzeň, via Leaflet.js + OpenStreetMap tiles), reachable as a new optional entry point alongside character selection's existing "Enter World" flow, backed by a new `world → continent → area` content hierarchy that the existing Nightmarket + 4 combat zones migrate under. No new zones, no new gameplay, and — deliberately, for Phase 1 — no change to any player's default path: this build proves the architecture holds and is genuinely reachable and functional, by making the *existing* content the only content it has to carry, without yet making anyone go through it.

---

## Build Framing — Current State (audited before writing this plan)

**There is no intermediate screen today, and there is no world-scale content model at all.** Character select (`AccountShellScene`) has a single "Enter World" button (`worldEntryView.ts`) wired to `AccountShellScene.handleEnterWorld()`, which calls `joinResolvedCharacterRoom(client, sessionToken, characterId, selectedCharacter?.currentZoneId)` (`apps/client/src/net/RealtimeClient.ts:78-90`) and transitions straight into `WorldSessionScene` on success. One click, no map, no intermediate step, today.

`packages/content/src/data/zones.ts` has exactly 5 zones — `nightmarket` (town) plus `blackwire_sewers`, `static_yard`, `cinderworks`, `saltmere_docks` (combat) — confirmed by reading the file in full. `ZoneContentDefinition` (`packages/content/src/data/types.ts:148-173`) has no lat/long, no notion of belonging to any larger grouping, and no world/continent/area concept exists anywhere in this codebase — confirmed by a repo-wide grep. This was foreseen once and explicitly deferred: `docs/CORE_BUILD_0_6_PLAN.md` lists "a world map, or a region-selection UI" as a named non-goal. This build is the first to actually build it.

**A real, adjacent system already exists and must not be confused with this one**: `waypointService.ts`'s route/waypoint travel is a same-session, already-inside-Nightmarket fast-travel mechanism between the 4 combat-zone gates — it has zero concept of worlds/areas and only ever operates after a player has already joined a room. The new map screen is a *pre-join* screen (which room to join at all), not a re-skin of waypoint travel. Both exist afterward; they solve different problems.

---

## Question 1 — Feasibility Spike: Leaflet.js + OpenStreetMap, Actually Run, Not Assumed

**Run for real during this planning pass**, not deferred to implementation, per the task's explicit "confirm... before building on top of it — don't assume":

1. **Network reachability** — `curl` from this environment directly to a real OSM tile server (`https://tile.openstreetmap.org/5/16/10.png`): `HTTP 200`, `content-type: image/png`, real tile data, 0.3s. Reachable.
2. **Real browser rendering** — a standalone throwaway HTML page (Leaflet 1.9.4 via CDN, real `L.tileLayer` pointed at `tile.openstreetmap.org`, centered on Pilsen's real coordinates `49.7384, 13.3736`) loaded in a real headless Chromium via Playwright. Result: **20/20 tiles loaded successfully, 0 tile errors, 0 failed requests, 0 console errors**, `map.whenReady()` fired. Screenshot confirms a fully-rendered, correctly-labeled map of Plzeň with a marker at the exact coordinate and **both required attributions visible** ("Leaflet | © OpenStreetMap contributors", bottom-right corner) — not omitted, not assumed present.
3. **No CSP anywhere in this codebase** (`apps/client/index.html` has no `Content-Security-Policy` meta tag; grepped the whole repo for one) — confirmed nothing would silently block loading external image tiles.
4. **No conflicting dependency**: `apps/client/package.json` confirmed clean of any existing mapping library; `vite.config.ts` has no plugin restriction that would block adding one.

**Verdict: feasible, confirmed by evidence, not assumption.** No fallback plan is needed for Phase 1. This spike used live tiles from the public server to prove the mechanism works at all; whether the shipped build actually serves tiles live or from a local cache is a separate, later decision — see Question 6.

---

## Question 2 — Area Granularity: City + Surroundings (Decided, Per the Task)

Matches the existing content's actual scale exactly: Nightmarket (a town hub) plus its 4 adjoining combat zones is already "a city and its ring of wilderness/dungeon zones," not an administrative district. No zone reshaping is needed to fit this granularity — the existing 5 zones already *are* one Area's worth of content, confirmed by re-reading every zone's own `transitionZoneIds` (a strict hub-and-spoke: every combat zone points only at `nightmarket`, and `nightmarket` points at all four) — this is already one coherent local cluster, not five independent places that happen to share a name.

---

## Question 3 — Data Model: `world → continent → area`, Zones Migrate Under One Area

**Decided shape**, matching the existing content-registry pattern exactly (`ContentCollection`/`createCollection`/`ContentRegistryInput` in `ContentRegistry.ts`, `LocalizedContentDefinition` base interface in `types.ts:68-72`, per-category validation blocks in `ContentValidation.ts`):

```ts
// packages/content/src/data/types.ts additions
export type WorldContentId = "earth";
export type ContinentContentId = "europe";
export type AreaContentId = "pilsen";

export interface WorldContentDefinition extends LocalizedContentDefinition {
  readonly id: WorldContentId;
}

export interface ContinentContentDefinition extends LocalizedContentDefinition {
  readonly id: ContinentContentId;
  readonly worldId: WorldContentId;
}

export interface AreaContentDefinition extends LocalizedContentDefinition {
  readonly id: AreaContentId;
  readonly continentId: ContinentContentId;
  readonly latitude: number;   // real-world, e.g. 49.7384
  readonly longitude: number;  // real-world, e.g. 13.3736
}
```

- **`ZoneContentDefinition` gains one new field**: `readonly areaId: AreaContentId`. This is the actual "migration" — each of the 5 existing zone definitions in `zones.ts` gets `areaId: "pilsen"` added, matching how `OriginContentDefinition.startingZoneId` already models a child-references-single-parent-by-id relationship in this codebase (not the parent listing its children — that would mean touching the Area definition every time a new zone is authored, the wrong direction for the exact scalability property Question 5 needs to hold).
- **New data files**: `packages/content/src/data/worlds.ts` (`export const worlds = [{ id: "earth", nameKey: ..., descriptionKey: ... }] as const satisfies readonly WorldContentDefinition[]`), `continents.ts` (one entry, `worldId: "earth"`), `areas.ts` (one entry, `continentId: "europe"`, `latitude: 49.7384`, `longitude: 13.3736`) — same shape as `zones.ts`'s own array literal, same `as const satisfies readonly X[]` idiom.
- **`ContentRegistry.ts`**: three new `ContentCollection` fields (`worlds`, `continents`, `areas`), wired into `ContentRegistryInput` and the singleton instantiation, exactly like every existing category (`createCollection("world", input.worlds)`, etc. — no new abstraction).
- **`index.ts`**: re-export `worlds`/`continents`/`areas` and their five new types, matching the existing per-category export block.
- **`ContentValidation.ts`**: `validateUniqueIds` for all three new categories (reused, not reimplemented); `validateLocalizedDefinition` for all three (they all carry `nameKey`/`descriptionKey`); three new referential checks, matching the style of the existing zone block (`ContentValidation.ts:145-211`) exactly: every continent's `worldId` resolves, every area's `continentId` resolves, every zone's new `areaId` resolves — plus a cheap, real content-integrity check that `latitude`/`longitude` are finite and within real-world bounds (`-90..90`, `-180..180`), the same "bounds must be well-formed" discipline already applied to `zone.bounds`.

**Deliberately minimal**: `World`/`Continent` carry zero fields beyond identity/localization — they exist to prove the hierarchy holds end-to-end, not because any current feature reads a continent-level property. `Area` carries only what the map screen and Question 5's scalability check actually need (`continentId`, `latitude`, `longitude`) — no `cityType`/`kind`/gating field of any kind, since city-vs-safe-town distinction and level-gating are both explicit non-goals (Question 4). Adding fields nobody reads yet, in anticipation of a later build, is exactly the "design for hypothetical future requirements" this project's own conventions warn against.

**No protocol or server changes of any kind.** The room-join call remains exactly `joinResolvedCharacterRoom(client, sessionToken, characterId, zoneId)` — the server has never needed to know about areas/continents/worlds and still doesn't; the map screen resolves a marker click down to a `zoneId` entirely client-side, using content the client already has loaded. This is a client + content-package-only build.

---

## Question 4 — UI: One Map Screen, One Marker, Existing Flow Unchanged

### Correction made during review: `currentZoneId` cannot distinguish "brand-new" from "returning"

An earlier draft of this plan assumed a fresh character has no `currentZoneId` yet, and considered gating the map screen on that. Checked directly and found wrong: `CharacterService.ts:96` sets `currentZoneId: origin.startingZoneId` **at character-creation time** — every character has a resolved zone from the instant it exists, fresh or not. There is no existing field that means "has this character ever actually joined a room before," and inventing a new one purely to gate a screen that — with exactly one area on the map — doesn't yet represent an actual choice either way would be exactly the kind of complexity added in service of a distinction this build doesn't need. This is corrected below rather than left as the original (unworkable) premise.

### Decided: the map is a new, optional, secondary entry point — nobody's default path changes

Forcing every login through a map with one clickable dot is friction with no payoff for a returning player who isn't choosing anything (there is only one place to go, and they may already be somewhere else entirely, mid-session). Since there's no clean signal to spare only *some* logins from it, the honest Phase 1 answer is to not force *any* login through it yet:

- **`AccountShellScene`'s existing "Enter World" button is completely untouched** — same call (`joinResolvedCharacterRoom(client, sessionToken, characterId, selectedCharacter?.currentZoneId)`), same behavior, same one click, for every character, fresh or returning, exactly as today. This build changes zero default behavior for any player.
- **A new, secondary "View World Map" affordance is added alongside it** (not replacing it) — a real, discoverable, optional entry point, not a gate. Clicking it starts `WorldMapScene` (`apps/client/src/game/scenes/`, with a `worldMap/` subdirectory for its view helpers, mirroring `worldSession/`'s own structure), passing the same `account`/`characterId`/session data already threaded into `WorldSessionScene` today.
- `WorldMapScene` is a minimal Phaser scene with no world rendering of its own — its real content is a full-screen DOM overlay, built the same way `AccountShellScene.createAccountOverlay` already builds one (`AccountShellScene.ts:99-168`, the always-interactive overlay convention, not `WorldSessionScene`'s passive-root/click-passthrough convention — there is no canvas content behind this screen for a click to pass through to). A "Back" control returns to `AccountShellScene` without joining anything.
- Inside that overlay: a full-size Leaflet map (`L.map(...)`, real `tile.openstreetmap.org` tiles, OSM attribution left in place, never suppressed), initial view centered/zoomed to show the surrounding region (not zoomed straight into a single-city close-up — the point of a *world* map is that Pilsen visibly sits inside a much larger, mostly-still-empty map, setting up future areas honestly rather than looking like a single-city menu wearing a map skin), with exactly one `L.marker([49.7384, 13.3736])` at Pilsen, built from the new `areas` content collection (not hardcoded coordinates duplicated in client code — the marker's position is read from `contentRegistry.areas.get("pilsen")`).
- **Clicking the marker performs the exact same real join — not a mockup**: the *same* `joinResolvedCharacterRoom(client, sessionToken, characterId, selectedCharacter?.currentZoneId)` call, moved (not rewritten) from `AccountShellScene.handleEnterWorld` into a small shared helper both entry points call, then `this.scene.start("WorldSessionScene", {...})` exactly as today. Whoever clicks it lands exactly where `joinResolvedCharacterRoom` already resolves them today — Nightmarket for most characters (since `currentZoneId` starts at `origin.startingZoneId`, "nightmarket"), or wherever a character mid-combat-zone last was. The map is a genuine, fully-working alternate path to the same destination logic, not a narrower one.
- No drill-down navigation (world screen → continent screen → area screen) is built. With exactly one entry at every level, there is nothing to navigate *between* yet — building a multi-level navigation UI now would be scope invented ahead of the content that would justify it.
- **Wiring the map into the mandatory entry path (replacing "Enter World" rather than sitting beside it) is an explicit, named follow-up** — for once a second area actually exists and choosing between areas becomes a real decision, not before. Stated here as a deliberate deferral, not an omission.

**New dependency**: `leaflet` (`^1.9.4`, the version the spike used) added to `apps/client/package.json` dependencies, `@types/leaflet` to devDependencies. No other new dependency.

---

## Question 5 — Scalability Check: The Actual Pass/Fail Test

**Concrete, executable proof, not a prose claim.** A dedicated test constructs a second, synthetic `ContentRegistry` instance (not the real game's singleton, not committed as real content) with the real Pilsen area/continent/world plus one additional synthetic area (a second Czech city, e.g. a placeholder `"test_second_city"` area under the same `"europe"` continent, with its own lat/long and one throwaway zone pointing `areaId` at it) and asserts:

1. `validateContentRegistry` still returns `{ ok: true, errors: [] }` with the second area present — proving the validation layer scales to N areas with no code change, only data.
2. The second area's zone resolves through the same `contentRegistry.areas.get(...)`/`continents.get(...)`/`worlds.get(...)` chain the first area does — proving the hierarchy itself, not just validation, is N-capable.
3. No file outside `packages/content/src/data/*.ts` (test fixtures aside) needed to change to make this pass — the literal claim Question 5 asks to prove, checked directly rather than assumed from the shape of the code.

This is the actual pass/fail gate for this build, named as such per the task: if adding a synthetic second area requires touching `ContentRegistry.ts`, `ContentValidation.ts`, or any client rendering code, Phase 1's architecture has failed its own stated goal and needs to be revisited before shipping, not patched around.

---

## Question 6 — Tile Caching: Real Tiles, Fetched and Measured, Not Estimated

**Added after initial review**: cache the actual tiles the map screen needs under `apps/client/public/assets/`, same pattern as every other asset since Core 0.22, and serve those as the primary path instead of hitting `tile.openstreetmap.org` live on every load.

### Exact zoom range and bounding boxes (decided, not left implicit)

The map screen needs two distinct views, at two different scales, per Question 4's design (a wide "regional context" initial view, plus interactive zoom toward Pilsen itself):

- **Regional context band, zoom 5-8**: bounding box `lat 48.0–51.5, lon 11.5–19.0` (Czech Republic plus margins) — the area visible in the initial wide view establishing "Pilsen sits inside a much larger, mostly-empty map." At these low zooms each tile covers a large area, so covering the *whole* region costs very few tiles.
- **City band, zoom 9-13**: a tight bounding box around Pilsen only, `lat 49.6184–49.8584, lon 13.1736–13.5736` (~28km × ~27km — the city and its immediate surroundings, not the whole country) — matches zoom 13, the level the Question 1 feasibility spike already used and screenshotted. At these higher zooms, tile count per unit area grows fast, so the box is deliberately kept small and centered on the one real area this build has.

No zoom level beyond 13 is cached or needed — this screen's job is "recognize the city and click it," not a walkable street-level map.

### Real tile count and size — computed and fetched, not estimated

Standard Slippy Map tile math (Web Mercator lon/lat/zoom → tile x/y) applied to the boxes and zooms above gives an exact, deterministic tile list — then every single tile in that list was actually fetched from `tile.openstreetmap.org` (a one-time, rate-limited, properly User-Agent-identified batch, 179 requests at 4-way concurrency with a small delay between requests — a reasonable one-time sizing check, not sustained load) to get real, not modeled, byte sizes:

| Band | Zooms | Tile counts by zoom | Subtotal |
|---|---|---|---|
| Regional context | 5, 6, 7, 8 | 2, 4, 9, 24 | 39 tiles |
| City | 9, 10, 11, 12, 13 | 4, 4, 12, 30, 90 | 140 tiles |
| **Total** | | | **179 tiles** |

Fetched **179/179 successfully, 0 errors**. Real measured sizes: **5,175,775 bytes total (4.94 MB)**, average **28,915 bytes/tile** (min 13,953, max 56,703). This is the real number for this exact scope — not a per-tile average multiplied by a guessed count.

**Confirms the task's own scoping instinct directly**: under 5MB, 179 files, for one small area at a handful of zoom levels — proportional to "tiles for one small area," nowhere near a country-wide dataset or a tile-rendering pipeline.

### Storage and serving

- **Location**: `apps/client/public/assets/map_tiles/pilsen/{z}/{x}/{y}.png` — the standard Slippy Map directory layout, which is also exactly the URL template shape Leaflet's `L.tileLayer` already expects, so switching from the live OSM URL to the local static path is a one-line template change, not new client logic.
- **How the tiles get there**: see "The caching script becomes a real, reusable tool" below.
- **Primary path is local, live fetch is a real (not decorative) fallback**: `L.tileLayer`'s URL template points at the local path by default. A tile request outside the cached set 404s locally; a small tile-layer wrapper catches that per-tile `error` event and swaps that specific tile's request to the equivalent `tile.openstreetmap.org/{z}/{x}/{y}.png` URL, so panning slightly beyond the cached area still shows real map data instead of a blank gap — exactly the fallback use the task named as fine to keep, scoped to *only* the tiles the local cache doesn't have, never as the default path for tiles it does. See "Bounded panning and zoom" below for how far "slightly beyond" is actually allowed to go.

### Bounded panning and zoom — the fallback stays a narrow edge case, not an open door

Raised during review: Leaflet's default behavior is fully open-ended pan/zoom — nothing stops a player from dragging to the other side of the world out of curiosity, which would generate live-fallback requests for an area with zero game content and no cached tiles at all. Not a real risk at today's traffic, but a real, cheap thing to bound rather than leave open-ended:

- **`maxBounds`**: the map is constructed with `maxBounds` set to the regional-context box plus a small pad (~1-2°) — roughly `lat 47.0–52.5, lon 10.5–20.0` — with `maxBoundsViscosity: 1.0` (a hard stop at the edge, not a soft rubber-band nudge). Dragging is physically resisted past that boundary.
- **`minZoom`/`maxZoom`**: set to `5`/`13`, matching the cached range exactly — a player cannot zoom out past the regional-context view or in past the deepest cached city level.
- **Net effect**: the live-fallback path is only ever reachable for the deliberately-allowed margin just outside the tight Pilsen city box but still inside the padded regional bounds (e.g., zoomed in at the edge of the country-wide view) — a real, small, bounded edge case, exercised and confirmed in the live check (Verification Strategy), never an open-ended "anywhere on Earth" path.

### The caching script becomes a real, reusable tool, not a throwaway

**Worth naming plainly**: neither of this project's two prior "worth keeping" investigative tools — 0.23's icon contact-sheet cataloging and 0.24's DB-fixture zone-placement technique — was ever actually committed as a script. Both were documented as *prose recipes* in release notes ("the more reliable pattern... recommended... going forward," `docs/CORE_BUILD_0_24_RELEASE_NOTES.md`), re-derived by hand each time they were needed again. This build's tile-caching tool is a deliberately different case, not a default extension of that pattern: picking a bounding box, computing the tile list, and fetching/caching it is a fully mechanical, parameterizable operation with no judgment calls to re-derive — exactly what area #2 will need, unchanged in shape, just different numbers. That reuse case is concrete enough to justify going one step further than the established precedent here.

- **Committed as a real file**: `apps/client/scripts/downloadMapTiles.cjs` — plain Node.js (not part of the client's browser-targeted TypeScript build; a dev-only CLI tool, not shipped/bundled code, so it stays out of `apps/client`'s own `tsconfig` include path and the browser typecheck it's held to).
- **Parameterized, not hardcoded to Pilsen**: takes a bounding box, a zoom-level list, and an output directory as CLI arguments (`--minLat --maxLat --minLon --maxLon --zooms=5,6,7,8,9,10,11,12,13 --out=apps/client/public/assets/map_tiles/pilsen`) — area #2 is a different set of arguments to the same script, not a rewrite.
- **Reports real numbers on every run**: prints the exact tile count and real total/average byte size it just fetched (the same reporting this plan's own Question 6 numbers came from), so a future area's real footprint is known immediately, not estimated, the same discipline this build was asked to hold itself to.
- **Documented at the top of the file** (usage, the exact invocation used to produce Pilsen's 179 tiles, and OSM's usage-policy expectations for a one-time batch fetch like this: identify with a real User-Agent, keep concurrency and request rate modest) — so it's genuinely picked up cold next time, not rediscovered from scratch.

### No live-refresh mechanism this build (decided, not omitted)

The 179 cached PNGs are static files, fetched once and committed like any other asset. Geography around Pilsen does not change meaningfully day-to-day, so there is no refresh job, no cache-invalidation logic, and no scheduled re-fetch in this build. **Named explicitly as a low-priority future nicety** (e.g. an annual re-fetch of the same 179-tile list, whenever OSM's underlying map data has actually changed enough to matter), not a requirement this build needs to solve.

### OpenStreetMap attribution — confirmed still required and still satisfied with local tiles

OSM's attribution requirement is about crediting the *data source*, not about which server happened to serve the image bytes — self-hosting or caching OSM-derived tiles is explicitly permitted under OSM's own terms, provided attribution is retained. Leaflet's attribution control (`L.control.attribution`, already wired in Question 4's design, `'&copy; OpenStreetMap contributors'`) is a UI overlay independent of the tile layer's URL source; switching the tile layer's URL template from the live server to the local cache path does not touch the attribution control at all. Confirmed, not assumed: the same visible attribution the Question 1 spike screenshotted is unaffected by this change.

---

## Explicit Non-Goals (named as a real follow-up sequence, not silently dropped)

```text
any second continent, area, city, or zone -- content-only work once this build's
  architecture is proven; the natural next real area is a second Czech city, the
  natural next real continent is whichever country follows

level-gating on areas/zones -- no field for it exists on Area or Zone in this
  build; a real design question (per-character level vs. per-account unlock vs.
  something else) for whenever a second area makes "which areas can I reach"
  a real question for the first time

city-vs-safe-town distinction -- Area carries no classification field; if this
  becomes real later it likely lives on Area (city/village/wilds) rather than
  reusing Zone's existing town/combat roomType split, but that is a design
  question for whenever it's actually needed, not pre-answered here

multi-level map navigation (world screen -> continent screen -> area screen) --
  named in Question 4; there is nothing to navigate between with one entry at
  every level

wiring the map into the mandatory entry path (replacing "Enter World" rather
  than sitting beside it as an optional second entry point) -- named in
  Question 4; deferred until choosing between areas is a real decision, i.e.
  once a second area exists, not before

any change to the waypoint/route travel system -- untouched, unrelated,
  already solves a different problem (same-session fast travel after joining)

server or protocol changes of any kind -- the room-join call and its data are
  completely unaware of areas/continents/worlds in this build (Question 3)

real cartographic/city-art assets, custom map styling, or a non-OSM tile
  provider -- stock OSM tiles, Leaflet's default marker icon, no new art

periodic tile-cache refresh -- a one-time cache is sufficient (Question 6);
  a low-priority future nicety (e.g. an annual re-fetch) once the cached
  tiles are noticeably stale, not a requirement this build solves
```

---

## Proposed Implementation Approach (for review, not yet executed)

1. `packages/content/src/data/types.ts` — add `WorldContentId`/`ContinentContentId`/`AreaContentId`, `WorldContentDefinition`/`ContinentContentDefinition`/`AreaContentDefinition`, and add `areaId: AreaContentId` to `ZoneContentDefinition`.
2. New `packages/content/src/data/worlds.ts`, `continents.ts`, `areas.ts` (one entry each, real Pilsen coordinates on the area).
3. `packages/content/src/data/zones.ts` — add `areaId: "pilsen"` to all 5 existing zone definitions. No other field changes.
4. `packages/content/src/ContentRegistry.ts` / `index.ts` — wire the three new collections through, matching every existing category exactly.
5. `packages/content/src/ContentValidation.ts` — unique-id + localized-definition checks (reused) plus the three new referential checks + lat/long bounds check (new, small, matching the existing zone-bounds check's style).
6. `apps/client/package.json` — add `leaflet`/`@types/leaflet`.
7. New reusable dev script `apps/client/scripts/downloadMapTiles.cjs` (Question 6 — parameterized by bounding box/zoom list/output dir, not Pilsen-specific), run once during this wave with Pilsen's real arguments to populate `apps/client/public/assets/map_tiles/pilsen/{z}/{x}/{y}.png` (179 files). Not part of the build/runtime pipeline.
8. New `apps/client/src/game/scenes/WorldMapScene.ts` + a `worldMap/` helper module — Leaflet setup pointed at the local tile path as primary, `minZoom`/`maxZoom`/`maxBounds` constraining pan/zoom to the cached range (Question 6), a small tile-layer wrapper falling back to live `tile.openstreetmap.org` per-tile on a local 404, marker-click → existing join flow. The join-flow body extracted from `AccountShellScene.handleEnterWorld` into a small shared helper both entry points call, not duplicated.
9. `AccountShellScene.ts` — the existing "Enter World" button and its behavior are untouched; a new, secondary "View World Map" button is added alongside it, starting `WorldMapScene`.

---

## Verification Strategy

- **Question 5's scalability test** (new, `apps/server/test/content/` or `apps/content`-adjacent, matching wherever `contentRegistryValidation.test.ts` already lives) — the concrete pass/fail check described above.
- **Existing `contentRegistryValidation.test.ts`** continues to pass unmodified against the real registry, now covering 3 new categories automatically (per this project's existing "one test exercises the whole registry" convention) — proving the real Pilsen migration itself is valid, not just the synthetic scalability fixture.
- **`pnpm -r typecheck`** clean across all 6 workspace packages.
- **Live Playwright check (standing rule — view the map, not just check for console errors)**:
  1. Real account/character through the real UI, at character select. Confirm the existing "Enter World" button is present, unchanged, and still works exactly as today (regression check on the untouched default path — this build's central claim is that this path didn't change, so it gets verified, not just assumed).
  2. Click the new "View World Map" button. **Screenshot showing real rendered map tiles, the Pilsen marker at the correct position, and the OpenStreetMap attribution visibly present** — not inferred from a lack of console errors.
  3. **Confirm the tiles actually rendered are being served from the local cache, not the live server**, via the browser's network panel/request log (Playwright's own request-interception, matching the technique used for the Question 1 spike) — asserting on the request URL host, not just that *some* image loaded. Pan to the edge of the cached city bounding box and confirm a tile just outside it triggers the live-fallback request to `tile.openstreetmap.org`, proving the fallback path is real and not merely designed-on-paper.
  4. **Confirm panning and zoom are actually bounded, not open-ended**: attempt to drag the map far past the padded regional box and confirm it stops (does not scroll to an arbitrary, uncached part of the world); attempt to zoom out past `minZoom`/in past `maxZoom` and confirm both are refused. This is the real check on Question 6's `maxBounds`/`minZoom`/`maxZoom` decision, not just code review.
  5. Click the marker with a fresh character: confirm it lands in Nightmarket, exactly as "Enter World" does today (Debug Panel zone/room-kind check, same technique every prior live check in this project has used).
  6. Separately, click the "View World Map" button with a *returning* character seeded with a persisted combat-zone position, then click the marker: confirm it resumes in that combat zone, not Nightmarket — the concrete proof that the map's join call is the exact real one, not a narrowed "always Nightmarket" path.
  7. Confirm the "Back" control on the map screen returns to character select without joining anything.
  8. Repeat the screenshot check at the established narrow viewport (480x800, matching 0.25/0.26's precedent) to confirm the map renders without clipping.
  9. Zero console errors throughout.

**Gates**: `pnpm -r typecheck`, `pnpm --filter @doomscrolls/server test`, `pnpm --filter @doomscrolls/content test` (if that's where the new scalability test lands) must all pass. No commit unless the working tree is already clean.

---

## Risks

1. **OSM tile server rate-limiting / acceptable-use policy for a real product.** Substantially reduced by Question 6's caching decision: the 179-tile set is fetched once during implementation (already done once for this plan's own sizing check, cleanly within a reasonable one-time-batch use), and normal play never touches the live server at all except the narrow pan-past-the-cached-edge fallback case. The live server's usage policy still matters for that fallback path and for any future re-fetch of the cache, but it is no longer this build's primary traffic pattern — worth still naming a production-scale tile provider as a pre-launch follow-up if the fallback path ever sees meaningful real traffic, not a Phase 1 blocker.
2. **Leaflet's DOM footprint alongside Phaser's canvas.** Confirmed the account-shell overlay convention (always-interactive, no canvas-passthrough) is the right fit structurally; the live check's job is to confirm this holds in practice (no pointer-event leakage, no z-index fights) the same way 0.25 found and fixed a real click-leak bug in an analogous DOM-over-canvas situation — named here as exactly the kind of thing a live check catches that reasoning about the code alone might miss.
3. **Scope discipline under a naturally appealing feature.** A real map invites "just add one more city" or "just add a zoom-in city view" mid-build. The non-goals list above is written to be pointed back to if that pressure shows up during implementation.

---

## Candidate Task Waves

### Wave 1 — Planning
- [x] This document
- [x] Feasibility spike actually run (Question 1), not deferred
- [x] Confirm exact current zone count/model and login-to-Nightmarket flow by reading the real code, not assuming
- [x] Confirm no existing world-scale content or coordinate system anywhere (repo-wide grep)
- [x] Resolve the unit-conversion-shaped open question from the prior scoping (world/continent/area field shape, FK direction, minimal-fields decision) before implementation starts
- [x] Tile-caching scope decided, real tile list computed, real tiles fetched and measured (Question 6)

### Wave 2 — Content Model
- [ ] `types.ts` additions, `worlds.ts`/`continents.ts`/`areas.ts`, `zones.ts` migration (`areaId` on all 5 zones)
- [ ] `ContentRegistry.ts`/`index.ts` wiring
- [ ] `ContentValidation.ts` new checks
- [ ] Question 5's scalability test

### Wave 3 — Client UI
- [ ] `leaflet`/`@types/leaflet` dependency
- [ ] One-time `scripts/downloadMapTiles.cjs` run, populating `apps/client/public/assets/map_tiles/pilsen/{z}/{x}/{y}.png` (179 files, Question 6)
- [ ] `WorldMapScene.ts` + `worldMap/` helpers, local-tile-primary / live-fallback tile layer
- [ ] `AccountShellScene.ts` wiring change (new secondary button, existing button untouched)
- [ ] Move (not duplicate) the existing join-flow body

### Wave 4 — Verification (priority)
- [ ] New scalability test passes
- [ ] Existing content-registry test passes unmodified with real Pilsen data
- [ ] `pnpm -r typecheck` clean
- [ ] Live Playwright check per the Verification Strategy above (existing-path regression, fresh-character and returning-character cases, local-vs-fallback tile source confirmed via network log, both viewport sizes, real screenshot evidence), outcome reported not assumed

### Wave 5 — Docs
- [ ] `docs/CORE_BUILD_0_32_RELEASE_NOTES.md`, naming the follow-up sequence explicitly (second area, level-gating, city/town distinction, multi-level navigation, production tile-serving, periodic tile-cache refresh)

---

## Summary

The existing content is already shaped like one city-and-its-surroundings (Question 2) — this build's whole job is proving that a real `world → continent → area` hierarchy can carry it with zero new zones invented, a real feasibility spike run and passed rather than assumed (Question 1), a minimal data model with no fields added in anticipation of features explicitly out of scope (Question 3), a single map screen that hands off to the *exact* existing join flow rather than a narrowed re-implementation of it (Question 4), a concrete, executable scalability test as the actual pass/fail gate rather than a prose assertion (Question 5), and a locally-cached tile set sized by actually fetching it rather than estimating, bounded pan/zoom so the live fallback stays a narrow edge case rather than an open door, and a reusable, parameterized caching script committed as a real tool rather than a throwaway — a deliberate step beyond this project's own prior precedent, since (unlike 0.23's icon cataloging or 0.24's DB-fixture technique, both only ever documented as prose recipes) this one is mechanically reusable for area #2 with no judgment calls to re-derive (Question 6: 179 tiles, 4.94 MB, confirmed real, confirmed attribution-compliant). Corrected mid-review: `currentZoneId` cannot distinguish a brand-new character from a returning one (it's set at creation, not left null), so rather than force every login through a screen that doesn't yet represent a real choice, the map ships as a genuine, fully-functional, but *optional* second entry point — every player's default path is byte-identical to today, stated as a deliberate Phase 1 decision rather than left as an omission. No server, protocol, or waypoint-system changes. The real risk is scope creep toward a second city or a nicer navigation UI mid-build; the non-goals list is written to be enforced, not just stated.
