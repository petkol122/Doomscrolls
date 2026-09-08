# docs/CORE_BUILD_0_26_RELEASE_NOTES.md — Core Build 0.26 Release Notes

---

## Task — Inventory/Equipment Slot-Grid Visual Overhaul

**Date:** 2026-09-06
**Build:** Core Build 0.26
**Status:** Implemented and verified in one pass. Working tree was not
clean going in (0.24's combat-retaliation port and 0.25's UI pass were
already sitting uncommitted, both intentionally). This build's changes
are also left uncommitted alongside them, per the standing rule.

### Summary

Per `docs/CORE_BUILD_0_26_PLAN.md`:

1. **Asset pack confirmed, not guessed.** Neither candidate in
   `apps/client/public/assets/` was actually "Crusenho Complete UI
   Essential Pack" — asked the user directly rather than building on a
   guess. Confirmed: `UI/` (already in the repo since Sep 3), not the
   newly-added-but-mismatched `01_Flat_Theme/`. Three rarity slot frames
   pixel-located and cropped from `UI/02.png`: `rarity_common.png`
   (green), `rarity_rare.png` (cyan), `rarity_epic.png` (purple) —
   mapped to this project's real `ItemRarity` tiers only
   (common/rare/epic; the sheet's orange family is deliberately unused —
   there's no fourth tier).
2. **Registry indirection.** New `"rarity_frame"` `VisualAssetCategory`,
   3 new `visualAssets.ts` rows, and `rarityFrameResolver.ts`
   (`resolveRarityFrameUrl`) — mirrors `itemIconResolver.ts`. Rendering
   code never references a file path directly.
3. **Inventory panel → a real slot grid.** `createInventorySummarySection`
   now renders the actual `DEFAULT_INVENTORY_GRID_CONFIG` 10x6 grid,
   placing each item at its real `(x, y)` spanning its real
   `(width, height)` (the server already modeled this;
   `InventorySummaryItem` already carried `pageIndex`/`x`/`y`/`size` —
   the old code just never read it), with a plain empty-slot frame for
   every uncovered cell. Every occupied slot's background is its
   rarity's frame image, stretched to the slot's span.
4. **Equipment panel, same pass.** Same ornate panel frame
   (`applyWorldSessionOverlayItemPanelStyles`, shared by both panels)
   and each equipped item's icon now sits in a small rarity-framed slot
   (`createItemIconSlot`) instead of a bare icon.
5. **Panel chrome is CSS, not a pack asset — said so plainly.** `UI/`
   has no panel/window-background asset at all. Rather than force a
   mismatched image or raise a second pack-identity question, the
   panel frame (warmer double-line border + gradient) is a CSS-only
   upgrade. Not claimed as pack-sourced.

### A real bug hit mid-build: content-registry validation has its own hardcoded category list

Adding `"rarity_frame"` to the `VisualAssetCategory` *type*
(`packages/content/src/data/types.ts`) was not enough — the server
crashed on startup (`ContentValidationError: Unknown visual asset
category: rarity_frame`) because `ContentValidation.ts` keeps its own
separate runtime whitelist (`VALID_VISUAL_ASSET_CATEGORIES`), not
derived from the type. `pnpm typecheck` stayed clean throughout (a
string-literal runtime check, not a type-level one), which is exactly
why the server was restarted and actually watched boot, not just
typechecked — added `"rarity_frame"` to that list too
(`packages/content/src/ContentValidation.ts:364`).

### Verified

- `pnpm -r typecheck` clean across all 6 workspace projects.
- Server confirmed booting clean after the `ContentValidation.ts` fix
  (`"Content registry validation succeeded."` in its own startup log),
  not just typechecked.
- Fresh characters start with an empty inventory (no starter-item
  grant), so a real live check needed seeded data: registered a test
  account/character through the real HTTP API, then inserted 5 real
  `ItemInstance` rows directly (matching 0.23's own precedent) —
  Blackwire Scrap (common, 1x1), Rustbound Ring (rare, 1x1),
  Scavenger King's Helm (epic, 1x1), Condemned Cleaver (epic, 1x3),
  Warden Plate (epic, 2x3) — covering every rarity and both multi-cell
  span shapes.
- Live Playwright pass against the running dev stack, this seeded
  character, both a 1440x900 desktop and a 480x800 narrow viewport:
  - Inventory grid renders with real green/cyan/purple frames,
    immediately visually distinct — confirmed at pixel level (a 6x
    zoomed crop), not just "looked plausible" at thumbnail size (a
    first look mistook an item icon's own warm color for the frame
    color; zooming in confirmed the frames themselves are correctly
    green/cyan/purple).
  - Both multi-cell items (1x3, 2x3) render their frame stretched
    across the full span with no layout breakage, clearly still
    reading as epic/purple.
  - Selecting a slot shows the Item Detail panel with correct
    rarity/category/size/modifiers; equipping the epic weapon (via the
    existing Equip flow) correctly shows a purple-framed icon in the
    equipment panel's Weapon row.
  - Both panels show the new ornate border/gradient frame (replacing
    the flat single-color box) at both viewport sizes, with no
    clipping or overflow at 480px.
  - Zero console/page errors throughout.

### File footprint

`packages/content/src/data/types.ts` (`VisualAssetCategory` +
`"rarity_frame"`), `visualAssets.ts` (3 new rows),
`ContentValidation.ts` (runtime category whitelist), new
`apps/client/src/game/rarityFrameResolver.ts`, new
`apps/client/public/assets/UI/rarity_{common,rare,epic}.png`,
`worldSessionOverlayView.ts` (`createInventorySummarySection` rebuilt
around a real grid; new `applyInventorySlotShellStyles`/
`createItemPanelSectionBlock`), `worldSessionEquipmentView.ts` (new
`createItemIconSlot`, replacing `createItemIconImg`; ornate panel
frame), `worldSessionOverlayLayout.ts` (new
`applyWorldSessionOverlayItemPanelStyles`). No protocol changes; no new
item data or rarity tiers.
