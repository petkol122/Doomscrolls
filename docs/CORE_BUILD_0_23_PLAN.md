# docs/CORE_BUILD_0_23_PLAN.md — Core Build 0.23 Plan

## Theme: Two Perspective-Agnostic Asset Integrations

Both packs confirmed present under `apps/client/public/assets/` before
anything else: `items/` (Glionox items16) and `UI/` (bdragon1727 health
bars). Both are icons/UI, not world sprites, so — unlike 0.22's ground
tiles — neither needs `worldToScreenActiveProjection` or any projection-
mode awareness at all.

## 1. Item icons

### What's actually in `items/`

Two unrelated packs share the folder. `item1.png`…`item1244.png` are
16×16 (confirmed by reading PNG headers) — that's items16. A second set,
`01_dish.png`…`102_waffle_dish.png`, is 32×32 and entirely food-themed —
a different, unrelated pack, not used here.

items16 ships with **no filenames or metadata** — 1244 anonymous numbered
icons. Browsing all of them by hand isn't practical, so a Node script
(`pngjs`, scratch-only, not committed) tiled batches into contact sheets
and I read those to catalog what exists: swords/daggers, axes/hammers,
bows/wands/staves, shields, helmets/hoods, chest armor, gloves, boots,
rings, potion bottles, a first-aid box, raw ore/gem chunks, a dull coin —
and, taking up roughly a third of the pack, food and cooking tools
(unrelated to this game's items and not used).

### Mapping approach

`items.ts` already carries an `iconKey` field per item (e.g.
`"item_starter_pipe_placeholder"`) — unused today, same as `spriteKey` on
enemies before 0.22. Per the "registry maps to it, not the other way
around" instruction, **`items.ts` is untouched.** `visualAssets.ts` gets
one new row per matched item, keyed by that item's *existing* `iconKey`
string. Rendering resolves `contentRegistry.items.get(definitionId)
?.iconKey` → `contentRegistry.visualAssets.get(iconKey)?.path`; a miss
(no row for that key) means the UI keeps rendering exactly as it does
today — plain text, no icon, no placeholder box invented for this build.

27 of 34 items got a real, visually-confirmed reasonable match (by
category and, where possible, theme — `slagforged_maul` gets an actual
war-hammer icon, `cinderfist_gauntlets` gets a fire-colored gauntlet,
`scavenger_king_helm` gets a literal crown). 7 have no reasonable match
in this pack and were left alone rather than forced: `scrap_cloth` (no
cloth/fabric icon found), the three amulet items (bangle/torc shapes
exist but read as bracelets, not neck-worn pendants — not a clean enough
match to call "reasonable"), and the three belt items (no belt/sash/
buckle icon found anywhere in the pack). The full per-item table is the
comment block at the top of `visualAssets.ts`.

### Rendering

Both spots are plain DOM (`<img>`, not Phaser) — no preload step needed,
the browser loads them itself:

- `worldSessionEquipmentView.ts` — each equipped-slot row gets an 18×18
  pixelated `<img>` when the slot's item resolves to a real icon.
- `worldSessionOverlayView.ts`'s inventory list — each item button gets
  the same icon inline with its label when one resolves.

`image-rendering: pixelated` on both so 16px source art doesn't blur.

## 2. Enemy HP bars

### What already existed

`worldSessionEnemyPlaceholderView.ts` already draws a real, server-data-
driven HP bar above every enemy — `getHpRatio(enemy)` from the real
`TownRoomEnemySnapshot.hp`/`maxHp` feeds `hpBarFill.setScale(hpRatio, 1)`
on a plain Phaser rectangle. This build's job is the same kind of reskin
0.21 did for the player HP orb: swap the flat-color rectangle for real
pack art, keep the exact same data path.

### What's actually in `UI/`

`05.png` (384×32, an 8-frame strip) is unmistakably the health-bar asset
— a green→yellow→orange→red depletion sequence. Checked pixel bounds
with `pngjs` rather than assuming a clean 8-slice: frames 0–5 share a
consistent 48×25 opaque footprint; frames 6–7 are a visibly smaller
(37×14) "critical" variant. Using all 8 in one gradient would jump size
right before empty, so only frames 0–5 are ever selected — a deliberate,
documented scope cut, not an oversight. (`00.png`–`04.png`/`06.png`/
`07.png` and `All.png` are other bar/GUI styles in the same pack —
stars, gems, shields, rings, pips — not used this build.)

### Design

One `Phaser.GameObjects.Sprite` per enemy (replacing the old frame+fill
rectangle pair), texture `enemy_hp_bar_strip` loaded via
`scene.load.spritesheet` in `WorldSessionScene.preload()` — unconditional
(not zone-gated like the ground tile), since every room kind renders
enemies through this same view. Frame index is a pure function of
`hpRatio`: `round((1 - hpRatio) * 5)`, clamped to `[0, 5]` — full HP
shows frame 0 (green), defeat-adjacent HP shows frame 5 (reddest of the
consistent group). This is a **discrete 6-tier bar**, not a continuously
cropped one — a deliberate choice given the source frames aren't a
uniform gradient strip that crops cleanly (each frame's colored region
is a different pre-baked shape, not a left-anchored fill), and discrete
HP tiers are a normal, legible pixel-art convention. A per-variant color
tint the old rectangle had (brute = orange, others = red) is dropped —
the real sprite's own baked colors already carry the state, and variant
is still visible via the enemy's body/ring color, unchanged.

A boss-specific bar variant is not built this pass — the pack's other
sheets (rings, shield-shaped frames) could plausibly serve one later,
but nothing in the current enemy roster calls for it, so it's noted as a
future option rather than forced in now.

## Verification

`pnpm typecheck` clean. `validateContentRegistry`'s existing full-registry
test (`apps/server/test/content/contentRegistryValidation.test.ts`)
exercises the new rows for free, including a new check added to
`ContentValidation.ts`: every `item_icon`-category row's `id` must match
some item's real `iconKey` (catches an orphaned/typo'd mapping), and
spritesheet dimensions (`frameWidth * frameCount === sourceWidth`) are
checked generically for any future multi-frame asset.

For the HP bar specifically (real combat state, not a mockup): live-
verified by attacking an enemy in a running combat room and watching the
bar's frame advance as HP drops, then deliberately broke the wiring
(hardcoded the frame selector to always return 0) to confirm the same
check would visibly fail — the bar stayed green through damage that
should have dropped it — before restoring the real selector and
re-confirming it tracks damage again. See the release notes for what
was actually observed on screen, not just "no console errors."
