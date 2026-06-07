import type { Room } from "@colyseus/sdk";
import { t } from "@doomscrolls/localization";
import type { LocalizationKey } from "@doomscrolls/localization";
import type {
  EquipmentLoadout,
  EquipmentSlot,
  InventorySummaryItem,
  RoomState as DoomscrollsRoomState,
} from "@doomscrolls/shared";
import type { StatModifier } from "@doomscrolls/shared";
import type { EquipmentUpdatedServerMessage } from "@doomscrolls/shared";
import { createMutedText } from "./worldSessionOverlayView";
import { makeInteractive } from "./worldSessionPointerEvents";

const COMMON_ITEM_COLOR = "#d8c6a3";

export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  "weapon",
  "head",
  "chest",
  "hands",
  "feet",
  "ring_1",
  "amulet",
  "belt",
  "flask_1",
] as const;

const SLOT_LABEL_KEYS: Record<EquipmentSlot, LocalizationKey> = {
  weapon: "equipment.slot.weapon",
  head: "equipment.slot.head",
  chest: "equipment.slot.chest",
  hands: "equipment.slot.hands",
  feet: "equipment.slot.feet",
  ring_1: "equipment.slot.ring_1",
  amulet: "equipment.slot.amulet",
  belt: "equipment.slot.belt",
  flask_1: "equipment.slot.flask_1",
};

export function createEmptyEquipmentLoadout(): EquipmentLoadout {
  return {
    weapon: null,
    head: null,
    chest: null,
    hands: null,
    feet: null,
    ring_1: null,
    amulet: null,
    belt: null,
    flask_1: null,
  };
}

export function registerEquipmentListener(
  room: Room<DoomscrollsRoomState>,
  setLoadout: (loadout: EquipmentLoadout) => void,
): () => void {
  const handler = (message: unknown): void => {
    const msg = message as EquipmentUpdatedServerMessage;
    if (msg.type === "equipment_updated" && msg.equipment !== undefined) {
      setLoadout(msg.equipment);
    }
  };

  room.onMessage("equipment_updated", handler);
  return () => {
    // No cleanup needed; room lifecycle handles listener teardown.
  };
}

export function createEquipmentPanelSection(
  getLoadout: () => EquipmentLoadout,
  getInventoryItems: () => readonly InventorySummaryItem[],
  isOpen = false,
  onOpenChange?: (isOpen: boolean) => void,
  onUnequipItem?: (slot: EquipmentSlot) => Promise<void>,
): HTMLElement {
  const wrapper = document.createElement("details");
  wrapper.open = isOpen;
  wrapper.style.border = "1px solid #31271c";
  wrapper.style.borderRadius = "8px";
  wrapper.style.background = "rgba(12, 10, 8, 0.72)";
  wrapper.style.padding = "0";
  makeInteractive(wrapper);
  wrapper.addEventListener("toggle", () => {
    onOpenChange?.(wrapper.open);
  });

  const summary = document.createElement("summary");
  summary.textContent = t("equipment.title");
  summary.style.cursor = "pointer";
  summary.style.listStyle = "none";
  summary.style.padding = "8px";
  summary.style.fontSize = "13px";
  summary.style.color = "#d8c6a3";
  summary.style.fontWeight = "bold";
  makeInteractive(summary);
  wrapper.appendChild(summary);

  const content = document.createElement("div");
  content.dataset.worldSessionEquipmentContent = "true";
  content.style.padding = "0 8px 8px";
  content.style.display = "grid";
  content.style.gap = "4px";
  wrapper.appendChild(content);
  updateEquipmentPanelSection(wrapper, getLoadout, getInventoryItems, isOpen, onUnequipItem);

  return wrapper;
}

export function updateEquipmentPanelSection(
  wrapper: HTMLElement,
  getLoadout: () => EquipmentLoadout,
  getInventoryItems: () => readonly InventorySummaryItem[],
  isOpen = false,
  onUnequipItem?: (slot: EquipmentSlot) => Promise<void>,
): void {
  if (!(wrapper instanceof HTMLDetailsElement)) {
    return;
  }

  wrapper.open = isOpen;

  const content = wrapper.querySelector("[data-world-session-equipment-content]");
  if (!(content instanceof HTMLElement)) {
    return;
  }

  content.replaceChildren();
  const loadout = getLoadout();
  const inventoryItems = getInventoryItems();

  for (const slot of EQUIPMENT_SLOTS) {
    const itemId = loadout[slot];
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.style.padding = "4px 8px";
    row.style.border = "1px solid #3c3122";
    row.style.borderRadius = "6px";
    row.style.background = "rgba(18, 14, 10, 0.88)";
    row.style.fontSize = "11px";
    makeInteractive(row);

    const slotLabel = document.createElement("span");
    slotLabel.textContent = t(SLOT_LABEL_KEYS[slot]);
    slotLabel.style.color = "#a88d63";
    row.appendChild(slotLabel);

    const valueLabel = document.createElement("span");
    if (itemId === null) {
      valueLabel.textContent = "Empty";
      valueLabel.style.color = "#5f4a2f";
    } else {
      const equippedItem = inventoryItems.find((item) => item.itemInstanceId === itemId) ?? null;
      valueLabel.textContent = equippedItem === null
        ? "Equipped"
        : formatEquippedItemLabel(equippedItem);
      valueLabel.style.color = equippedItem === null ? "#b9d49a" : getItemRarityColor(equippedItem.rarity);
    }
    valueLabel.style.fontWeight = "bold";
    valueLabel.style.fontSize = "11px";
    valueLabel.style.textAlign = "right";
    valueLabel.style.flex = "1";
    valueLabel.style.marginLeft = "8px";
    row.appendChild(valueLabel);

    if (itemId !== null && onUnequipItem !== undefined) {
      const unequipButton = document.createElement("button");
      unequipButton.type = "button";
      unequipButton.textContent = "Unequip";
      unequipButton.style.marginLeft = "8px";
      unequipButton.style.fontSize = "10px";
      unequipButton.style.padding = "4px 6px";
      unequipButton.style.border = "1px solid #6a8a4a";
      unequipButton.style.background = "rgba(49, 65, 38, 0.9)";
      unequipButton.style.color = "#d8c6a3";
      makeInteractive(unequipButton);
      unequipButton.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        unequipButton.disabled = true;
        unequipButton.textContent = "Unequipping...";
        try {
          await onUnequipItem(slot);
          unequipButton.textContent = "Unequipped!";
        } catch {
          unequipButton.disabled = false;
          unequipButton.textContent = "Failed";
          window.setTimeout(() => {
            unequipButton.textContent = "Unequip";
          }, 2000);
        }
      });
      row.appendChild(unequipButton);
    }

    content.appendChild(row);
  }
}

function formatEquippedItemLabel(item: InventorySummaryItem): string {
  const modifierSummary = formatCompactModifierSummary(item.statModifiers);
  return modifierSummary === null ? item.label : `${item.label} (${modifierSummary})`;
}

function getItemRarityColor(rarity?: string): string {
  if (rarity === "rare") {
    return "#8fc7ff";
  }

  return COMMON_ITEM_COLOR;
}

function formatCompactModifierSummary(modifiers?: readonly StatModifier[]): string | null {
  if (modifiers === undefined || modifiers.length === 0) {
    return null;
  }

  return modifiers
    .map((modifier) => formatModifierText(modifier))
    .join(", ");
}

function formatModifierText(modifier: StatModifier): string {
  const prefix = modifier.operation === "add" ? "+" : "×";
  return `${prefix}${modifier.value} ${modifier.target}`;
}