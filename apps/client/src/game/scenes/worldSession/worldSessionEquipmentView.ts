import type { Room } from "@colyseus/sdk";
import { t } from "@doomscrolls/localization";
import type { LocalizationKey } from "@doomscrolls/localization";
import type {
  EquipmentLoadout,
  EquipmentSlot,
  RoomState as DoomscrollsRoomState,
} from "@doomscrolls/shared";
import type { EquipmentUpdatedServerMessage } from "@doomscrolls/shared";
import { createMutedText } from "./worldSessionOverlayView";

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
): HTMLElement {
  const wrapper = document.createElement("details");
  wrapper.open = false;
  wrapper.style.border = "1px solid #31271c";
  wrapper.style.borderRadius = "8px";
  wrapper.style.background = "rgba(12, 10, 8, 0.72)";
  wrapper.style.padding = "0";

  const summary = document.createElement("summary");
  summary.textContent = t("equipment.title");
  summary.style.cursor = "pointer";
  summary.style.listStyle = "none";
  summary.style.padding = "8px";
  summary.style.fontSize = "13px";
  summary.style.color = "#d8c6a3";
  summary.style.fontWeight = "bold";
  wrapper.appendChild(summary);

  const content = document.createElement("div");
  content.style.padding = "0 8px 8px";
  content.style.display = "grid";
  content.style.gap = "4px";

  const render = (): void => {
    content.replaceChildren();
    const loadout = getLoadout();

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

      const slotLabel = document.createElement("span");
      slotLabel.textContent = t(SLOT_LABEL_KEYS[slot]);
      slotLabel.style.color = "#a88d63";
      row.appendChild(slotLabel);

      const valueLabel = document.createElement("span");
      if (itemId === null) {
        valueLabel.textContent = "Empty";
        valueLabel.style.color = "#5f4a2f";
      } else {
        valueLabel.textContent = "Equipped";
        valueLabel.style.color = "#b9d49a";
      }
      valueLabel.style.fontWeight = "bold";
      valueLabel.style.fontSize = "11px";
      row.appendChild(valueLabel);

      content.appendChild(row);
    }
  };

  render();
  wrapper.appendChild(content);

  return wrapper;
}