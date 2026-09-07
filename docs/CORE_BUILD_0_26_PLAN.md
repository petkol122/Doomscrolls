# docs/CORE_BUILD_0_26_PLAN.md — Core Build 0.26 Plan

## Theme: Inventory/Equipment Slot-Grid Visual Overhaul

## Which pack, confirmed first

The user named "Crusenho Complete UI Essential Pack." `apps/client/public/assets/`
has two candidates, and neither is a clean match — checked and asked
before building anything, rather than guessing:

- `01_Flat_Theme/` — added today (matches "newly-added"), but it's a
  generic flat/modern UI kit (Aseprite + Sprites + Spritesheets: buttons,
  toggles, sliders, banners). Its `FrameSlot01-03` a/b/c variants read as
  button *states* (idle/hover/selected) when viewed at actual size, not
  rarity tiers. No "Crusenho" string anywhere in it or the repo.
- `UI/` (00-07.png + All.png) — already in the repo since Sep 3 (used
  since 0.22/0.23 for item icons and the enemy HP bar), not newly-added.
  But `02.png`'s contact sheet shows rows of colored square slot-frame
  icons — green / orange / cyan / purple families — exactly the shape a
  rarity-tiered slot grid needs.

Asked the user directly; confirmed **`UI/`** is the one to use, even
though it doesn't match the named pack. Slot frames were pixel-located
in `02.png` (flood-fill + manual crop verification, not guessed from the
filename) and 3 clean 24x24 cells pre-cropped to individual files —
`UI/rarity_common.png` (green), `UI/rarity_rare.png` (cyan),
`UI/rarity_epic.png` (purple) — matching this project's real
`ItemRarity` tiers exactly (`packages/content/src/data/types.ts`:
`"common" | "rare" | "epic"`, no "legendary"). The sheet's orange family
is deliberately left unmapped — there's no fourth tier to map it to.

Color choice isn't arbitrary: rare=blue-ish/cyan and epic=purple already
matched this client's existing item-name text-color scheme
(`getItemRarityColor` in both `worldSessionOverlayView.ts` and
`worldSessionEquipmentView.ts`, pre-dating this build) — the frames
reinforce a color mapping that was already established, not invent one.

**No panel/window-chrome asset exists in the confirmed pack** — `UI/`
has slot frames, health bars, badges, and progress bars, but nothing
resembling a bordered panel background. Rather than force-fit a
mismatched asset (or introduce yet another pack-identity question),
the panel frame is a CSS-only upgrade (a warmer double-line border +
gradient ground), not claimed as pack-sourced. Named here plainly
instead of silently passed off as "from the pack."

## The real fix: a real grid, not a re-flowed list

`InventorySummaryItem` (`packages/shared/src/inventory/InventoryTypes.ts`)
already carries `pageIndex`/`x`/`y`/`size` — the server already models a
true positional 10x6 grid (`DEFAULT_INVENTORY_GRID_CONFIG`) with
multi-cell items (real content has 1x2, 2x1, 1x3, 2x3 items). The old
`createInventorySummarySection` ignored all of that and rendered a
`<ul>` of full-width text buttons. This build renders the *actual* grid:
a CSS grid sized to `gridWidth x gridHeight`, each item placed at its
real `(x, y)` spanning its real `(width, height)` via `grid-column`/
`grid-row`, with a plain neutral-bordered empty slot for every
uncovered cell. This is "as close as reasonably achievable this pass"
specifically because the real positional data already existed
server-side — rendering it properly is wiring, not new design.

Each occupied slot gets `resolveRarityFrameUrl(item.rarity)`'s frame as
its background (stretched via `background-size: 100% 100%` — a plain
stretch, not a 9-sliced border-image; acceptable for this pass since the
rarity color itself, not pixel-perfect border proportions on a 2x3
item, is the actual "distinct at a glance" requirement). An item with no
icon match falls back to a 3-letter text label, matching the prior
list's icon-fallback rule.

## Registry indirection (same rule as 0.22/0.23/0.25)

`VisualAssetCategory` gains `"rarity_frame"`
(`packages/content/src/data/types.ts`), three new
`VisualAssetContentDefinition` rows in `visualAssets.ts`, and a new
`resolveRarityFrameUrl(rarity)` in `apps/client/src/game/
rarityFrameResolver.ts` — mirrors `itemIconResolver.ts` exactly (the
only function that reads a rarity frame's `.path`). Rendering code never
touches `/assets/UI/rarity_*.png` directly.

## Equipment panel — same pass, not deferred

Time allowed in this pass, so it's done now rather than named as a
follow-up: `createEquipmentPanelSection`'s outer `<details>` gets the
same ornate panel treatment
(`applyWorldSessionOverlayItemPanelStyles`, new in
`worldSessionOverlayLayout.ts`, shared by both panels), and each
equipped-item row's icon is now a small rarity-framed slot
(`createItemIconSlot`, replacing the old bare 18x18 `<img>`) instead of
an unframed icon.

## Verification

Fresh characters start with an empty inventory (no starter-item grant
exists) and Core 0.1's only loot source is combat, so a real live check
needs seeded data — following 0.23's own precedent ("registered a real
test account and character... seeded one real ItemInstance"): registered
+ created a character through the real HTTP API, then inserted 5 real
`ItemInstance` rows directly (one common 1x1, one rare 1x1, one epic
1x1, one epic 1x3, one epic 2x3 — covering every rarity and exercising
the multi-cell span path) so the live Playwright pass has real
common/rare/epic and multi-cell items to actually look at, not just an
empty grid. See release notes for the full live-check results.
