# docs/CORE_BUILD_0_32_RELEASE_NOTES.md — Core Build 0.32 Release Notes

---

## Task — World Map Foundation

**Date:** 2026-09-07
**Build:** Core Build 0.32
**Status:** Implemented and verified.

### Summary

A real-world-coordinate map screen (Pilsen/Plzeň, via Leaflet.js + locally cached OpenStreetMap tiles) now exists as a new, optional entry point alongside character select's existing "Enter World" button — reachable, fully functional, but not yet mandatory for anyone. Backing it is a new `world → continent → area` content hierarchy (one real entry at each level: `earth` / `europe` / `pilsen`) that the existing Nightmarket + 4 combat zones migrate under, with zero new zones invented and zero server/protocol changes. A concrete, executable test proves the architecture's central claim — adding a second area is content-only, not a second architecture.

### What changed

- **`packages/content/src/data/types.ts`** — `WorldContentId`/`ContinentContentId`/`AreaContentId`, `WorldContentDefinition`/`ContinentContentDefinition`/`AreaContentDefinition` (minimal by design: World/Continent carry only identity/localization; Area adds `continentId`/`latitude`/`longitude`, nothing else). `ZoneContentDefinition` gains one new field, `areaId: AreaContentId` — the child-holds-parent-FK direction, matching `OriginContentDefinition.startingZoneId`'s existing precedent.
- **New `worlds.ts`/`continents.ts`/`areas.ts`** — one real entry each (`earth`, `europe`, `pilsen` at 49.7384°N, 13.3736°E).
- **`zones.ts`** — all 5 existing zones (`nightmarket`, `blackwire_sewers`, `static_yard`, `cinderworks`, `saltmere_docks`) gain `areaId: "pilsen"`. No other field changes; this is the entire migration.
- **`ContentRegistry.ts`/`index.ts`** — three new `ContentCollection`s wired through, matching every existing category's exact pattern.
- **`ContentValidation.ts`** — unique-id and localized-definition checks for all three new categories (reused, not reimplemented), plus new referential checks (every continent's `worldId`, every area's `continentId`, every zone's `areaId` resolves) and a lat/long finite-and-in-range check, matching the existing zone-bounds check's style.
- **`apps/client/scripts/downloadMapTiles.cjs`** (new, committed as a real reusable tool, not a throwaway) — takes a bounding box, zoom-level list, and output directory as CLI arguments; fetches every tile in that range from `tile.openstreetmap.org` and writes it to the standard Slippy Map `{z}/{x}/{y}.png` layout; reports real tile count and byte size on every run. Run twice with Pilsen's real coordinates (regional-context band, zoom 5-8; city band, zoom 9-13) to populate `apps/client/public/assets/map_tiles/pilsen/` — confirmed on disk: **179 files, 5.4MB**. `.cjs`, not the originally planned `.js`: `apps/client/package.json` sets `"type": "module"`, so a CommonJS `require`-based script needs the `.cjs` extension to run under plain `node` — Node's own documented escape hatch, not a design change.
- **New `apps/client/src/game/scenes/WorldMapScene.ts`** + **`worldMap/worldMapView.ts`** (Leaflet setup, marker rendering from `contentRegistry.areas`, full-screen always-interactive DOM overlay) + **`worldMap/worldMapTileLayer.ts`** (a custom `L.TileLayer` subclass serving the local cache path as primary, with a per-tile `error`-event fallback to the live OSM URL for the same coordinate — a real, working fallback, not a static placeholder image).
- **`apps/client/src/net/RealtimeClient.ts`** — new `enterWorldForCharacter(characters, characterId, sessionToken)`, extracted from `AccountShellScene.handleEnterWorld`'s inline body. Both "Enter World" and the map's marker-click now call this one real implementation.
- **`AccountShellScene.ts`** / **`worldEntryView.ts`** — "Enter World" is completely untouched (same call via the extracted helper, same behavior). A new, secondary "View World Map" button sits alongside it (`world_entry.view_world_map`), starting `WorldMapScene`.
- **Bounded pan/zoom**: the Leaflet map is constructed with `minZoom: 5`, `maxZoom: 13` (matching the cached range exactly), and `maxBounds` set to the padded regional box (`maxBoundsViscosity: 1.0`, a hard stop) — so the live-fallback path stays a narrow, bounded edge case, never an open door to fetching arbitrary, uncached parts of the world.
- **New localization keys**: `world.earth.*`, `continent.europe.*`, `area.pilsen.*`, `world_entry.view_world_map`, `world_map.title`, `world_map.back`.

### A real bug found by the live check, fixed before this build closed

The first live-check pass found the map screen rendering as a fragmented grid of tiles with large black gaps, and the marker/attribution control pushed thousands of pixels outside the visible viewport (marker `top: 2294px`, attribution `top: 1874px`, in a 900px-tall viewport) — present in the DOM, but practically invisible and unclickable by a normal user. Root cause, confirmed directly rather than guessed: **`leaflet/dist/leaflet.css` was never imported anywhere.** Without it, `.leaflet-tile` never received Leaflet's required `position: absolute`, so tiles stacked in normal document flow while still getting a `transform: translate3d` applied on top of that flow position.

Fixed with a one-line addition — `import "leaflet/dist/leaflet.css";` in `worldMapView.ts` — not a workaround around the symptom. Re-verified live, not just typechecked: tiles now tile edge-to-edge in clean 256px increments; the marker sits at a sane on-screen position (`{x:603, y:415}` in a 1400×900 viewport, vs. the prior `top:2294`); the attribution control is fully on-screen at `{x:1165.9, y:883.2}`; a normal (not forced/dispatched) Playwright `.click()` on the marker now correctly triggers the join; and the narrow 480×800 viewport also renders correctly with both elements repositioned on-screen. Treated as a real defect in this build's own new code and fixed accordingly — not filed as a "found, not fixed" note the way an unrelated pre-existing issue would be.

### Field-visibility / scope discipline held

- No server or protocol file touched anywhere in this build — the room-join call and its arguments are byte-identical to before; the client resolves a marker click to a `zoneId` entirely on its own, using content it already has loaded.
- `chat_message`-style payload discipline doesn't apply here (no new message type exists), but the same instinct applies to the map's own design: the marker reads only `latitude`/`longitude`/`nameKey` off `AreaContentDefinition` — nothing else is threaded into client rendering.
- Every player's default path (`AccountShellScene` → "Enter World" → join) is unchanged. Verified live via the Debug Panel showing `Room kind: town`, `Zone ID: nightmarket`, exactly as before this build.

### Verification

- **`apps/server/test/content/worldMapScalability.test.ts`** (new, 2 tests) — the actual pass/fail gate for the architecture's central claim: constructs a real `ContentRegistry` (the same unmodified class and `validateContentRegistry` function) with a synthetic second area/zone layered onto the real registry's other categories, and asserts it validates and resolves through the exact same `areas → continents → worlds` chain the real Pilsen area does. No `ContentRegistry.ts`, `ContentValidation.ts`, or client code needed to change to make it pass.
- **`apps/server/test/content/contentRegistryValidation.test.ts`** (existing, unmodified) — passes against the real registry, now covering the 3 new categories and the real Pilsen migration automatically.
- **Full suite**: 41 files / 75 tests, all green (37 baseline-for-this-session + 2 new scalability tests + 2 from the pending 0.31 fix already in the tree). `pnpm -r typecheck` clean across all 6 workspace packages — including a discovered build-order requirement: since `en.ts` gained new keys immediately consumed by strictly-typed content definitions (`nameKey: ContentLocalizationKey`), `@doomscrolls/localization` needs a real `build` (not just `typecheck`) before `@doomscrolls/content` sees them, via TypeScript's project-references/composite-build mechanism — matching this repo's own `validate:0.1` script, which already sequences it exactly this way.
- **Live Playwright check** (scratchpad-only, no repo dependency added): confirmed the existing "Enter World" path unchanged; the new "View World Map" button additive and reachable; real rendered tiles/marker/attribution (after the CSS fix); tiles served from the local cache as the primary path (31/31 image requests to `localhost:5173/assets/map_tiles/...` at the initial view, 0 to the live server); the live fallback genuinely triggers and succeeds for an off-Pilsen, cache-miss tile; `minZoom`/`maxZoom`/`maxBounds` all enforced (zoom capped at 5/13 across repeated gestures, repeated pan drags converged to a stable tile coordinate); a fresh character landing in Nightmarket via the map; a returning character (seeded with a persisted `blackwire_sewers` position) resuming there via the map, not Nightmarket; the Back button returning cleanly with no room joined; and the narrow 480×800 viewport rendering correctly. Zero console errors (one unrelated, pre-existing `favicon.ico` 404 confirmed present even on the plain login screen, unrelated to this build). All test accounts/characters/seeded rows deleted afterward, confirmed zero remaining.

### Non-goals held

No second continent/area/city/zone; no level-gating; no city-vs-safe-town distinction; no multi-level map navigation UI; no change to the waypoint/route-travel system; no server/protocol change; no custom cartographic art, map styling, non-OSM tile provider, or custom marker icon; no periodic tile-cache refresh mechanism.

### Queued follow-ups (named explicitly, as the plan requires)

1. **A second real area** (the next Czech city) — content-only, using `apps/client/scripts/downloadMapTiles.cjs` unchanged, just different arguments. The scalability test's own claim, ready to be exercised for real.
2. **Level-gating on areas/zones** — a real design question once a second area makes "which areas can I reach" meaningful for the first time.
3. **City-vs-safe-town distinction** — likely an `Area`-level field if built later, not decided now.
4. **Multi-level map navigation UI** — once there's a second area or continent to navigate between.
5. **Wiring the map into the mandatory entry path** (replacing "Enter World" rather than sitting beside it) — deferred until choosing between areas is a real decision.
6. **Production-scale tile serving** — a paid or self-hosted tile provider, if the live-fallback path ever sees meaningful real traffic beyond development/verification.
7. **Periodic tile-cache refresh** — a low-priority future nicety (e.g. an annual re-fetch), not a requirement today.

### Validation

```bash
pnpm --filter @doomscrolls/localization build   # required before content typecheck sees new locale keys
pnpm -r typecheck
pnpm --filter @doomscrolls/server test
```

No commit made yet — pending the user's own commit trigger, per standing rule (the tree was not clean going in, given the still-pending Core 0.31 work already sitting uncommitted).
