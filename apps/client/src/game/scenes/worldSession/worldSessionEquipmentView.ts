import type { Room } from "@colyseus/sdk";
import { t } from "@doomscrolls/localization";
import type { LocalizationKey } from "@doomscrolls/localization";
import type {
  CharacterSummary,
  EquipmentLoadout,
  EquipmentSlot,
  InventorySummaryItem,
  RoomState as DoomscrollsRoomState,
} from "@doomscrolls/shared";
import type { StatModifier } from "@doomscrolls/shared";
import type { EquipmentUpdatedServerMessage } from "@doomscrolls/shared";
import { makeInteractive } from "./worldSessionPointerEvents";
import { applyWorldSessionOverlayItemPanelStyles } from "./worldSessionOverlayLayout";
import { resolveItemIconUrl } from "../../itemIconResolver";
import { resolveRarityFrameUrl } from "../../rarityFrameResolver";
import { consumeBufferedEquipmentLoadout } from "../../../net/equipmentUpdateBuffer";
// Money formatting lives in @doomscrolls/shared (server-owned / shared contract).
// The client must not reimplement gold/silver/copper breakdown ad hoc.
import { formatMoneyCompact } from "@doomscrolls/shared";

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
  // The join-time `equipment_updated` (see connectedPlayerRegistry /
  // buildEquipmentLoadout on the server) can arrive before this scene
  // exists to register a handler -- `bufferEquipmentUpdatesFor` (called
  // right after the room join resolves, in RealtimeClient.ts) catches it
  // in the meantime, so pick that up here before wiring the live handler.
  const buffered = consumeBufferedEquipmentLoadout(room);
  if (buffered !== null) {
    setLoadout(buffered);
  }

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
  getCharacter?: () => CharacterSummary | null,
): HTMLElement {
  const wrapper = document.createElement("details");
  wrapper.open = isOpen;
  wrapper.style.padding = "0";
  // Core 0.26 -- same ornate panel frame as the inventory panel, for
  // consistency (see docs/CORE_BUILD_0_26_PLAN.md).
  applyWorldSessionOverlayItemPanelStyles(wrapper);
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

  if (getCharacter !== undefined) {
    const money = document.createElement("div");
    money.dataset.worldSessionMoneyLine = "true";
    money.style.padding = "0 8px 6px";
    money.style.fontSize = "12px";
    money.style.fontFamily = "monospace";
    money.style.color = "#e0c88a";
    money.textContent = `${t("money.money_label")}: ${formatMoneyCompact(getCharacter()?.moneyCopper ?? 0)}`;
    wrapper.appendChild(money);
  }

  const content = document.createElement("div");
  content.dataset.worldSessionEquipmentContent = "true";
  content.style.padding = "0 8px 8px";
  content.style.display = "grid";
  content.style.gap = "4px";
  wrapper.appendChild(content);
  updateEquipmentPanelSection(wrapper, getLoadout, getInventoryItems, isOpen, onUnequipItem, getCharacter);

  return wrapper;
}

/**
 * Version checksum for equipment panel content, to skip full rebuilds when
 * nothing changed. Keyed per content element (not a single module-level
 * value) because `createEquipmentPanelSection` builds a brand new wrapper
 * on every overlay sync (see `syncUtilityView`) -- a module-level version
 * would compare a freshly created, still-empty element against whatever
 * version an earlier (now-discarded) element last rendered, "skip" the
 * rebuild it never actually did, and leave the panel blank until the next
 * genuine data change.
 */
const equipmentContentVersions = new WeakMap<HTMLElement, number>();

function computeEquipmentVersion(
  loadout: EquipmentLoadout,
  inventoryItems: readonly InventorySummaryItem[],
): number {
  let hash = 0;
  for (const slot of EQUIPMENT_SLOTS) {
    const itemId = loadout[slot];
    hash = ((hash << 5) - hash) + (itemId?.length ?? 0);
    hash |= 0;
  }
  hash = ((hash << 5) - hash) + inventoryItems.length;
  hash |= 0;
  return hash;
}

export function updateEquipmentPanelSection(
  wrapper: HTMLElement,
  getLoadout: () => EquipmentLoadout,
  getInventoryItems: () => readonly InventorySummaryItem[],
  isOpen = false,
  onUnequipItem?: (slot: EquipmentSlot) => Promise<void>,
  getCharacter?: () => CharacterSummary | null,
): void {
  if (!(wrapper instanceof HTMLDetailsElement)) {
    return;
  }

  wrapper.open = isOpen;

  if (getCharacter !== undefined) {
    const money = wrapper.querySelector("[data-world-session-money-line]");
    if (money instanceof HTMLElement) {
      money.textContent = `${t("money.money_label")}: ${formatMoneyCompact(getCharacter()?.moneyCopper ?? 0)}`;
    }
  }

  const content = wrapper.querySelector("[data-world-session-equipment-content]");
  if (!(content instanceof HTMLElement)) {
    return;
  }

  // Task 275 — Skip full rebuild when equipment loadout + inventory are unchanged.
  // Avoids resetting the equipment panel on every overlay update while the player moves.
  const loadout = getLoadout();
  const inventoryItems = getInventoryItems();
  const nextVersion = computeEquipmentVersion(loadout, inventoryItems);
  if (nextVersion === equipmentContentVersions.get(content)) {
    return;
  }
  equipmentContentVersions.set(content, nextVersion);

  content.replaceChildren();

  // Task 277 — Equipped items are no longer in inventorySummaryItems; they
  // live in character.equippedItems (EquippedItemSummary[]). We look up from
  // both sources so the panel shows the real equipped item label/rarity/stats.
  const equippedItems = getCharacter !== undefined
    ? (getCharacter()?.equippedItems ?? [])
    : [];

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
      // Look up from equippedItems first, then fall back to inventory items.
      const equippedItem = equippedItems.find((item) => item.itemInstanceId === itemId)
        ?? inventoryItems.find((item) => item.itemInstanceId === itemId)
        ?? null;
      valueLabel.textContent = equippedItem === null
        ? "Equipped"
        : formatEquippedItemLabel(equippedItem);
      valueLabel.style.color = equippedItem === null ? "#b9d49a" : getItemRarityColor(equippedItem.rarity);

      // Real icon when the pack has a reasonable match for this item
      // (see visualAssets.ts); otherwise the row stays text-only, same
      // as before this build. Appended here (valueLabel is appended
      // below) so it lands between the slot label and the value text.
      const iconUrl = equippedItem === null ? null : resolveItemIconUrl(equippedItem.definitionId);
      if (iconUrl !== null) {
        row.appendChild(createItemIconSlot(iconUrl, equippedItem?.rarity));
      }
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

/** A small pixelated item icon in a rarity-colored slot frame, for an
 *  equipped-item row. Only ever called with a URL already resolved
 *  through the content registry (see itemIconResolver.ts /
 *  rarityFrameResolver.ts) -- this function itself never sees a raw
 *  asset path decision, just renders whatever URLs it's given. Core
 *  0.26 -- was a bare 18x18 `<img>`; now the same rarity slot-frame
 *  treatment as the inventory grid, for panel consistency. */
function createItemIconSlot(url: string, rarity: string | undefined): HTMLElement {
  const slot = document.createElement("span");
  slot.style.position = "relative";
  slot.style.display = "inline-flex";
  slot.style.alignItems = "center";
  slot.style.justifyContent = "center";
  slot.style.width = "22px";
  slot.style.height = "22px";
  slot.style.flex = "0 0 auto";
  slot.style.boxSizing = "border-box";

  const frameUrl = resolveRarityFrameUrl(rarity);
  if (frameUrl === null) {
    slot.style.border = `1px solid ${COMMON_ITEM_COLOR}`;
    slot.style.borderRadius = "3px";
  } else {
    slot.style.backgroundImage = `url(${frameUrl})`;
    slot.style.backgroundSize = "100% 100%";
    slot.style.backgroundRepeat = "no-repeat";
  }

  const icon = document.createElement("img");
  icon.src = url;
  icon.alt = "";
  icon.style.width = "70%";
  icon.style.height = "70%";
  icon.style.imageRendering = "pixelated";
  slot.appendChild(icon);

  return slot;
}

function formatEquippedItemLabel(item: { readonly label: string; readonly rarity?: string; readonly statModifiers?: readonly StatModifier[] }): string {
  const modifierSummary = formatCompactModifierSummary(item.statModifiers);
  return modifierSummary === null ? item.label : `${item.label} (${modifierSummary})`;
}

function getItemRarityColor(rarity?: string | undefined): string {
  if (rarity === "epic") {
    return "#c77dff";
  }

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