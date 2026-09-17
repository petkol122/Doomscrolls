/**
 * Core 0.1 UI Overhaul Phase 2 -- the Inventory bag grid ('B'), extracted
 * out of the old top-right corner-menu flyout into its own draggable
 * window (see draggableWindow.ts) so it can sit side-by-side with the
 * Character window instead of overlapping other flyouts in one corner.
 */
import type {
  CharacterSummary,
  EquippedItemSummary,
  InventorySummaryItem,
} from "@doomscrolls/shared";
import { DEFAULT_INVENTORY_GRID_CONFIG } from "@doomscrolls/shared";

import { bringWindowToFront, createWindowChrome } from "./draggableWindow";
import { createMutedText, createSectionBlock } from "./worldSessionOverlayView";
import { makeInteractive } from "./worldSessionPointerEvents";
import { makeInventoryDropZone, makeInventoryGridCellDropZone, makeInventoryItemDraggable } from "./worldSessionItemDragDrop";
import { attachInventoryItemTooltip } from "./worldSessionItemTooltipView";
import { applyWorldSessionOverlayItemPanelStyles } from "./worldSessionOverlayLayout";
import { resolveItemIconUrl } from "../../itemIconResolver";
import { resolveRarityFrameUrl } from "../../rarityFrameResolver";
import { getItemRarityColor } from "../../itemRarityColors";

const COMMON_ITEM_ACCENT_COLOR = "#a88d63";
const INVENTORY_GRID_CELL_PX = 30;
const INVENTORY_GRID_GAP_PX = 3;

export interface WorldSessionInventoryWindowView {
  readonly isOpen: () => boolean;
  readonly toggle: () => void;
  readonly show: () => void;
  readonly hide: () => void;
  readonly update: (character: CharacterSummary | null) => void;
  readonly destroy: () => void;
}

export function createWorldSessionInventoryWindowView(
  onEquipItem?: (characterId: string, itemInstanceId: string, slot: string) => Promise<void>,
  onUnequipItem?: (characterId: string, slot: string) => Promise<void>,
  onMoveItem?: (itemInstanceId: string, targetPageIndex: number, targetX: number, targetY: number) => void,
): WorldSessionInventoryWindowView {
  const chrome = createWindowChrome({
    title: "Inventory",
    onClose: () => hide(),
    left: "340px",
    top: "90px",
    width: "320px",
  });
  chrome.setVisible(false);
  document.body.appendChild(chrome.root);

  let latestCharacter: CharacterSummary | null = null;

  // Drag an equipped item's row out of its slot and drop it anywhere in
  // the inventory panel to unequip -- mirrors the drop-onto-equipment-slot
  // wiring in worldSessionEquipmentView.ts, so both directions dispatch
  // the same real server call rather than mutating state locally.
  if (onUnequipItem !== undefined) {
    makeInventoryDropZone(chrome.body, (slot) => {
      const characterId = latestCharacter?.id;
      if (characterId !== undefined) {
        void onUnequipItem(characterId, slot);
      }
    });
  }

  function hide(): void {
    chrome.setVisible(false);
  }

  function show(): void {
    chrome.setVisible(true);
    bringWindowToFront(chrome.root);
    render();
  }

  function isOpen(): boolean {
    return !chrome.root.hidden;
  }

  function toggle(): void {
    if (isOpen()) {
      hide();
    } else {
      show();
    }
  }

  function render(): void {
    const items = latestCharacter?.inventorySummaryItems ?? [];
    const equippedItems = latestCharacter?.equippedItems ?? [];
    const characterId = latestCharacter?.id ?? null;

    chrome.body.replaceChildren();
    chrome.body.style.overflowX = "hidden";
    chrome.body.style.boxSizing = "border-box";
    const summarySection = createInventorySummarySection(items, equippedItems, onMoveItem, characterId, onEquipItem);
    chrome.body.append(summarySection);
  }

  function update(character: CharacterSummary | null): void {
    latestCharacter = character;
    if (isOpen()) {
      render();
    }
  }

  function destroy(): void {
    chrome.root.remove();
  }

  return { isOpen, toggle, show, hide, update, destroy };
}

function createItemPanelSectionBlock(titleText: string, children: readonly HTMLElement[], options?: { readonly compact?: boolean }): HTMLElement {
  const wrapper = createSectionBlock(titleText, children, options);
  applyWorldSessionOverlayItemPanelStyles(wrapper);
  // Core 0.4 HUD Overhaul -- these panels sit directly inside the
  // Inventory window's scrollable body; without an explicit
  // border-box + hidden horizontal overflow, the double border/padding
  // stack from createSectionBlock + this panel treatment could push a
  // panel's true width a few pixels past the window's inner content
  // box and trigger a horizontal scrollbar on every open.
  wrapper.style.boxSizing = "border-box";
  wrapper.style.maxWidth = "100%";
  wrapper.style.overflowX = "hidden";
  return wrapper;
}

/** Core 0.26 -- a real slot grid, not a scrollable text list: every item
 * already carries its true `pageIndex`/`x`/`y`/`size` (the server-owned
 * grid position, `packages/shared/src/inventory/InventoryTypes.ts`), so
 * this renders the actual `DEFAULT_INVENTORY_GRID_CONFIG` grid (page 0 --
 * Core 0.1 has exactly one page) with each item spanning its real
 * width/height, plus an empty rarity-neutral slot for every uncovered
 * cell, instead of re-flowing occupied items into an arbitrary list.
 *
 * Core 0.4 follow-up -- item info is a Diablo 2-style hover tooltip
 * (`attachInventoryItemTooltip`) rather than a permanent "Item Detail"
 * panel that ate space under the grid and needed a click to populate;
 * there is no click-to-select state here anymore. Equipping without
 * dragging is a right-click on the item (also very D2), since the old
 * standing panel's "Equip" button no longer has anywhere to live. */
function createInventorySummarySection(
  items: readonly InventorySummaryItem[],
  equippedItems: readonly EquippedItemSummary[] = [],
  onMoveItem?: (itemInstanceId: string, targetPageIndex: number, targetX: number, targetY: number) => void,
  characterId?: string | null,
  onEquipItem?: (characterId: string, itemInstanceId: string, slot: string) => Promise<void>,
): HTMLElement {
  if (items.length === 0) {
    return createItemPanelSectionBlock("Inventory Summary", [createMutedText("No inventory items in bag.")], { compact: true });
  }

  const { gridWidth, gridHeight } = DEFAULT_INVENTORY_GRID_CONFIG;
  const pageItems = items.filter((item) => item.pageIndex === 0);

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = `repeat(${gridWidth}, ${INVENTORY_GRID_CELL_PX}px)`;
  grid.style.gridTemplateRows = `repeat(${gridHeight}, ${INVENTORY_GRID_CELL_PX}px)`;
  grid.style.gap = `${INVENTORY_GRID_GAP_PX}px`;
  grid.style.boxSizing = "border-box";
  grid.style.maxWidth = "100%";
  makeInteractive(grid);

  const occupied = new Set<string>();
  for (const item of pageItems) {
    const width = item.size?.width ?? 1;
    const height = item.size?.height ?? 1;
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        occupied.add(`${item.x + dx},${item.y + dy}`);
      }
    }

    const slot = document.createElement("button");
    slot.type = "button";
    slot.dataset.inventoryItemId = item.itemInstanceId;
    slot.style.gridColumn = `${item.x + 1} / span ${width}`;
    slot.style.gridRow = `${item.y + 1} / span ${height}`;
    applyInventorySlotShellStyles(slot, item.rarity);
    makeInteractive(slot);
    makeInventoryItemDraggable(slot, item.itemInstanceId, item.allowedEquipmentSlots);
    attachInventoryItemTooltip(slot, item, () => equippedItems);

    if (characterId != null && onEquipItem !== undefined) {
      const firstAllowedSlot = item.allowedEquipmentSlots?.[0];
      if (firstAllowedSlot !== undefined && item.category !== "flask" && item.category !== "material") {
        slot.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void onEquipItem(characterId, item.itemInstanceId, firstAllowedSlot);
        });
      }
    }

    // Real icon when the pack has a reasonable match for this item (see
    // visualAssets.ts); otherwise a short text fallback, same fallback
    // rule item rows used before this build.
    const iconUrl = resolveItemIconUrl(item.definitionId);
    if (iconUrl === null) {
      const fallbackText = document.createElement("span");
      fallbackText.textContent = item.label.slice(0, 3);
      fallbackText.style.fontSize = "9px";
      fallbackText.style.color = getItemRarityColor(item.rarity);
      fallbackText.style.textAlign = "center";
      fallbackText.style.overflow = "hidden";
      fallbackText.style.pointerEvents = "none";
      slot.appendChild(fallbackText);
    } else {
      const icon = document.createElement("img");
      icon.src = iconUrl;
      icon.alt = "";
      icon.style.width = "70%";
      icon.style.height = "70%";
      icon.style.imageRendering = "pixelated";
      icon.style.pointerEvents = "none";
      slot.appendChild(icon);
    }

    if (item.quantity > 1) {
      const quantityBadge = document.createElement("span");
      quantityBadge.textContent = item.quantity > 999 ? "999+" : String(item.quantity);
      quantityBadge.style.position = "absolute";
      quantityBadge.style.right = "1px";
      quantityBadge.style.bottom = "1px";
      quantityBadge.style.fontSize = "9px";
      quantityBadge.style.lineHeight = "1";
      quantityBadge.style.color = "#f0e6d2";
      quantityBadge.style.textShadow = "0 1px 2px rgba(0, 0, 0, 0.9), 0 0 2px rgba(0, 0, 0, 0.9)";
      quantityBadge.style.pointerEvents = "none";
      slot.appendChild(quantityBadge);
    }

    grid.appendChild(slot);
  }

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      if (occupied.has(`${x},${y}`)) {
        continue;
      }

      const emptySlot = document.createElement("div");
      emptySlot.style.gridColumn = `${x + 1} / span 1`;
      emptySlot.style.gridRow = `${y + 1} / span 1`;
      applyInventorySlotShellStyles(emptySlot, undefined);
      emptySlot.style.opacity = "0.4";
      if (onMoveItem !== undefined) {
        makeInventoryGridCellDropZone(emptySlot, 0, x, y, onMoveItem);
      }
      grid.appendChild(emptySlot);
    }
  }

  return createItemPanelSectionBlock("Inventory Summary", [grid], { compact: true });
}

/** Shared shell styling for both an occupied (item) and empty inventory
 * grid cell -- a rarity-colored slot frame from the pack when the item
 * has a recognized rarity (`resolveRarityFrameUrl`), or a plain neutral
 * border for an empty cell / an item with no rarity match. */
function applyInventorySlotShellStyles(cell: HTMLElement, rarity: string | undefined): void {
  cell.style.position = "relative";
  cell.style.display = "flex";
  cell.style.alignItems = "center";
  cell.style.justifyContent = "center";
  cell.style.padding = "0";
  cell.style.margin = "0";
  cell.style.boxSizing = "border-box";
  cell.style.background = "rgba(20, 16, 12, 0.85)";
  cell.style.cursor = cell.tagName === "BUTTON" ? "pointer" : "default";

  const frameUrl = resolveRarityFrameUrl(rarity);
  if (frameUrl === null) {
    cell.style.border = `1px solid ${COMMON_ITEM_ACCENT_COLOR}`;
    cell.style.borderRadius = "3px";
  } else {
    cell.style.border = "none";
    cell.style.borderRadius = "0";
    cell.style.backgroundImage = `url(${frameUrl})`;
    cell.style.backgroundSize = "100% 100%";
    cell.style.backgroundRepeat = "no-repeat";
    cell.style.backgroundPosition = "center";
  }
}

