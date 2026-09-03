# docs/CORE_BUILD_0_22_RELEASE_NOTES.md — Core Build 0.22 Release Notes

---

## Task — Isometric Art Integration, Phase 1

**Date:** 2026-09-03
**Build:** Core Build 0.22
**Status:** Implemented and verified in one pass. Working-tree only — nothing committed until this note.

### Summary

Stood up the first real image-rendering pipeline in the client — before
this build, every visual in the world session (ground, props, player,
enemies, loot) was a Phaser vector primitive; a grep for `add.image`/
`load.image`/`add.sprite` across the whole client came back empty. Per
`docs/CORE_BUILD_0_22_PLAN.md`, this build proves that pipeline for one
thing end-to-end rather than mapping the full monogon "Isometric Dark
Souls Gothic" pack: a new `visualAssets` content collection
(`packages/content`, same `.all`/`.map`/`.get`/`.has` shape as
`worldProps`/`items`/`enemies`) maps semantic keys to actual file paths,
a new optional `groundTileKey` field on `ZoneContentDefinition` lets a
zone opt in, and Blackwire Sewers is the one zone that does — mapped to
`"ground_stone"` (`isobricks.png`, confirmed by actually opening the
file to be a worn-stone isometric floor patch, not guessed from its
name). Every other zone is untouched and keeps its existing flat
placeholder fill.

Rendering code never references a file path or pack name — only the
semantic key. `WorldSessionScene.preload()` (new; the scene had none)
resolves the current zone's `groundTileKey` through the registry and
queues the actual file via `visualAssetLoader.ts`'s
`queueZoneGroundTileLoad` — the one function in the client that reads
`VisualAssetContentDefinition.path`. `worldSessionGroundTileView.ts`
(new, modeled directly on the existing `worldSessionStaticPropsView.ts`)
builds an 8×6 grid of 100-world-unit tiles across Blackwire's `800×600`
bounds and renders each with `scene.add.image(x, y, groundTileKey)` —
the texture key is the semantic key, `"ground_stone"`, never
`isobricks.png`.

One deliberate scope boundary: the view only renders in
`debug_top_down` projection. That mode's world-to-screen math is a
per-axis linear scale, so an axis-aligned tile rectangle tiles exactly;
`isometric_preview`'s real diamond shear would leave visible gaps with
the same rectangle, which is a visual bug, not a rougher-but-valid
render — and that mode is already a dev-only toggle with click-to-move
disabled. True isometric diamond tile projection is real follow-up
work, not this build's.

### Verified

- `pnpm typecheck` clean across all 5 workspace packages.
- `pnpm --filter @doomscrolls/content lint` and
  `pnpm --filter @doomscrolls/client lint` clean.
- `apps/server/test/content/contentRegistryValidation.test.ts` — the
  existing full-registry integrity test — passes with the new
  `visualAssets` rows and the new `groundTileKey` reference check
  (added to `ContentValidation.ts`) exercised for free; no new test
  file was needed for that.
- Live-checked with Playwright against the running dev stack: entered
  Nightmarket, confirmed it renders exactly as before (flat background,
  no texture) across many screenshots taken through this session.
  Getting into Blackwire Sewers through the actual in-game gate
  interaction (`nightmarket_blackwire_gate_01`, walk-then-interact) hit
  unrelated friction — the click-to-move/pending-interact screen-to-world
  math is a non-trivial existing system (camera bounds, a
  player-centering world-container offset, and a small hit-box) that
  cost significant trial-and-error to calibrate by hand and never
  reliably completed the handoff in the time available; this looks like
  friction in that pre-existing system, not something this build
  touched (`resolveWorldInteraction.ts`, `pendingInteractTracker.ts`,
  and `TownRoom.ts`'s route-travel handling are all untouched by this
  change). To actually see the rendered result rather than get stuck on
  that unrelated system, verification instead set a fresh test
  character's `currentZoneId` directly in the local Postgres container
  (a normal "start the session already in zone X" fixture technique,
  not a client code path) and logged back in, which routes into
  Blackwire Sewers' `CombatRoom` the same way a reconnect does. The
  resulting screenshot confirms the `isobricks` ground-tile grid
  rendering correctly across the zone, enemies and the player visible
  on top of it, zero console errors.
- One intermittent `Cannot read properties of null (reading
  'drawImage')` browser error appeared a few times during the
  Nightmarket gate-click attempts above, always alongside WebGL
  "GPU stall" / context-loss warnings from many rapid headless-Chromium
  relaunches in a short span. It did not reproduce in the final,
  most-direct check (the one that actually exercises the new texture
  pipeline), and Nightmarket never loads a texture at all (it has no
  `groundTileKey`) — noted here for transparency, not attributed to
  this change without further reproduction.

### File footprint

`packages/content/src/data/types.ts` (`VisualAssetCategory`,
`VisualAssetContentDefinition`, `ZoneContentDefinition.groundTileKey`),
`packages/content/src/data/visualAssets.ts` (new, one row),
`packages/content/src/data/zones.ts` (Blackwire Sewers'
`groundTileKey`), `ContentRegistry.ts` + `index.ts` (wiring/exports),
`ContentValidation.ts` (new validation rules). `apps/client/src/game/
visualAssetLoader.ts` (new), `apps/client/src/game/scenes/worldSession/
worldSessionGroundTileView.ts` (new), `worldSessionAreaView.ts` (wired
in at the same two hook points `staticPropsView` already uses),
`WorldSessionScene.ts` (`preload()`). No server, protocol, or gameplay
changes.
