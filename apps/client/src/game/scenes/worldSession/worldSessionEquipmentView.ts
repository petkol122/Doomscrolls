import type { Room } from "@colyseus/sdk";
import { contentRegistry } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";
import type { LocalizationKey } from "@doomscrolls/localization";
import type {
  CharacterSummary,
  CurrencyId,
  EquipmentLoadout,
  EquipmentSlot,
  EquippedItemSummary,
  InventorySummaryItem,
  RoomState as DoomscrollsRoomState,
} from "@doomscrolls/shared";
import { CURRENCY_IDS } from "@doomscrolls/shared";
import type { EquipmentUpdatedServerMessage } from "@doomscrolls/shared";
import { makeInteractive } from "./worldSessionPointerEvents";
import { bringWindowToFront, createWindowChrome } from "./draggableWindow";
import { createDerivedStatsSection } from "./worldSessionOverlayView";
import { resolveItemIconUrl } from "../../itemIconResolver";
import { getItemRarityColor } from "../../itemRarityColors";
import { resolvePlayerTint } from "./classTint";
import { consumeBufferedEquipmentLoadout } from "../../../net/equipmentUpdateBuffer";
import { makeEquipmentSlotDropZone, makeEquippedItemDraggable } from "./worldSessionItemDragDrop";
import { attachEquippedItemTooltip } from "./worldSessionItemTooltipView";
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
  "flask_2",
  "flask_3",
  "flask_4",
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
  flask_2: "equipment.slot.flask_2",
  flask_3: "equipment.slot.flask_3",
  flask_4: "equipment.slot.flask_4",
};

type CharacterWindowTab = "equipment" | "attributes" | "currencies" | "reputation";

const CHARACTER_WINDOW_TABS: readonly { readonly id: CharacterWindowTab; readonly labelKey: LocalizationKey }[] = [
  { id: "equipment", labelKey: "character_window.tab.equipment" },
  { id: "attributes", labelKey: "character_window.tab.attributes" },
  { id: "currencies", labelKey: "character_window.tab.currencies" },
  { id: "reputation", labelKey: "character_window.tab.reputation" },
];

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
    flask_2: null,
    flask_3: null,
    flask_4: null,
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

export interface WorldSessionCharacterWindowView {
  readonly isOpen: () => boolean;
  readonly toggle: () => void;
  readonly show: () => void;
  readonly hide: () => void;
  readonly update: () => void;
  readonly destroy: () => void;
}

/** Milestone 0.3 -- the Character sheet ('C') as a WoW/Diablo-style
 *  paperdoll window with tabbed sub-pages (Equipment / Attributes /
 *  Currencies / Reputation), replacing the old single flat list of
 *  equipment rows. Positioned to sit side-by-side with the Inventory
 *  window (see WorldSessionScene.ts, which opens both together when
 *  'C' is pressed) rather than stacking on top of it. */
export function createWorldSessionCharacterWindowView(
  getLoadout: () => EquipmentLoadout,
  getInventoryItems: () => readonly InventorySummaryItem[],
  getCharacter: () => CharacterSummary | null,
  onUnequipItem?: (slot: EquipmentSlot) => Promise<void>,
  onEquipItem?: (characterId: string, itemInstanceId: string, slot: EquipmentSlot) => Promise<void>,
): WorldSessionCharacterWindowView {
  const chrome = createWindowChrome({
    title: t("character_window.title"),
    onClose: () => hide(),
    left: "24px",
    top: "90px",
    width: "336px",
  });
  chrome.setVisible(false);
  document.body.appendChild(chrome.root);

  let activeTab: CharacterWindowTab = "equipment";

  const tabButtons = new Map<CharacterWindowTab, HTMLButtonElement>();
  const tabBar = document.createElement("div");
  tabBar.style.display = "flex";
  tabBar.style.gap = "4px";
  tabBar.style.padding = "0 0 8px";
  for (const tab of CHARACTER_WINDOW_TABS) {
    const button = createTabButton(t(tab.labelKey), () => {
      activeTab = tab.id;
      applyActiveTab();
      render();
    });
    tabButtons.set(tab.id, button);
    tabBar.appendChild(button);
  }
  chrome.body.appendChild(tabBar);

  const equipmentTab = createEquipmentTabContent(getCharacter, onUnequipItem, onEquipItem);
  const attributesTab = createAttributesTabContent();
  const currenciesTab = createCurrenciesTabContent();
  const reputationTab = createReputationTabContent();
  chrome.body.append(equipmentTab.root, attributesTab.root, currenciesTab.root, reputationTab.root);

  function applyActiveTab(): void {
    for (const [tab, button] of tabButtons) {
      setTabButtonActive(button, tab === activeTab);
    }
    equipmentTab.root.style.display = activeTab === "equipment" ? "grid" : "none";
    attributesTab.root.style.display = activeTab === "attributes" ? "grid" : "none";
    currenciesTab.root.style.display = activeTab === "currencies" ? "grid" : "none";
    reputationTab.root.style.display = activeTab === "reputation" ? "grid" : "none";
  }
  applyActiveTab();

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
    const character = getCharacter();
    switch (activeTab) {
      case "equipment":
        equipmentTab.render(getLoadout(), getInventoryItems(), character);
        break;
      case "attributes":
        attributesTab.render(character);
        break;
      case "currencies":
        currenciesTab.render(character);
        break;
      case "reputation":
        break;
    }
  }

  function update(): void {
    if (isOpen()) {
      render();
    }
  }

  function destroy(): void {
    chrome.root.remove();
  }

  return { isOpen, toggle, show, hide, update, destroy };
}

function createTabButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.flex = "1 1 auto";
  button.style.padding = "5px 4px";
  button.style.fontSize = "10px";
  button.style.fontWeight = "bold";
  button.style.borderRadius = "6px";
  button.style.cursor = "pointer";
  makeInteractive(button);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

function setTabButtonActive(button: HTMLButtonElement, isActive: boolean): void {
  button.style.border = isActive ? "1px solid #e0c88a" : "1px solid #4d3f2a";
  button.style.background = isActive ? "rgba(60, 46, 30, 0.9)" : "rgba(18, 14, 10, 0.75)";
  button.style.color = isActive ? "#f0dec0" : "#a88d63";
}

/** A labeled key/value row shared by the Attributes and Currencies tabs. */
function createStatRow(labelText: string, valueText: string, valueColor = "#d8c6a3"): HTMLElement {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.justifyContent = "space-between";
  row.style.alignItems = "center";
  row.style.padding = "4px 8px";
  row.style.border = "1px solid #3c3122";
  row.style.borderRadius = "6px";
  row.style.background = "rgba(18, 14, 10, 0.88)";
  row.style.fontSize = "11px";

  const label = document.createElement("span");
  label.textContent = labelText;
  label.style.color = "#a88d63";
  row.appendChild(label);

  const value = document.createElement("span");
  value.textContent = valueText;
  value.style.color = valueColor;
  value.style.fontWeight = "bold";
  value.style.fontFamily = "monospace";
  row.appendChild(value);

  return row;
}

interface EquipmentTabRefs {
  readonly root: HTMLElement;
  readonly render: (
    loadout: EquipmentLoadout,
    inventoryItems: readonly InventorySummaryItem[],
    character: CharacterSummary | null,
  ) => void;
}

/** Tab 1 -- the paperdoll itself plus a compact wallet line and the
 *  existing baseline (Move/Attack/HP) stat chips. */
function createEquipmentTabContent(
  getCharacter: () => CharacterSummary | null,
  onUnequipItem?: (slot: EquipmentSlot) => Promise<void>,
  onEquipItem?: (characterId: string, itemInstanceId: string, slot: EquipmentSlot) => Promise<void>,
): EquipmentTabRefs {
  const root = document.createElement("div");
  root.style.display = "grid";
  root.style.gridTemplateColumns = "1fr";
  root.style.gap = "8px";

  const money = document.createElement("div");
  money.style.fontSize = "12px";
  money.style.fontFamily = "monospace";
  money.style.color = "#e0c88a";
  money.style.textAlign = "center";
  root.appendChild(money);

  const paperdoll = createPaperdollLayout(getCharacter, onUnequipItem, onEquipItem);
  root.appendChild(paperdoll.root);

  const statsContainer = document.createElement("div");
  root.appendChild(statsContainer);

  const render = (
    loadout: EquipmentLoadout,
    inventoryItems: readonly InventorySummaryItem[],
    character: CharacterSummary | null,
  ): void => {
    money.textContent = `${t("money.money_label")}: ${formatMoneyCompact(character?.moneyCopper ?? 0)}`;
    paperdoll.render(loadout, inventoryItems, character);

    const derivedStatsContent = createDerivedStatsSection(character).lastElementChild;
    statsContainer.replaceChildren();
    if (derivedStatsContent instanceof HTMLElement) {
      const divider = document.createElement("div");
      divider.style.height = "1px";
      divider.style.background = "rgba(88, 68, 45, 0.6)";
      divider.style.margin = "6px 0";
      statsContainer.append(divider, derivedStatsContent);
    }
  };

  return { root, render };
}

interface PaperdollRefs {
  readonly root: HTMLElement;
  readonly render: (
    loadout: EquipmentLoadout,
    inventoryItems: readonly InventorySummaryItem[],
    character: CharacterSummary | null,
  ) => void;
}

/**
 * WoW/Diablo-style paperdoll layout: left/right gear columns framing a
 * central character silhouette, weapon slot underneath. `EquipmentSlot`
 * only models the 12 slots above (no legs/off-hand/second-ring yet),
 * so the paperdoll is arranged from those -- it doesn't invent slots
 * the data model and server (`EquipmentService`) don't support.
 * Milestone 0.3 -- flask_2/3/4 fill the previously-unused r4/r5 cells
 * and a new 7th row (r6), turning the single flask slot into the
 * 4-slot flask belt.
 */
const PAPERDOLL_GRID_AREAS: Record<EquipmentSlot, string> = {
  head: "l1",
  amulet: "l2",
  chest: "l3",
  hands: "l4",
  belt: "l5",
  feet: "r1",
  ring_1: "r2",
  flask_1: "r3",
  flask_2: "r4",
  flask_3: "r5",
  flask_4: "r6",
  weapon: "weapon",
};

/** The central silhouette + framing gear slots. Built once; `render`
 *  updates each slot's icon/border/tooltip/drag-drop wiring in place
 *  so an in-progress drag or open tooltip is never reset mid-gesture
 *  (same concern the old flat list handled via `equipmentContentVersions`). */
function createPaperdollLayout(
  getCharacter: () => CharacterSummary | null,
  onUnequipItem?: (slot: EquipmentSlot) => Promise<void>,
  onEquipItem?: (characterId: string, itemInstanceId: string, slot: EquipmentSlot) => Promise<void>,
): PaperdollRefs {
  const root = document.createElement("div");
  root.style.display = "grid";
  root.style.gridTemplateColumns = "62px 96px 62px";
  root.style.gridTemplateRows = "60px 60px 60px 60px 60px 60px 60px";
  root.style.gridTemplateAreas = '"l1 portrait r1" "l2 portrait r2" "l3 portrait r3" "l4 portrait r4" "l5 portrait r5" ". weapon ." ". . r6"';
  root.style.gap = "6px";
  root.style.justifyContent = "center";
  root.style.margin = "0 auto";

  const portrait = createPaperdollPortrait();
  root.appendChild(portrait.root);

  const slotElements = new Map<EquipmentSlot, HTMLElement>();
  for (const slot of EQUIPMENT_SLOTS) {
    const slotEl = createPaperdollSlot(slot, onUnequipItem, onEquipItem, () => getCharacter()?.id);
    slotEl.style.gridArea = PAPERDOLL_GRID_AREAS[slot];
    slotElements.set(slot, slotEl);
    root.appendChild(slotEl);
  }

  const render = (
    loadout: EquipmentLoadout,
    inventoryItems: readonly InventorySummaryItem[],
    character: CharacterSummary | null,
  ): void => {
    portrait.render(character);
    const equippedItems = character?.equippedItems ?? [];
    for (const slot of EQUIPMENT_SLOTS) {
      const slotEl = slotElements.get(slot);
      if (slotEl !== undefined) {
        renderPaperdollSlotContent(slotEl, slot, loadout[slot], inventoryItems, equippedItems);
      }
    }
  };

  return { root, render };
}

interface PaperdollPortraitRefs {
  readonly root: HTMLElement;
  readonly render: (character: CharacterSummary | null) => void;
}

/** A class-tinted silhouette card centered inside the gear frame --
 *  cosmetic only (same "cheap differentiator, no new art" approach as
 *  `classTint.ts`'s placeholder tints), not a real character portrait. */
function createPaperdollPortrait(): PaperdollPortraitRefs {
  const root = document.createElement("div");
  root.style.gridArea = "portrait";
  root.style.gridRow = "1 / span 5";
  root.style.borderRadius = "10px";
  root.style.border = "1px solid #4d3f2a";
  root.style.display = "flex";
  root.style.alignItems = "center";
  root.style.justifyContent = "center";
  root.style.fontSize = "40px";
  root.style.boxShadow = "inset 0 0 16px rgba(0, 0, 0, 0.6)";

  const glyph = document.createElement("div");
  glyph.textContent = "\u{1F9CD}";
  root.appendChild(glyph);

  const render = (character: CharacterSummary | null): void => {
    const tint = resolvePlayerTint(character?.classKey);
    const torso = `#${tint.torsoColor.toString(16).padStart(6, "0")}`;
    const legs = `#${tint.legsColor.toString(16).padStart(6, "0")}`;
    root.style.background = `radial-gradient(circle at 50% 30%, ${torso}33 0%, ${legs}22 55%, rgba(14, 11, 8, 0.95) 100%)`;
  };

  return { root, render };
}

/** One empty-outline-or-equipped-icon paperdoll gear slot. Wires the
 *  same drag-drop/right-click-unequip/tooltip behavior the old flat
 *  list rows had, just rendered as a square icon tile instead of a
 *  label+value row. */
function createPaperdollSlot(
  slot: EquipmentSlot,
  onUnequipItem: ((slot: EquipmentSlot) => Promise<void>) | undefined,
  onEquipItem: ((characterId: string, itemInstanceId: string, slot: EquipmentSlot) => Promise<void>) | undefined,
  getCharacterId: () => string | undefined,
): HTMLElement {
  const slotEl = document.createElement("div");
  slotEl.style.position = "relative";
  slotEl.style.width = "100%";
  slotEl.style.height = "100%";
  slotEl.style.boxSizing = "border-box";
  slotEl.style.display = "flex";
  slotEl.style.alignItems = "center";
  slotEl.style.justifyContent = "center";
  slotEl.style.borderRadius = "8px";
  slotEl.title = t(SLOT_LABEL_KEYS[slot]);
  makeInteractive(slotEl);

  if (onEquipItem !== undefined) {
    makeEquipmentSlotDropZone(slotEl, slot, (itemInstanceId) => {
      const characterId = getCharacterId();
      if (characterId !== undefined) {
        void onEquipItem(characterId, itemInstanceId, slot);
      }
    });
  }

  if (onUnequipItem !== undefined) {
    slotEl.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (slotEl.dataset.equipped === "true") {
        void onUnequipItem(slot);
      }
    });
  }

  return slotEl;
}

function renderPaperdollSlotContent(
  slotEl: HTMLElement,
  slot: EquipmentSlot,
  itemId: string | null,
  inventoryItems: readonly InventorySummaryItem[],
  equippedItems: readonly EquippedItemSummary[],
): void {
  slotEl.replaceChildren();

  if (itemId === null) {
    slotEl.dataset.equipped = "false";
    slotEl.style.border = "1px dashed #4d3f2a";
    slotEl.style.background = "rgba(12, 10, 8, 0.5)";

    const emptyLabel = document.createElement("span");
    emptyLabel.textContent = t(SLOT_LABEL_KEYS[slot]).slice(0, 1);
    emptyLabel.style.color = "#4d3f2a";
    emptyLabel.style.fontSize = "16px";
    emptyLabel.style.fontWeight = "bold";
    slotEl.appendChild(emptyLabel);
    return;
  }

  slotEl.dataset.equipped = "true";
  const equippedItem = equippedItems.find((item) => item.itemInstanceId === itemId)
    ?? inventoryItems.find((item) => item.itemInstanceId === itemId)
    ?? null;

  const rarityColor = equippedItem === null ? COMMON_ITEM_COLOR : getItemRarityColor(equippedItem.rarity);
  slotEl.style.border = `2px solid ${rarityColor}`;
  slotEl.style.background = "rgba(18, 14, 10, 0.9)";
  slotEl.style.boxShadow = `0 0 8px ${rarityColor}55`;

  const iconUrl = equippedItem === null ? null : resolveItemIconUrl(equippedItem.definitionId);
  if (iconUrl !== null) {
    const icon = document.createElement("img");
    icon.src = iconUrl;
    icon.alt = "";
    icon.style.width = "70%";
    icon.style.height = "70%";
    icon.style.imageRendering = "pixelated";
    slotEl.appendChild(icon);
  } else {
    const fallback = document.createElement("span");
    fallback.textContent = "?";
    fallback.style.color = rarityColor;
    fallback.style.fontSize = "16px";
    slotEl.appendChild(fallback);
  }

  makeEquippedItemDraggable(slotEl, slot);
  if (equippedItem !== null) {
    attachEquippedItemTooltip(slotEl, equippedItem);
  }
}

interface AttributesTabRefs {
  readonly root: HTMLElement;
  readonly render: (character: CharacterSummary | null) => void;
}

/** Tab 2 -- the extended stat sheet. Only renders values the data
 *  model actually tracks (`CharacterStats.primary`/`derived`); Crit,
 *  Haste, Resistances and HP/MP regen have no server-side stat yet
 *  (see `packages/shared/src/character/StatTypes.ts`), so those rows
 *  show a "not tracked yet" placeholder instead of a fabricated number. */
function createAttributesTabContent(): AttributesTabRefs {
  const root = document.createElement("div");
  root.style.display = "grid";
  root.style.gridTemplateColumns = "1fr";
  root.style.gap = "4px";

  const render = (character: CharacterSummary | null): void => {
    root.replaceChildren();
    const stats = character?.stats;
    if (stats === undefined) {
      root.appendChild(createMutedText("Attributes unavailable."));
      return;
    }

    const notTracked = t("character_window.attributes.not_tracked");
    root.append(
      createStatRow(t("character_window.attributes.power"), String(stats.primary.power)),
      createStatRow(t("character_window.attributes.speed"), String(stats.primary.speed)),
      createStatRow(t("character_window.attributes.mind"), String(stats.primary.mind)),
      createStatRow(t("character_window.attributes.toughness"), String(stats.primary.toughness)),
      createStatRow(t("character_window.attributes.armor"), String(stats.derived.armor)),
      createStatRow(t("character_window.attributes.move_speed"), formatMoveSpeed(stats.derived.moveSpeed)),
      createStatRow(t("character_window.attributes.attack_speed"), `${Math.round(stats.derived.attackCooldownMs)} ms`),
      createStatRow(t("character_window.attributes.crit_chance"), notTracked, "#5f4a2f"),
      createStatRow(t("character_window.attributes.haste"), notTracked, "#5f4a2f"),
      createStatRow(t("character_window.attributes.resistances"), notTracked, "#5f4a2f"),
      createStatRow(t("character_window.attributes.hp_regen"), notTracked, "#5f4a2f"),
      createStatRow(t("character_window.attributes.mp_regen"), notTracked, "#5f4a2f"),
    );
  };

  return { root, render };
}

interface CurrenciesTabRefs {
  readonly root: HTMLElement;
  readonly render: (character: CharacterSummary | null) => void;
}

/** Tab 3 -- full wallet summary + Net Worth, one row per currency the
 *  Multi-Currency Wallet Engine tracks (`CURRENCY_IDS`). */
function createCurrenciesTabContent(): CurrenciesTabRefs {
  const root = document.createElement("div");
  root.style.display = "grid";
  root.style.gridTemplateColumns = "1fr";
  root.style.gap = "4px";

  const render = (character: CharacterSummary | null): void => {
    root.replaceChildren();
    if (character === null) {
      root.appendChild(createMutedText("Wallet unavailable."));
      return;
    }

    for (const currencyId of CURRENCY_IDS) {
      root.appendChild(createCurrencyRow(currencyId, character.wallet.balances[currencyId]));
    }

    const netWorthCzk = contentRegistry.currencies.get("czk");
    root.appendChild(createStatRow(
      t("character_window.currencies.net_worth"),
      `${(character.netWorth ?? 0).toLocaleString()} ${netWorthCzk?.symbol ?? "Kč"}`,
      "#e0c88a",
    ));
  };

  return { root, render };
}

function createCurrencyRow(currencyId: CurrencyId, balance: number): HTMLElement {
  const definition = contentRegistry.currencies.get(currencyId);
  const label = definition === undefined ? currencyId : t(definition.nameKey);
  const symbol = definition?.symbol ?? "";
  return createStatRow(label, `${balance.toLocaleString()} ${symbol}`.trim());
}

interface ReputationTabRefs {
  readonly root: HTMLElement;
}

/** Tab 4 -- placeholder. There is no faction-standing data model or
 *  server support yet (`grep`-confirmed: no `reputation`/`faction`
 *  system exists outside docs/lore), so this shows an explicit "not
 *  implemented yet" notice instead of fabricating regional standings. */
function createReputationTabContent(): ReputationTabRefs {
  const root = document.createElement("div");
  root.appendChild(createMutedText(t("character_window.reputation.empty")));
  return { root };
}

function createMutedText(text: string): HTMLElement {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.fontSize = "11px";
  el.style.color = "#5f4a2f";
  el.style.padding = "8px 2px";
  return el;
}

function formatMoveSpeed(moveSpeed: number): string {
  if (!Number.isFinite(moveSpeed)) {
    return "—";
  }
  return moveSpeed.toFixed(2);
}