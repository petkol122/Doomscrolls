/**
 * Task 200 — Basic Vendor Interaction Panel Placeholder
 * Task 204 — Basic Sell-Disabled Vendor Inventory Preview
 * Task 205 — Vendor Preview + Safe-Zone Services Batch
 * Task 319 — Vendor Foundation: Server-Authoritative Buy Item
 * Task 320 — Vendor Foundation: Server-Authoritative Sell Item
 * Core 0.1 — Vendor & Economy UI: hover tooltips on stock/sell rows
 * Milestone 0.3 — Pawn Shop / Army Surplus Vendor: Salvage & Tech
 * Teardown and Training & Licenses tabs
 *
 * Compact dismissible vendor panel with three tabs:
 * - Buy & Sell: stock rows (Buy) + inventory rows (Sell), same as before.
 * - Salvage & Tech Teardown: inventory rows with a Salvage button that
 *   breaks gear down into crafting materials.
 * - Training & Licenses: Life Skill professions the player can unlock
 *   or rank up by spending CZK.
 *
 * All three actions are server-authoritative: the client only sends an
 * intent (stock entry id / item instance id / profession id); the
 * server decides price, material and outcome. The panel never mutates
 * displayed money/inventory/professions directly -- `updateMoney`/
 * `updateInventory`/`updateProfessions` are only called from the caller
 * once the server's accept/reject response comes back.
 */
import { contentRegistry, type VendorStockEntryDefinition } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";
import { formatMoneyCompact } from "@doomscrolls/shared";
import type { ItemDefinitionId } from "@doomscrolls/shared";
import { attachEquippedItemTooltip, hideItemTooltip } from "./worldSessionItemTooltipView";
import { bringWindowToFront, makeWindowDraggable } from "./draggableWindow";

export interface VendorStockRowView {
  readonly stockEntryId: string;
  readonly itemId: ItemDefinitionId;
  readonly itemLabel: string;
  readonly priceLabel: string;
  readonly priceCopper: number;
}

export interface InventoryItemView {
  readonly itemInstanceId: string;
  readonly definitionId: string;
  readonly itemLabel: string;
  readonly sellPriceLabel: string;
  readonly sellPriceCopper: number;
}

export interface ProfessionTrainingView {
  readonly professionId: string;
  readonly label: string;
  readonly currentTier: number;
  /** Absent = no further tier is trainable (either maxed out or not trainable yet). */
  readonly nextTierCostCopper?: number;
}

export interface VendorInteractionPanel {
  readonly show: () => void;
  readonly destroy: () => void;
  readonly updateMoney: (newMoneyCopper: number) => void;
  readonly showFeedback: (message: string) => void;
  readonly updateInventory: (items: readonly InventoryItemView[]) => void;
  readonly updateProfessions: (professions: readonly ProfessionTrainingView[]) => void;
}

export interface CreateVendorInteractionPanelOptions {
  readonly stockEntries?: readonly VendorStockEntryDefinition[];
  readonly inventoryItems?: readonly InventoryItemView[];
  readonly professions?: readonly ProfessionTrainingView[];
  readonly onBuy?: (vendorId: string, stockEntryId: string) => void;
  readonly onSell?: (vendorId: string, itemInstanceId: string) => void;
  readonly onSalvage?: (vendorId: string, itemInstanceId: string) => void;
  readonly onTrainProfession?: (vendorId: string, professionId: string) => void;
}

type VendorTabId = "buy_sell" | "salvage" | "training";

export function createVendorInteractionPanel(
  vendorName: string,
  moneyCopper: number,
  vendorId: string,
  options: CreateVendorInteractionPanelOptions = {},
): VendorInteractionPanel {
  let panelElement: HTMLDivElement | null = null;
  let moneyLineEl: HTMLDivElement | null = null;
  let feedbackEl: HTMLDivElement | null = null;
  let scrollAreaEl: HTMLDivElement | null = null;
  let sellSectionEl: HTMLDivElement | null = null;
  let salvageSectionEl: HTMLDivElement | null = null;
  let trainingSectionEl: HTMLDivElement | null = null;
  let activeTab: VendorTabId = "buy_sell";
  const tabButtons = new Map<VendorTabId, HTMLButtonElement>();
  const tabPanels = new Map<VendorTabId, HTMLDivElement>();
  let currentMoney = moneyCopper;
  let currentInventory: readonly InventoryItemView[] = options.inventoryItems ?? [];
  let currentProfessions: readonly ProfessionTrainingView[] = options.professions ?? [];

  const resolveStockRows = (): VendorStockRowView[] => {
    const entries = options.stockEntries ?? contentRegistry.vendorStocks.all;
    const rows: VendorStockRowView[] = [];
    for (const entry of entries) {
      const item = contentRegistry.items.get(entry.itemId);
      if (item === undefined) {
        continue;
      }
      rows.push({
        stockEntryId: entry.id,
        itemId: entry.itemId,
        itemLabel: t(item.nameKey as never),
        priceLabel: formatMoneyCompact(entry.priceCopper),
        priceCopper: entry.priceCopper,
      });
    }
    return rows;
  };

  const setActiveTab = (tab: VendorTabId): void => {
    activeTab = tab;
    for (const [id, panel] of tabPanels) {
      panel.hidden = id !== tab;
    }
    for (const [id, button] of tabButtons) {
      button.style.borderBottom = id === tab ? "2px solid #b9d49a" : "2px solid transparent";
      button.style.color = id === tab ? "#f0ddbb" : "#a88d63";
    }
  };

  const buildTabBar = (): HTMLDivElement => {
    const bar = document.createElement("div");
    bar.style.cssText = "display: flex; gap: 4px; border-bottom: 1px solid #3c3122;";

    const tabs: { readonly id: VendorTabId; readonly labelKey: string }[] = [
      { id: "buy_sell", labelKey: "town_service.vendor_panel.tab_buy_sell" },
      { id: "salvage", labelKey: "town_service.vendor_panel.tab_salvage" },
      { id: "training", labelKey: "town_service.vendor_panel.tab_training" },
    ];

    for (const tab of tabs) {
      const button = document.createElement("button");
      button.textContent = t(tab.labelKey as never);
      button.style.cssText = `
        flex: 1; padding: 6px 4px; font-size: 11px; background: none;
        border: none; cursor: pointer; white-space: nowrap;
      `;
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        setActiveTab(tab.id);
      });
      tabButtons.set(tab.id, button);
      bar.appendChild(button);
    }

    return bar;
  };

  const buildSellSection = (): HTMLDivElement => {
    const section = document.createElement("div");
    section.style.cssText = "display: grid; gap: 6px;";

    const stockRows = resolveStockRows();
    const stockHeader = document.createElement("div");
    stockHeader.textContent = "Stock";
    stockHeader.style.cssText = `
      color: #a88d63; font-size: 11px; font-weight: bold;
      text-transform: uppercase; letter-spacing: 0.04em;
    `;
    section.appendChild(stockHeader);

    if (stockRows.length === 0) {
      const emptyLine = document.createElement("div");
      emptyLine.textContent = "No stock entries.";
      emptyLine.style.cssText = `color: #7a6a4f; font-size: 12px; font-style: italic;`;
      section.appendChild(emptyLine);
    } else {
      for (const row of stockRows) {
        section.appendChild(createStockRow(row, currentMoney, options.onBuy, vendorId));
      }
    }

    const sep = document.createElement("div");
    sep.style.cssText = "height: 1px; background: #3c3122;";
    section.appendChild(sep);

    const header = document.createElement("div");
    header.textContent = t("town_service.vendor_panel.sell_header" as never);
    header.style.cssText = `
      color: #a88d63; font-size: 11px; font-weight: bold;
      text-transform: uppercase; letter-spacing: 0.04em;
    `;
    section.appendChild(header);

    if (currentInventory.length === 0) {
      const emptyLine = document.createElement("div");
      emptyLine.textContent = t("town_service.vendor_panel.sell_empty" as never);
      emptyLine.style.cssText = `color: #7a6a4f; font-size: 12px; font-style: italic;`;
      section.appendChild(emptyLine);
    } else {
      for (const item of currentInventory) {
        section.appendChild(createSellRow(item, options.onSell, vendorId));
      }
    }
    return section;
  };

  const buildSalvageSection = (): HTMLDivElement => {
    const section = document.createElement("div");
    section.style.cssText = "display: grid; gap: 6px;";

    const header = document.createElement("div");
    header.textContent = t("town_service.vendor_panel.salvage_header" as never);
    header.style.cssText = `
      color: #a88d63; font-size: 11px; font-weight: bold;
      text-transform: uppercase; letter-spacing: 0.04em;
    `;
    section.appendChild(header);

    if (currentInventory.length === 0) {
      const emptyLine = document.createElement("div");
      emptyLine.textContent = t("town_service.vendor_panel.salvage_empty" as never);
      emptyLine.style.cssText = `color: #7a6a4f; font-size: 12px; font-style: italic;`;
      section.appendChild(emptyLine);
    } else {
      for (const item of currentInventory) {
        section.appendChild(createSalvageRow(item, options.onSalvage, vendorId));
      }
    }
    return section;
  };

  const buildTrainingSection = (): HTMLDivElement => {
    const section = document.createElement("div");
    section.style.cssText = "display: grid; gap: 6px;";

    const header = document.createElement("div");
    header.textContent = t("town_service.vendor_panel.training_header" as never);
    header.style.cssText = `
      color: #a88d63; font-size: 11px; font-weight: bold;
      text-transform: uppercase; letter-spacing: 0.04em;
    `;
    section.appendChild(header);

    if (currentProfessions.length === 0) {
      const emptyLine = document.createElement("div");
      emptyLine.textContent = t("town_service.vendor_panel.salvage_empty" as never);
      emptyLine.style.cssText = `color: #7a6a4f; font-size: 12px; font-style: italic;`;
      section.appendChild(emptyLine);
    } else {
      for (const profession of currentProfessions) {
        section.appendChild(createTrainingRow(profession, currentMoney, options.onTrainProfession, vendorId));
      }
    }
    return section;
  };

  const show = (): void => {
    hideExisting();

    const backdrop = document.createElement("div");
    backdrop.style.cssText = `
      position: fixed; inset: 0; z-index: 20000;
      background: rgba(0,0,0,0.4);
    `;
    const stopWorldInput = (event: Event): void => {
      event.stopPropagation();
      if (event.cancelable) {
        event.preventDefault();
      }
    };
    backdrop.addEventListener("pointerdown", stopWorldInput, { capture: true });
    backdrop.addEventListener("mousedown", stopWorldInput, { capture: true });
    backdrop.addEventListener("contextmenu", stopWorldInput, { capture: true });

    const card = document.createElement("div");
    // Core 0.1 UI Overhaul Phase 2 -- draggable + focusable like every
    // other modal window, so it doesn't get stuck under an open
    // Inventory/Character window. Centered via fixed left/top (not the
    // backdrop's old flex-centering) since draggableWindow.ts repositions
    // `card` itself, not its parent.
    card.style.cssText = `
      position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
      background: #1a1510; border: 1px solid #5f4a2f; border-radius: 10px;
      padding: 20px 24px; min-width: 320px; max-width: 420px; max-height: 80vh;
      box-shadow: 0 6px 20px rgba(0,0,0,0.7);
      display: grid; grid-template-rows: auto auto auto auto minmax(0, 1fr) auto auto; gap: 12px;
    `;

    // Vendor name -- also the drag handle.
    const nameLine = document.createElement("div");
    nameLine.textContent = vendorName;
    nameLine.style.cssText = `
      color: #f0ddbb; font-size: 16px; font-weight: bold;
    `;
    card.appendChild(nameLine);
    makeWindowDraggable(card, nameLine);

    // Separator
    const sep = document.createElement("div");
    sep.style.cssText = "height: 1px; background: #3c3122;";
    card.appendChild(sep);

    // Money line
    moneyLineEl = document.createElement("div");
    moneyLineEl.textContent = `Money: ${formatMoneyCompact(currentMoney)}`;
    moneyLineEl.style.cssText = `
      color: #b9d49a; font-size: 12px; font-family: monospace;
    `;
    card.appendChild(moneyLineEl);

    // Tabs
    tabButtons.clear();
    tabPanels.clear();
    card.appendChild(buildTabBar());

    // Scrollable area for the active tab's rows. A vendor's stock/sell/
    // salvage/training lists can run well past the viewport height (e.g.
    // a full inventory of salvage materials) -- without this the card
    // itself grows past 80vh and its own Close button falls off-screen.
    scrollAreaEl = document.createElement("div");
    scrollAreaEl.style.cssText = "overflow-y: auto; min-height: 0; display: grid; gap: 12px;";
    card.appendChild(scrollAreaEl);

    sellSectionEl = buildSellSection();
    tabPanels.set("buy_sell", sellSectionEl);
    scrollAreaEl.appendChild(sellSectionEl);

    salvageSectionEl = buildSalvageSection();
    tabPanels.set("salvage", salvageSectionEl);
    scrollAreaEl.appendChild(salvageSectionEl);

    trainingSectionEl = buildTrainingSection();
    tabPanels.set("training", trainingSectionEl);
    scrollAreaEl.appendChild(trainingSectionEl);

    setActiveTab(activeTab);

    // Feedback line (hidden by default)
    feedbackEl = document.createElement("div");
    feedbackEl.style.cssText = `
      display: none; color: #e8c36a; font-size: 12px;
      text-align: center; padding: 4px 8px;
      border: 1px solid #5f4a2f; border-radius: 6px;
      background: rgba(60, 40, 20, 0.45);
    `;
    card.appendChild(feedbackEl);

    // Dismiss button
    const dismissBtn = document.createElement("button");
    dismissBtn.textContent = "Close";
    dismissBtn.style.cssText = `
      margin-top: 4px; padding: 6px 14px; font-size: 12px;
      background: #2a2218; border: 1px solid #4d3f2a; border-radius: 6px;
      color: #d8c6a3; cursor: pointer; justify-self: end;
    `;
    dismissBtn.addEventListener("click", () => {
      hideItemTooltip();
      backdrop.remove();
      panelElement = null;
    });
    card.appendChild(dismissBtn);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    panelElement = backdrop;
    // `backdrop`, not `card`, is the actual sibling competing for
    // z-order against other top-level windows (Inventory/Character/Skill
    // Tree) -- `card`'s own z-index (bumped on drag by
    // `makeWindowDraggable`) is scoped inside `backdrop`'s stacking
    // context and can't escape it.
    bringWindowToFront(backdrop);

    // Click-anywhere-else dismiss
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        hideItemTooltip();
        backdrop.remove();
        panelElement = null;
      }
    });
  };

  const hideExisting = (): void => {
    if (panelElement !== null) {
      hideItemTooltip();
      panelElement.remove();
      panelElement = null;
    }
  };

  const destroy = (): void => {
    hideExisting();
  };

  const updateMoney = (newMoneyCopper: number): void => {
    currentMoney = newMoneyCopper;
    if (moneyLineEl !== null) {
      moneyLineEl.textContent = `Money: ${formatMoneyCompact(currentMoney)}`;
    }
    // Buy/train affordability and the training tab's cost display both
    // depend on current money -- rebuild them so a Buy/Train button's
    // enabled state stays in sync after a purchase.
    if (sellSectionEl !== null) {
      const parent = sellSectionEl.parentElement;
      if (parent !== null) {
        const newSection = buildSellSection();
        parent.replaceChild(newSection, sellSectionEl);
        sellSectionEl = newSection;
        tabPanels.set("buy_sell", newSection);
      }
    }
    if (trainingSectionEl !== null) {
      const parent = trainingSectionEl.parentElement;
      if (parent !== null) {
        const newSection = buildTrainingSection();
        parent.replaceChild(newSection, trainingSectionEl);
        trainingSectionEl = newSection;
        tabPanels.set("training", newSection);
      }
    }
    setActiveTab(activeTab);
  };

  const showFeedback = (message: string): void => {
    if (feedbackEl !== null) {
      feedbackEl.textContent = message;
      feedbackEl.style.display = "block";
    }
  };

  const updateInventory = (items: readonly InventoryItemView[]): void => {
    currentInventory = items;
    if (sellSectionEl !== null) {
      const parent = sellSectionEl.parentElement;
      if (parent !== null) {
        const newSection = buildSellSection();
        parent.replaceChild(newSection, sellSectionEl);
        sellSectionEl = newSection;
        tabPanels.set("buy_sell", newSection);
      }
    }
    if (salvageSectionEl !== null) {
      const parent = salvageSectionEl.parentElement;
      if (parent !== null) {
        const newSection = buildSalvageSection();
        parent.replaceChild(newSection, salvageSectionEl);
        salvageSectionEl = newSection;
        tabPanels.set("salvage", newSection);
      }
    }
    setActiveTab(activeTab);
  };

  const updateProfessions = (professions: readonly ProfessionTrainingView[]): void => {
    currentProfessions = professions;
    if (trainingSectionEl !== null) {
      const parent = trainingSectionEl.parentElement;
      if (parent !== null) {
        const newSection = buildTrainingSection();
        parent.replaceChild(newSection, trainingSectionEl);
        trainingSectionEl = newSection;
        tabPanels.set("training", newSection);
      }
    }
    setActiveTab(activeTab);
  };

  return { show, destroy, updateMoney, showFeedback, updateInventory, updateProfessions };
}

function createStockRow(
  row: VendorStockRowView,
  playerMoney: number,
  onBuy: ((vendorId: string, stockEntryId: string) => void) | undefined,
  vendorId: string,
): HTMLElement {
  const rowEl = document.createElement("div");
  rowEl.style.cssText = `
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    background: rgba(24, 18, 13, 0.7);
    border: 1px solid #3c3122;
    border-radius: 6px;
  `;

  const itemDef = contentRegistry.items.get(row.itemId);
  const itemLabel = document.createElement("div");
  itemLabel.textContent = row.itemLabel;
  itemLabel.style.cssText = `
    color: #d8c6a3; font-size: 12px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  `;
  if (itemDef !== undefined) {
    attachEquippedItemTooltip(itemLabel, {
      label: row.itemLabel,
      rarity: itemDef.rarity,
      statModifiers: itemDef.statModifiers,
    });
  }
  rowEl.appendChild(itemLabel);

  const priceLabel = document.createElement("div");
  priceLabel.textContent = row.priceLabel;
  priceLabel.style.cssText = `
    color: #b9d49a; font-size: 12px; font-family: monospace;
  `;
  rowEl.appendChild(priceLabel);

  const canAfford = playerMoney >= row.priceCopper;
  const buyBtn = document.createElement("button");
  buyBtn.textContent = "Buy";
  buyBtn.disabled = !canAfford || onBuy === undefined;
  buyBtn.title = !canAfford ? "Not enough copper" : "Buy item";
  buyBtn.style.cssText = `
    padding: 4px 10px; font-size: 11px;
    background: ${canAfford && onBuy !== undefined ? "#2a3a18" : "#2a2218"};
    border: 1px solid ${canAfford && onBuy !== undefined ? "#4d6a2a" : "#4d3f2a"};
    border-radius: 5px;
    color: ${canAfford && onBuy !== undefined ? "#b9d49a" : "#7a6a4f"};
    cursor: ${canAfford && onBuy !== undefined ? "pointer" : "not-allowed"};
    opacity: ${canAfford && onBuy !== undefined ? 1 : 0.7};
  `;

  if (canAfford && onBuy !== undefined) {
    buyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onBuy(vendorId, row.stockEntryId);
    });
  }

  rowEl.appendChild(buyBtn);

  return rowEl;
}

function createSellRow(
  item: InventoryItemView,
  onSell: ((vendorId: string, itemInstanceId: string) => void) | undefined,
  vendorId: string,
): HTMLElement {
  const rowEl = document.createElement("div");
  rowEl.style.cssText = `
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    background: rgba(24, 18, 13, 0.7);
    border: 1px solid #3c3122;
    border-radius: 6px;
  `;

  const itemDef = contentRegistry.items.get(item.definitionId as never);
  const itemLabel = document.createElement("div");
  itemLabel.textContent = item.itemLabel;
  itemLabel.style.cssText = `
    color: #d8c6a3; font-size: 12px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  `;
  if (itemDef !== undefined) {
    attachEquippedItemTooltip(itemLabel, {
      label: item.itemLabel,
      rarity: itemDef.rarity,
      statModifiers: itemDef.statModifiers,
    });
  }
  rowEl.appendChild(itemLabel);

  const priceLabel = document.createElement("div");
  priceLabel.textContent = item.sellPriceLabel;
  priceLabel.style.cssText = `
    color: #b9d49a; font-size: 12px; font-family: monospace;
  `;
  rowEl.appendChild(priceLabel);

  const sellBtn = document.createElement("button");
  sellBtn.textContent = "Sell";
  sellBtn.title = "Sell item";
  sellBtn.style.cssText = `
    padding: 4px 10px; font-size: 11px;
    background: #2a1a18; border: 1px solid #6a3a2a; border-radius: 5px;
    color: #d4a49a; cursor: pointer;
  `;
  if (onSell !== undefined) {
    sellBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onSell(vendorId, item.itemInstanceId);
    });
  }
  rowEl.appendChild(sellBtn);

  return rowEl;
}

function createSalvageRow(
  item: InventoryItemView,
  onSalvage: ((vendorId: string, itemInstanceId: string) => void) | undefined,
  vendorId: string,
): HTMLElement {
  const rowEl = document.createElement("div");
  rowEl.style.cssText = `
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    background: rgba(24, 18, 13, 0.7);
    border: 1px solid #3c3122;
    border-radius: 6px;
  `;

  const itemDef = contentRegistry.items.get(item.definitionId as never);
  const itemLabel = document.createElement("div");
  itemLabel.textContent = item.itemLabel;
  itemLabel.style.cssText = `
    color: #d8c6a3; font-size: 12px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  `;
  if (itemDef !== undefined) {
    attachEquippedItemTooltip(itemLabel, {
      label: item.itemLabel,
      rarity: itemDef.rarity,
      statModifiers: itemDef.statModifiers,
    });
  }
  rowEl.appendChild(itemLabel);

  const salvageBtn = document.createElement("button");
  salvageBtn.textContent = t("town_service.vendor_panel.salvage_action" as never);
  salvageBtn.title = t("town_service.vendor_panel.salvage_action" as never);
  salvageBtn.style.cssText = `
    padding: 4px 10px; font-size: 11px;
    background: #2a2418; border: 1px solid #6a5a2a; border-radius: 5px;
    color: #d4c49a; cursor: pointer;
  `;
  if (onSalvage !== undefined) {
    salvageBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onSalvage(vendorId, item.itemInstanceId);
    });
  }
  rowEl.appendChild(salvageBtn);

  return rowEl;
}

function createTrainingRow(
  profession: ProfessionTrainingView,
  playerMoney: number,
  onTrainProfession: ((vendorId: string, professionId: string) => void) | undefined,
  vendorId: string,
): HTMLElement {
  const rowEl = document.createElement("div");
  rowEl.style.cssText = `
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    background: rgba(24, 18, 13, 0.7);
    border: 1px solid #3c3122;
    border-radius: 6px;
  `;

  const labelEl = document.createElement("div");
  labelEl.textContent = profession.currentTier > 0
    ? `${profession.label} (Tier ${profession.currentTier})`
    : profession.label;
  labelEl.style.cssText = `
    color: #d8c6a3; font-size: 12px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  `;
  rowEl.appendChild(labelEl);

  const statusLabel = document.createElement("div");
  statusLabel.style.cssText = `color: #b9d49a; font-size: 12px; font-family: monospace;`;
  statusLabel.textContent = profession.nextTierCostCopper !== undefined
    ? formatMoneyCompact(profession.nextTierCostCopper)
    : t("town_service.vendor_panel.training_not_trainable" as never);
  rowEl.appendChild(statusLabel);

  const canAfford = profession.nextTierCostCopper !== undefined && playerMoney >= profession.nextTierCostCopper;
  const trainBtn = document.createElement("button");
  trainBtn.textContent = t("town_service.vendor_panel.training_action" as never);
  trainBtn.disabled = !canAfford || onTrainProfession === undefined;
  trainBtn.title = profession.nextTierCostCopper === undefined
    ? "Not trainable"
    : !canAfford
      ? "Not enough copper"
      : "Train";
  const enabled = canAfford && onTrainProfession !== undefined;
  trainBtn.style.cssText = `
    padding: 4px 10px; font-size: 11px;
    background: ${enabled ? "#2a3a18" : "#2a2218"};
    border: 1px solid ${enabled ? "#4d6a2a" : "#4d3f2a"};
    border-radius: 5px;
    color: ${enabled ? "#b9d49a" : "#7a6a4f"};
    cursor: ${enabled ? "pointer" : "not-allowed"};
    opacity: ${enabled ? 1 : 0.7};
  `;
  if (enabled) {
    trainBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onTrainProfession(vendorId, profession.professionId);
    });
  }
  rowEl.appendChild(trainBtn);

  return rowEl;
}
