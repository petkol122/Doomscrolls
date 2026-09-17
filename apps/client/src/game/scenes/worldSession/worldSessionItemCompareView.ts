import type { EquipmentSlot, EquippedItemSummary, InventorySummaryItem, StatModifier } from "@doomscrolls/shared";

/** Shared item-stat-comparison helpers, used by both the inventory detail
 * panel (worldSessionOverlayView.ts) and the drag/hover tooltip
 * (worldSessionItemTooltipView.ts) so the two surfaces render identical
 * comparison data instead of drifting apart. */

export function formatItemModifierText(modifier: StatModifier): string {
  const prefix = modifier.operation === "add" ? "+" : "×";
  return `${prefix}${modifier.value} ${modifier.target}`;
}

export function formatEquipmentSlotLabel(slot: EquipmentSlot): string {
  return slot.replace("_", " ");
}

/** Resolves the equipped item (if any) that a given bag item would
 * replace, using its first allowed equipment slot. Returns null when the
 * item isn't equippable or nothing currently occupies that slot. */
export function resolveEquippedComparisonItem(
  item: InventorySummaryItem,
  equippedItems: readonly EquippedItemSummary[],
): { readonly slot: EquipmentSlot; readonly equippedItem: EquippedItemSummary } | null {
  const firstSlot = item.allowedEquipmentSlots?.[0];
  if (firstSlot === undefined) {
    return null;
  }

  const equippedItem = equippedItems.find((candidate) => candidate.slot === firstSlot);
  if (equippedItem === undefined || equippedItem.itemInstanceId === item.itemInstanceId) {
    return null;
  }

  return { slot: firstSlot, equippedItem };
}

interface AggregatedModifier {
  readonly operation: StatModifier["operation"];
  readonly value: number;
}

/** Sums "add" modifiers and multiplies "multiply" modifiers per (target,
 * operation), so a stat spread across several modifier entries still
 * compares as one net value. */
function aggregateModifiers(modifiers: readonly StatModifier[] | undefined): Map<string, AggregatedModifier> {
  const map = new Map<string, AggregatedModifier>();
  for (const modifier of modifiers ?? []) {
    const key = `${modifier.target}:${modifier.operation}`;
    const existing = map.get(key);
    if (existing === undefined) {
      map.set(key, { operation: modifier.operation, value: modifier.value });
    } else {
      map.set(key, {
        operation: existing.operation,
        value: existing.operation === "add" ? existing.value + modifier.value : existing.value * modifier.value,
      });
    }
  }
  return map;
}

/** Net (selected - equipped) delta per (target,operation) key, used to
 * color a shift-compare tooltip's stat lines. A missing side defaults to
 * 0 for "add" and 1 for "multiply" (its identity value). */
export function computeModifierDeltas(
  selectedModifiers: readonly StatModifier[] | undefined,
  equippedModifiers: readonly StatModifier[] | undefined,
): ReadonlyMap<string, number> {
  const selected = aggregateModifiers(selectedModifiers);
  const equipped = aggregateModifiers(equippedModifiers);
  const deltas = new Map<string, number>();
  for (const key of new Set([...selected.keys(), ...equipped.keys()])) {
    const operation = selected.get(key)?.operation ?? equipped.get(key)?.operation ?? "add";
    const baseline = operation === "multiply" ? 1 : 0;
    const selectedValue = selected.get(key)?.value ?? baseline;
    const equippedValue = equipped.get(key)?.value ?? baseline;
    deltas.set(key, selectedValue - equippedValue);
  }
  return deltas;
}

export function createModifierComparisonBlock(
  selectedItem: { readonly statModifiers?: readonly StatModifier[] | undefined },
  equippedItem: { readonly statModifiers?: readonly StatModifier[] | undefined },
  labels: { readonly selectedLabel: string; readonly equippedLabel: string } = {
    selectedLabel: "Selected item modifiers",
    equippedLabel: "Equipped item modifiers",
  },
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.display = "grid";
  wrapper.style.gridTemplateColumns = "repeat(auto-fit, minmax(150px, 1fr))";
  wrapper.style.gap = "6px";
  wrapper.style.padding = "8px";
  wrapper.style.border = "1px solid #3c3122";
  wrapper.style.borderRadius = "6px";
  wrapper.style.background = "rgba(18, 14, 10, 0.88)";

  const deltas = computeModifierDeltas(selectedItem.statModifiers, equippedItem.statModifiers);
  wrapper.appendChild(createModifierComparisonColumn(labels.selectedLabel, selectedItem.statModifiers, deltas));
  wrapper.appendChild(createModifierComparisonColumn(labels.equippedLabel, equippedItem.statModifiers));
  return wrapper;
}

export function createModifierComparisonColumn(
  labelText: string,
  modifiers?: readonly StatModifier[],
  /** When provided, keyed by `${target}:${operation}` -- colors this
   * column's stat lines green (better than the other column) or red
   * (worse), leaving unchanged stats at the default color. */
  deltas?: ReadonlyMap<string, number>,
): HTMLElement {
  const container = document.createElement("div");
  container.style.display = "grid";
  container.style.gap = "4px";

  const label = document.createElement("div");
  label.textContent = labelText;
  label.style.color = "#a88d63";
  label.style.fontSize = "11px";
  label.style.fontWeight = "bold";
  container.appendChild(label);

  if (modifiers === undefined || modifiers.length === 0) {
    const muted = document.createElement("p");
    muted.textContent = "No modifiers.";
    muted.style.margin = "0";
    muted.style.color = "#a88d63";
    muted.style.fontSize = "12px";
    container.appendChild(muted);
    return container;
  }

  const list = document.createElement("ul");
  list.style.margin = "0";
  list.style.padding = "0 0 0 18px";
  list.style.color = "#d8c6a3";
  list.style.fontSize = "12px";

  for (const modifier of modifiers) {
    const entry = document.createElement("li");
    entry.textContent = formatItemModifierText(modifier);
    const delta = deltas?.get(`${modifier.target}:${modifier.operation}`);
    if (delta !== undefined && delta > 0) {
      entry.style.color = "#5fbf5f";
    } else if (delta !== undefined && delta < 0) {
      entry.style.color = "#e05c5c";
    }
    list.appendChild(entry);
  }

  container.appendChild(list);
  return container;
}
