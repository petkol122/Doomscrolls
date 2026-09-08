# docs/CORE_BUILD_0_32_CHECKLIST.md — Core Build 0.32 Checklist

---

## Core 0.32 Planning Open Checklist

**Date:** 2026-09-07
**Build:** Core Build 0.32
**Theme:** World Map Foundation
**Status:** Implemented and live-verified. A real bug was found during the live check (see Wave 4) and fixed before this checklist was closed out.

### Planning Deliverables

- [x] Create `docs/CORE_BUILD_0_32_PLAN.md`
- [x] Create `docs/CORE_BUILD_0_32_CHECKLIST.md`
- [x] Run the feasibility spike for real (Leaflet.js + OpenStreetMap tiles as a DOM overlay) rather than deferring it — confirmed real network reachability (`curl` to `tile.openstreetmap.org`, HTTP 200) and real browser rendering (20/20 tiles loaded in a real headless Chromium via Playwright, 0 errors, both required attributions visible in a screenshot)
- [x] Confirm no CSP or bundler restriction anywhere in this codebase would block loading external tiles or adding a new client dependency
- [x] Confirm the exact current zone count and content shape by reading `zones.ts`/`types.ts` directly: 5 zones (`nightmarket` + 4 combat zones), no lat/long, no world/continent/area concept anywhere
- [x] Confirm the exact current login-to-world flow by reading the real code: `AccountShellScene`'s single "Enter World" button calls `joinResolvedCharacterRoom` directly with no intermediate screen today
- [x] Confirm the existing waypoint/route-travel system is a distinct, already-inside-a-room fast-travel mechanism, not something this build re-skins or overlaps with
- [x] Confirm the general content-registry pattern (`ContentCollection`/`createCollection`/`ContentRegistryInput`, per-category `ContentValidation.ts` blocks) to model the new hierarchy identically, not as a new abstraction
- [x] Decide the FK direction for zone-to-area (child holds `areaId`, matching `OriginContentDefinition.startingZoneId`'s existing precedent) rather than the area listing its children
- [x] Decide World/Continent carry zero fields beyond identity/localization, and Area carries only what the map screen and the scalability test need — explicitly not adding a classification/gating field ahead of the non-goals that would need one
- [x] Confirm this build needs zero server/protocol changes — the room-join call stays exactly what it is today, unaware of areas/continents/worlds
- [x] Decide the map screen is a new `WorldMapScene`, reusing the account-shell's always-interactive DOM-overlay convention (not `WorldSessionScene`'s passive-root/canvas-passthrough convention, which doesn't apply here)
- [x] Checked and corrected a wrong premise from an earlier draft: `currentZoneId` is set at character creation (`CharacterService.ts:96`), not left null for a fresh character — there is no existing signal for "first-ever visit," so gating the map on it would either never show it or always show it, not selectively
- [x] Decided, given that correction: the map ships as a new, optional, secondary "View World Map" entry point alongside the existing "Enter World" button, not a mandatory step inserted in front of it — every player's default path stays byte-identical to today
- [x] Decide clicking the Pilsen marker calls the *exact* existing `joinResolvedCharacterRoom` call (extracted into a shared helper, not rewritten/narrowed) — explicitly not hardcoded to "always Nightmarket," so a returning character mid-combat-zone still resumes correctly if they choose to go through the map
- [x] Decide the map screen's "Back" control returns to `AccountShellScene` without joining anything
- [x] Decide against building multi-level map navigation UI now — nothing exists yet to navigate between
- [x] Name "wiring the map into the mandatory entry path" as an explicit, deferred follow-up (once a second area makes choosing between areas a real decision), not an omission
- [x] Define a concrete, executable scalability test (synthetic second area, asserting validation passes and the hierarchy resolves with zero non-content-file changes) as the actual pass/fail gate for Question 5, not a prose claim
- [x] Decide exact zoom range and bounding boxes for tile caching (regional context band zoom 5-8 over Czech Republic + margins; city band zoom 9-13 over a tight Pilsen-only box) — a real, stated decision, not left to "however many the UI happens to load"
- [x] Compute the exact tile list for that range via standard Slippy Map tile math, then **actually fetch all 179 tiles** from `tile.openstreetmap.org` (not estimated from a sample) — 179/179 succeeded, 0 errors, 5,175,775 bytes (4.94 MB) real measured total, average 28,915 bytes/tile
- [x] Confirm this real number is proportional to the task's own scoping instinct ("tiles for one small area at a few zoom levels") — under 5MB, 179 files, not a country-wide dataset
- [x] Decide storage location (`apps/client/public/assets/map_tiles/pilsen/{z}/{x}/{y}.png`, the standard Slippy Map layout, matching every other asset's home since 0.22) and that population happens via a one-time dev script, not runtime/build-pipeline code
- [x] Decide local cache is the primary tile source; live fetch to `tile.openstreetmap.org` is kept as a real (verified in Wave 4, not just designed) per-tile fallback for anything outside the cached box/zoom range
- [x] Decide no periodic refresh mechanism this build — a one-time cache is sufficient; note refresh as a low-priority future nicety, not a requirement
- [x] Confirm OpenStreetMap attribution is a UI-layer control independent of tile source — still required and still satisfied with local tiles, not weakened by caching
- [x] Raised during review: nothing was bounding pan/zoom, so a player could drag to an arbitrary uncached part of the world and generate live-fallback traffic for zero game content — decided `maxBounds` (padded regional box, `maxBoundsViscosity: 1.0`, hard stop) plus `minZoom`/`maxZoom` matching the cached range (5/13), so the fallback stays a narrow, bounded edge case
- [x] Raised during review: should the tile-caching script itself be a committed, reusable tool — checked whether the two prior "worth keeping" tools (0.23's icon cataloging, 0.24's DB-fixture technique) were ever actually committed as scripts, and found neither was (both were documented only as prose recipes in release notes); decided this one is a deliberately different case (mechanically parameterizable, no judgment calls to re-derive) and is worth committing as a real, reusable, documented tool rather than repeating the throwaway pattern
- [x] Define candidate task waves
- [x] Define explicit non-goals, each named as a real follow-up rather than silently dropped
- [x] Define the risk list (tile-server usage policy — reduced now that caching is primary, DOM/canvas interaction, scope-creep pressure)

### Core 0.32 Scope Guardrails (for implementation, once approved)

- [x] No new continent, area, city, or zone is added — only the existing 5 zones migrate under the one real Pilsen area
- [x] No level-gating, city-vs-safe-town classification, or any field supporting either is added to Area or Zone
- [x] No server or protocol file is touched — the join-room call and its arguments are unchanged
- [x] No change to the waypoint/route-travel system
- [x] `AccountShellScene`'s existing "Enter World" button and its behavior are completely untouched — verified live (Debug Panel showed `Room kind: town`, `Zone ID: nightmarket` for a fresh character), not just left alone by omission
- [x] The new "View World Map" button is additive/secondary, not a replacement, and does not gate or intercept the existing "Enter World" path — verified live, both buttons visible side by side
- [x] The marker-click handler calls the extracted (not reimplemented) existing join-flow body, verified to still correctly resume a returning character's in-progress zone (seeded `blackwire_sewers`, confirmed resumed there via Debug Panel), not just a fresh character's default
- [x] `World`/`Continent` content definitions carry no fields beyond identity/localization; `Area` carries only `continentId`/`latitude`/`longitude` plus identity/localization
- [x] OpenStreetMap attribution is visibly present in the rendered map, not suppressed — confirmed on-screen (`getBoundingClientRect` inside viewport) after the CSS fix below
- [x] No custom map art, no non-OSM tile provider, no custom marker icon
- [x] The scalability test actually constructs a second synthetic area and asserts zero non-content-file changes were needed — not asserted from the shape of the code alone
- [x] A live Playwright check actually views the rendered map (screenshot evidence of real tiles + marker + attribution), not just a console-error check — this is exactly what caught the real Leaflet CSS bug below
- [x] The live check covers the existing "Enter World" path (regression, unchanged), a fresh character via "View World Map" (lands in Nightmarket), and a returning character via "View World Map" with a persisted combat-zone position (resumes there) — all three confirmed
- [x] The exact 179-tile set (matching this plan's computed list) is fetched once and committed under `apps/client/public/assets/map_tiles/pilsen/`, not a different/re-scoped set
- [x] The map screen serves tiles from the local cache as the primary path — confirmed via real network-request inspection in the live check (31/31 image requests to `localhost:5173/assets/map_tiles/...` at the initial zoom), not assumed from the code
- [x] The live-fallback-to-OSM path is exercised for real (pan past the cached box's edge) in the live check — confirmed a real local 404 redirected to a real, successful `tile.openstreetmap.org` request for the exact same coordinate
- [x] `maxBounds`/`minZoom`/`maxZoom` are actually configured on the Leaflet map and verified live (zoom capped at 5/13 across repeated wheel gestures; repeated pan drags converged to a stable tile coordinate, confirming the hard bound) — not just designed on paper
- [x] The tile-download script is committed as a real file (`apps/client/scripts/downloadMapTiles.cjs` — renamed from the planned `.js` extension; `apps/client/package.json` sets `"type": "module"`, so a CommonJS `require`-based script needs the `.cjs` extension to run under plain `node`, Node's own documented escape hatch), parameterized by bounding box/zoom list/output directory (not hardcoded to Pilsen), and documented at the top of the file with its usage and the exact invocation used for Pilsen — actually run twice to produce the real 179-tile cache
- [x] No periodic tile-refresh mechanism is built this build
- [x] `pnpm -r typecheck` clean before any commit

### Real bug found during the live check, fixed before closing this checklist

- [x] **Missing `leaflet/dist/leaflet.css` import.** The first live-check pass found the map rendering as a fragmented grid of tiles with large black gaps — root cause: without Leaflet's own stylesheet, `.leaflet-tile` never received `position: absolute`, so tiles stacked in normal document flow while still getting a `transform: translate3d` applied, and the marker/attribution control were pushed thousands of pixels outside the viewport (marker `top: 2294px`, attribution `top: 1874px` in a 900px-tall viewport) — present, but practically invisible and unclickable.
- [x] Fixed with a one-line addition (`import "leaflet/dist/leaflet.css";` in `apps/client/src/game/scenes/worldMap/worldMapView.ts`), not a workaround.
- [x] Re-verified live, not just typechecked: tiles now tile edge-to-edge in clean 256px increments, marker at a sane on-screen position (`{x:603,y:415}` in a 1400x900 viewport), attribution fully on-screen (`{x:1165.9,y:883.2}`), a normal (not forced/dispatched) Playwright `.click()` on the marker now correctly triggers the join, and the narrow 480x800 viewport also renders correctly with both elements repositioned on-screen.

### Candidate Wave Checklist

#### Wave 1 — Planning
- [x] Finalize 0.32 scope documents
- [x] Feasibility spike run and passed

#### Wave 2 — Content Model
- [x] `types.ts`: `WorldContentId`/`ContinentContentId`/`AreaContentId`, three new definition interfaces, `areaId` added to `ZoneContentDefinition`
- [x] New `worlds.ts`/`continents.ts`/`areas.ts` (one real entry each, real Pilsen coordinates)
- [x] `zones.ts`: `areaId: "pilsen"` added to all 5 existing zones
- [x] `ContentRegistry.ts`/`index.ts`: three new collections wired through
- [x] `ContentValidation.ts`: unique-id, localized-definition, and three new referential checks, plus a lat/long bounds check
- [x] New scalability test (synthetic second area) passes — 2 tests, `apps/server/test/content/worldMapScalability.test.ts`
- [x] `pnpm --filter @doomscrolls/content typecheck` clean (required rebuilding `@doomscrolls/localization` first — a project-references/composite-build ordering requirement discovered along the way, matching this repo's own `validate:0.1` script sequencing)

#### Wave 3 — Client UI
- [x] `leaflet`/`@types/leaflet` added to `apps/client/package.json`
- [x] New reusable `apps/client/scripts/downloadMapTiles.cjs` (bbox/zoom-list/output-dir parameters, usage documented at the top of the file), run twice with Pilsen's real arguments (regional + city bands) to populate `apps/client/public/assets/map_tiles/pilsen/{z}/{x}/{y}.png` with the exact 179-tile set (confirmed on disk: 179 files, 5.4MB)
- [x] New `WorldMapScene.ts` + `worldMap/` helper module, tile layer pointed at the local cache path as primary with a per-tile live-fallback wrapper for cache misses, `maxBounds`/`minZoom`/`maxZoom` configured to bound pan/zoom to the cached range
- [x] `AccountShellScene.ts`: existing "Enter World" button/behavior untouched; new secondary "View World Map" button added alongside it, starting `WorldMapScene`
- [x] Existing join-flow body extracted (not duplicated) into a shared helper (`enterWorldForCharacter` in `RealtimeClient.ts`) both entry points call
- [x] `pnpm --filter @doomscrolls/client typecheck` clean

#### Wave 4 — Verification (priority)
- [x] Scalability test passes; existing `contentRegistryValidation.test.ts` passes unmodified with real Pilsen data
- [x] Full existing suite stays green (41 files / 75 tests)
- [x] `pnpm -r typecheck` clean
- [x] Live Playwright check: existing "Enter World" path confirmed unchanged, real rendered tiles/marker/attribution screenshotted via the new "View World Map" path, local-cache-vs-live-fallback tile source confirmed via network-request inspection, bounded pan/zoom confirmed by attempting to exceed it, fresh-character case, returning-character case, narrow-viewport case, zero console errors — outcome reported, not assumed. First pass found a real bug (missing `leaflet.css` import, breaking tile layout and pushing the marker/attribution off-screen); fixed and re-verified live, confirmed resolved on every previously-failing check.

#### Wave 5 — Docs
- [x] `docs/CORE_BUILD_0_32_RELEASE_NOTES.md`, naming the follow-up sequence (second area, level-gating, city/town distinction, multi-level navigation, production tile-serving, periodic tile-cache refresh) explicitly

### Explicit Non-Goals / Deferred Items

- [x] Any second continent, area, city, or zone (content-only follow-up once this build's architecture is proven)
- [x] Level-gating on areas/zones (a real design question deferred to whenever a second area makes it real)
- [x] City-vs-safe-town distinction (deferred; likely lives on Area if built later, not decided now)
- [x] Multi-level map navigation UI (nothing to navigate between yet)
- [x] Wiring the map into the mandatory entry path (stays a secondary, optional entry point this build; deferred until a second area makes it a real decision)
- [x] Any change to the waypoint/route-travel system
- [x] Any server or protocol change
- [x] Real cartographic/city art, custom map styling, non-OSM tile provider, custom marker icon
- [x] Periodic tile-cache refresh (one-time cache is sufficient; a future nicety, not a requirement)

### Planning Exit Criteria

- [x] Core Build 0.32 has a clear theme grounded in a direct audit of the current zone content, current login flow, and current content-registry pattern, with the exact evidence cited
- [x] The feasibility spike was actually run, with real observed numbers/screenshots, not assumed or deferred
- [x] The area-granularity question was confirmed against the actual current content's scale, not decided in the abstract
- [x] The data-model question (FK direction, minimal fields, no server/protocol dependency) was answered with explicit reasoning tied to this codebase's existing conventions, not invented from scratch
- [x] The UI question was answered with a concrete scene/overlay-convention choice, and a wrong premise about `currentZoneId` found and corrected mid-review rather than left standing — resulting in an explicit decision that the map is a new optional entry point, not a mandatory gate, and what that means for both a fresh and a returning character
- [x] The scalability question has a concrete, executable test defined as the actual pass/fail gate, not a prose claim
- [x] The tile-caching addition has a real, fetched, measured number (179 tiles, 4.94 MB) rather than an estimate, a stated zoom range/bounding-box decision, a confirmed-not-assumed attribution answer, and an explicit no-refresh-this-build decision
- [x] Pan/zoom bounding was raised, decided (`maxBounds`/`minZoom`/`maxZoom`), and given a real live-check step, not left open-ended
- [x] The tile-caching script's reusability was raised, checked against actual prior precedent (found neither prior "worth keeping" tool was ever committed), and decided as a deliberate, justified exception rather than assumed
- [x] Core Build 0.32 has grouped candidate waves
- [x] Core Build 0.32 has explicit non-goals, each named as a real follow-up
- [x] Core Build 0.32 has an explicit risk list
- [x] Core Build 0.32 has a verification strategy covering the new scalability test and a concretely-designed live Playwright check that actually views the map, confirms the existing "Enter World" path is unchanged, and covers both fresh- and returning-character cases through the new optional path
- [x] Plan reviewed and approved by the user
- [x] Implementation completed: Waves 2-5 done, all vitest coverage green (41 files / 75 tests), a real bug (missing `leaflet.css` import) found by the live check, fixed, and re-verified live, release notes written
