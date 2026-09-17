import { contentRegistry } from "@doomscrolls/content";
import type { EquipmentSlot, EquippedItemSummary, InventorySummaryItem, StatModifier } from "@doomscrolls/shared";
import {
  createModifierComparisonBlock,
  formatEquipmentSlotLabel,
  formatItemModifierText,
  resolveEquippedComparisonItem,
} from "./worldSessionItemCompareView";
import { getItemRarityColor } from "../../itemRarityColors";

/** A single floating hover tooltip, lazily created once and reused for
 * every inventory/equipment slot -- mirrors the "one shared floating
 * element repositioned per-anchor" approach `toIconMenuItem`'s flyouts
 * use, but positioned at the pointer instead of anchored to a panel. */
let tooltipElement: HTMLElement | null = null;

/** Milestone 0.3 -- Shift-Key Gear Comparison Tooltips. Tracked globally
 * (not per-element) since only one tooltip is ever visible at a time;
 * `activeTooltipRerender` lets a Shift press/release re-render whichever
 * item's tooltip is currently open without needing a fresh mouse event. */
let isShiftKeyHeld = false;
let activeTooltipRerender: (() => void) | null = null;

if (typeof document !== "undefined") {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Shift" || isShiftKeyHeld) {
      return;
    }
    isShiftKeyHeld = true;
    activeTooltipRerender?.();
  });
  document.addEventListener("keyup", (event) => {
    if (event.key !== "Shift") {
      return;
    }
    isShiftKeyHeld = false;
    activeTooltipRerender?.();
  });
}

function getOrCreateTooltipElement(): HTMLElement {
  if (tooltipElement !== null) {
    return tooltipElement;
  }

  const element = document.createElement("div");
  element.style.position = "fixed";
  // Must always paint above every floating window: `draggableWindow.ts`
  // raises a window's z-index (starting at 20000) each time it's
  // clicked/focused, so a lower static value here would end up behind
  // whichever window was focused most recently.
  element.style.zIndex = "200000";
  element.style.pointerEvents = "none";
  element.style.display = "none";
  element.style.maxWidth = "min(320px, calc(100vw - 24px))";
  element.style.padding = "8px 10px";
  element.style.border = "1px solid #4d3f2a";
  element.style.borderRadius = "8px";
  element.style.background = "rgba(10, 8, 7, 0.96)";
  element.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.5)";
  element.style.fontSize = "11px";
  element.style.color = "#d8c6a3";
  document.body.appendChild(element);
  tooltipElement = element;
  return element;
}

function positionTooltipNear(element: HTMLElement, clientX: number, clientY: number): void {
  const offsetPx = 16;
  const rect = element.getBoundingClientRect();
  const maxLeft = window.innerWidth - rect.width - 8;
  const maxTop = window.innerHeight - rect.height - 8;
  element.style.left = `${Math.max(8, Math.min(clientX + offsetPx, maxLeft))}px`;
  element.style.top = `${Math.max(8, Math.min(clientY + offsetPx, maxTop))}px`;
}

function renderTooltipContent(
  label: string,
  rarity: string | undefined,
  category: string | undefined,
  statModifiers: readonly StatModifier[] | undefined,
  comparison: { readonly slot: EquipmentSlot; readonly equippedItem: { readonly label: string; readonly statModifiers?: readonly StatModifier[] } } | null,
  affixNames?: readonly string[],
  /** Milestone 0.3 -- true when a comparable equipped item exists but
   * Shift isn't currently held, so the plain tooltip hints at the
   * Shift-compare feature instead of silently omitting it. */
  showCompareHint?: boolean,
  /** Milestone 0.3 -- Stackable Item Quantities. Present (and > 1) only
   * for a multi-unit stack, alongside the stack's total CZK value when
   * the item definition has a `baseValueCzk`. */
  quantityInfo?: { readonly quantity: number; readonly totalValueCzk: number | null },
): HTMLElement {
  const root = document.createElement("div");
  root.style.display = "grid";
  root.style.gap = "6px";

  const title = document.createElement("div");
  title.textContent = label;
  title.style.fontWeight = "bold";
  title.style.color = getItemRarityColor(rarity);
  root.appendChild(title);

  if (category !== undefined) {
    const meta = document.createElement("div");
    meta.textContent = category;
    meta.style.color = "#a88d63";
    meta.style.fontSize = "10px";
    root.appendChild(meta);
  }

  // Milestone 0.3 -- Server-Authoritative Item Rarity & Random Affix
  // Engine. Named affixes rolled onto this specific instance, shown
  // distinctly from the plain +stat lines below (which already include
  // the affixes' own modifiers, merged server-side).
  if (affixNames !== undefined && affixNames.length > 0) {
    const affixLine = document.createElement("div");
    affixLine.textContent = affixNames.join(", ");
    affixLine.style.color = getItemRarityColor(rarity);
    affixLine.style.fontSize = "10px";
    affixLine.style.fontStyle = "italic";
    root.appendChild(affixLine);
  }

  if (quantityInfo !== undefined && quantityInfo.quantity > 1) {
    const quantityLine = document.createElement("div");
    quantityLine.textContent =
      quantityInfo.totalValueCzk !== null
        ? `Quantity: ${quantityInfo.quantity} (worth ${quantityInfo.totalValueCzk} Kč)`
        : `Quantity: ${quantityInfo.quantity}`;
    quantityLine.style.color = "#a88d63";
    quantityLine.style.fontSize = "10px";
    root.appendChild(quantityLine);
  }

  if (comparison !== null) {
    const compareLabel = document.createElement("div");
    compareLabel.textContent = `vs. equipped ${formatEquipmentSlotLabel(comparison.slot)}: ${comparison.equippedItem.label}`;
    compareLabel.style.color = "#a88d63";
    compareLabel.style.fontSize = "10px";
    root.appendChild(compareLabel);
    root.appendChild(createModifierComparisonBlock(
      { statModifiers },
      comparison.equippedItem,
      { selectedLabel: "This item", equippedLabel: "Currently equipped" },
    ));
    return root;
  }

  if (statModifiers !== undefined && statModifiers.length > 0) {
    const list = document.createElement("ul");
    list.style.margin = "0";
    list.style.padding = "0 0 0 16px";
    for (const modifier of statModifiers) {
      const entry = document.createElement("li");
      entry.textContent = formatItemModifierText(modifier);
      list.appendChild(entry);
    }
    root.appendChild(list);
  }

  if (showCompareHint === true) {
    const hint = document.createElement("div");
    hint.textContent = "Hold Shift to compare with equipped";
    hint.style.color = "#6f5f45";
    hint.style.fontSize = "10px";
    hint.style.fontStyle = "italic";
    root.appendChild(hint);
  }

  return root;
}

function showTooltip(content: HTMLElement, clientX: number, clientY: number): void {
  const element = getOrCreateTooltipElement();
  element.replaceChildren(content);
  element.style.display = "block";
  positionTooltipNear(element, clientX, clientY);
}

export function hideItemTooltip(): void {
  activeTooltipRerender = null;
  if (tooltipElement !== null) {
    tooltipElement.style.display = "none";
  }
}

/** Attaches a hover tooltip to a bag item's slot element, comparing it
 * against whatever currently occupies its first allowed equipment slot
 * (if anything). Milestone 0.3 -- the comparison only renders while
 * Shift is held; otherwise the plain tooltip shows a hint that it's
 * available. Holding/releasing Shift re-renders the open tooltip in
 * place without requiring a fresh mouse event. */
export function attachInventoryItemTooltip(
  element: HTMLElement,
  item: InventorySummaryItem,
  getEquippedItems: () => readonly EquippedItemSummary[],
): void {
  let lastClientX = 0;
  let lastClientY = 0;

  const render = (): void => {
    const comparisonCandidate = resolveEquippedComparisonItem(item, getEquippedItems());
    const definition = contentRegistry.items.get(item.definitionId as never);
    const totalValueCzk =
      definition?.baseValueCzk !== undefined ? definition.baseValueCzk * item.quantity : null;
    const content = renderTooltipContent(
      item.label,
      item.rarity,
      item.category,
      item.statModifiers,
      isShiftKeyHeld ? comparisonCandidate : null,
      item.affixNames,
      comparisonCandidate !== null && !isShiftKeyHeld,
      { quantity: item.quantity, totalValueCzk },
    );
    showTooltip(content, lastClientX, lastClientY);
  };

  element.addEventListener("mouseenter", (event) => {
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    activeTooltipRerender = render;
    render();
  });
  element.addEventListener("mousemove", (event) => {
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    if (tooltipElement !== null && tooltipElement.style.display !== "none") {
      positionTooltipNear(tooltipElement, event.clientX, event.clientY);
    }
  });
  element.addEventListener("mouseleave", hideItemTooltip);
}

/** Attaches a hover tooltip to an equipped item's row -- just its own
 * stats, since it's already the equipped comparison target. Takes only
 * the fields it renders (not the full `EquippedItemSummary`) so callers
 * can also pass the inventory-item fallback the equipment panel looks
 * up equipped items with. */
export function attachEquippedItemTooltip(
  element: HTMLElement,
  item: { readonly label: string; readonly rarity?: string; readonly statModifiers?: readonly StatModifier[]; readonly affixNames?: readonly string[] },
): void {
  element.addEventListener("mouseenter", (event) => {
    activeTooltipRerender = null;
    const content = renderTooltipContent(item.label, item.rarity, undefined, item.statModifiers, null, item.affixNames);
    showTooltip(content, event.clientX, event.clientY);
  });
  element.addEventListener("mousemove", (event) => {
    if (tooltipElement !== null && tooltipElement.style.display !== "none") {
      positionTooltipNear(tooltipElement, event.clientX, event.clientY);
    }
  });
  element.addEventListener("mouseleave", hideItemTooltip);
}
