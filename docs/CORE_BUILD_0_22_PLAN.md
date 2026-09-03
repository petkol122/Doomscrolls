# docs/CORE_BUILD_0_22_PLAN.md — Core Build 0.22 Plan

## Theme: Isometric Art Integration, Phase 1 — the Pipeline, Not the Coverage

## What's actually in the asset pack

`apps/client/public/assets/` (untracked until this build, dropped in by
hand) is monogon's *Isometric Dark Souls Gothic* pack: 70 PNGs, every one
a standalone 500×500 canvas with heavy transparent padding, no atlas/JSON,
no animation frames, and — checked by actually opening several, not
assumed — every image is hand-drawn black ink line art (a "coloring
book" style: bare outlines, occasional light-grey shading, transparent
fill) rather than painted sprites.

That rules out half of this build's stated Phase-1 options on inspection:
there is **no enemy or character art anywhere in the pack** — it's
furniture, architecture and floor/wall texture patches (chests, torches,
tables, bricks, stairs, slopes, an archway). So "one enemy sprite with
idle/walk states" isn't available this phase; "ground/floor tiles for one
zone" is. The closest thing to a floor tile is `isobricks.png` (a
worn-stone isometric floor patch — confirmed by opening it, not guessed
from the filename); its plain `isocube.png`/`isobricks2-4.png` siblings
are similar variants kept for later.

## Zero image rendering exists today — this is the actual first pipeline

Grepped the whole client for `add.image`/`load.image`/`add.sprite`:
none. Every visual in the world session (ground, props, player, enemies,
loot) is a Phaser vector primitive (`add.rectangle`/`add.circle`/
`graphics.fillRect`). `WorldSessionScene` has no `preload()`. So this
build isn't "swap one texture into an existing pipeline" — it's standing
the pipeline up for the first time, end to end, for exactly one texture,
which is the right amount of scope for a Phase 1.

## Architecture: a `visualAssets` content collection, same shape as everything else

New `packages/content/src/data/visualAssets.ts`, registered on
`ContentRegistry` exactly like `worldProps`/`items`/`enemies` (`.all`/
`.map`/`.get`/`.require`/`.has`, validated by the same
`validateContentRegistry` that already gates server boot and already has
a permanent regression test — `apps/server/test/content/
contentRegistryValidation.test.ts` — so no new test file is needed, the
existing blanket assertion picks up the new rows automatically):

```ts
interface VisualAssetContentDefinition {
  id: string;                 // semantic key, e.g. "ground_stone"
  category: "ground_tile" | "enemy_sprite" | "player_sprite" | "prop_sprite";
  path: string;                // "/assets/isobricks.png" — the ONLY place a real file path is written
  sourceWidth: number;
  sourceHeight: number;
}
```

Phase 1 ships exactly one row: `{ id: "ground_stone", category:
"ground_tile", path: "/assets/isobricks.png", sourceWidth: 500,
sourceHeight: 500 }`.

`ZoneContentDefinition` gets one new optional field, `groundTileKey?:
string`. Only `blackwire_sewers` sets it (to `"ground_stone"`). Every
other zone is left untouched — they keep today's flat placeholder fill
exactly as-is. That's the "not full coverage" boundary: one zone, by
construction, not by an if-branch someone has to remember to extend.

**The swap test**: replacing monogon's pack with a different one later
means editing `visualAssets.ts`'s `path` (and maybe `sourceWidth`/
`sourceHeight`). Nothing in `apps/client` changes — rendering code below
never sees a file path, only ever the semantic key `"ground_stone"`.

## Client pipeline: preload by content lookup, render by texture key

- `apps/client/src/game/visualAssetLoader.ts` (new, ~15 lines): given a
  scene and a zone id, resolves `zone.groundTileKey` →
  `contentRegistry.visualAssets.get(key)` → `scene.load.image(key,
  asset.path)`. This is the one function in the client that reads
  `.path`. Skips silently if the zone has no ground tile key (every zone
  but Blackwire) or the texture is already loaded (zone revisit /
  `scene.restart()` on travel).
- `WorldSessionScene.preload()` (new — the scene had none) calls it with
  the zone id already known from `this.room.state.zoneId` (the same
  synchronous read `showAreaBanner()` already relies on in `create()`).
  Phaser's loader runs to completion before `create()`, so the texture
  is guaranteed ready when the world view builds.
- `worldSessionGroundTileView.ts` (new, modeled directly on the existing
  `worldSessionStaticPropsView.ts` — same `refresh`/`updateProjection`/
  `destroy` shape, same `Map<key, GameObject>` reposition pattern):
  builds an 8×6 grid of 100-world-unit cells covering Blackwire's own
  `800×600` content bounds, and for each cell does `scene.add.image(x,
  y, groundTileKey).setDisplaySize(w, h)` — the texture key is the
  semantic key, never a filename. Rendering code that only ever sees
  `"ground_stone"` and never `isobricks.png` is the actual point of this
  build; a grep for `.png` outside `visualAssets.ts` and the loader
  should come back empty.
- Wired into `worldSessionAreaView.ts` at the exact two points
  `staticPropsView` already hooks in (`updateProjection` on every camera/
  state refresh, `refresh` inside the existing `roomStateDirty` guard),
  added to `worldContainer` *before* `staticPropsView` so tiles always
  render beneath props/entities by child order — no new depth-sorting
  system needed.

## Scope boundary I'm drawing on purpose: `debug_top_down` only

`worldToScreenDebugTopDown` is a per-axis linear scale — a 100×100 world
tile projects to an axis-aligned rectangle, so tiling it with
`Image.setDisplaySize()` is geometrically exact and gapless.
`worldToScreenIsometricPreview` is a real diamond shear; the same
axis-aligned rectangle would NOT tile seamlessly there — it would leave
visible gaps/overlaps, which is a visual bug, not just "less finished."
Since `isometric_preview` is already documented as a dev-only preview
toggle with click-to-move disabled, `worldSessionGroundTileView`
deliberately renders nothing in that mode rather than rendering it
wrong. True isometric diamond tile projection (warping the quad, not
just scaling the rectangle) is real follow-up work, not this build's.

## Non-goals

No enemy/player sprites (nothing in the pack to map them to — see
above). No wall/prop textures (same reasoning; static props keep their
vector shapes). No new prop/tile authoring UI. No changes to zone bounds,
spawn points, or any gameplay data — `visualAssets`/`groundTileKey` are
purely additive, read-only content.

## Verification

`pnpm typecheck` clean. `validateContentRegistry`'s existing full-registry
test exercises the new `visualAssets` rows and the new `groundTileKey`
reference check for free. Live Playwright check against the running dev
stack: enter Nightmarket, walk to and click the Blackwire Gate
interactable, confirm the `town_combat_handoff` lands the client in
Blackwire Sewers, screenshot the rendered ground-tile grid (not just
absence of console errors), and separately confirm Nightmarket (no
`groundTileKey`) is visually unchanged from before this build.
