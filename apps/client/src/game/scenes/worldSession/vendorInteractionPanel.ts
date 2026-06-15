/**
 * Task 200 — Basic Vendor Interaction Panel Placeholder
 * Task 204 — Basic Sell-Disabled Vendor Inventory Preview
 * Task 205 — Vendor Preview + Safe-Zone Services Batch
 * Task 319 — Vendor Foundation: Server-Authoritative Buy Item
 * Task 320 — Vendor Foundation: Server-Authoritative Sell Item
 *
 * Compact dismissible vendor panel showing vendor name, money line,
 * stock rows (item label + formatted price) and a Buy button per row.
 * Buy is server-authoritative: the client sends the stock entry id
 * to the server and the server decides the outcome.
 *
 * Sell section shows inventory items with a Sell button. Sell is
 * server-authoritative: the client sends the item instance id and
 * vendor id; the server validates and calculates the sell price.
 */
import { contentRegistry, type VendorStockEntryDefinition } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";
import { formatMoneyCompact } from "@doomscrolls/shared";
import type { ItemDefinitionId } from "@doomscrolls/shared";

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

export interface VendorInteractionPanel {
  readonly show: () => void;
  readonly destroy: () => void;
  readonly updateMoney: (newMoneyCopper: number) => void;
  readonly showFeedback: (message: string) => void;
  readonly updateInventory: (items: readonly InventoryItemView[]) => void;
}

export interface CreateVendorInteractionPanelOptions {
  readonly stockEntries?: readonly VendorStockEntryDefinition[];
  readonly inventoryItems?: readonly InventoryItemView[];
  readonly onBuy?: (vendorId: string, stockEntryId: string) => void;
  readonly onSell?: (vendorId: string, itemInstanceId: string) => void;
}

export function createVendorInteractionPanel(
  vendorName: string,
  moneyCopper: number,
  vendorId: string,
  options: CreateVendorInteractionPanelOptions = {},
): VendorInteractionPanel {
  let panelElement: HTMLDivElement | null = null;
  let moneyLineEl: HTMLDivElement | null = null;
  let feedbackEl: HTMLDivElement | null = null;
  let sellSectionEl: HTMLDivElement | null = null;
  let currentMoney = moneyCopper;
  let currentInventory: readonly InventoryItemView[] = options.inventoryItems ?? [];

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

  const buildSellSection = (): HTMLDivElement => {
    const section = document.createElement("div");
    section.style.cssText = "display: grid; gap: 6px;";

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
      emptyLine.style.cssText = `
        color: #7a6a4f; font-size: 12px; font-style: italic;
      `;
      section.appendChild(emptyLine);
    } else {
      for (const item of currentInventory) {
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

        const itemLabel = document.createElement("div");
        itemLabel.textContent = item.itemLabel;
        itemLabel.style.cssText = `
          color: #d8c6a3; font-size: 12px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        `;
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
        const onSell = options.onSell;
        if (onSell !== undefined) {
          sellBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            onSell(vendorId, item.itemInstanceId);
          });
        }
        rowEl.appendChild(sellBtn);
        section.appendChild(rowEl);
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
      display: flex; align-items: center; justify-content: center;
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
    card.style.cssText = `
      background: #1a1510; border: 1px solid #5f4a2f; border-radius: 10px;
      padding: 20px 24px; min-width: 320px; max-width: 420px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.7);
      display: grid; gap: 12px;
    `;

    // Vendor name
    const nameLine = document.createElement("div");
    nameLine.textContent = vendorName;
    nameLine.style.cssText = `
      color: #f0ddbb; font-size: 16px; font-weight: bold;
    `;
    card.appendChild(nameLine);

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

    // Stock header
    const stockRows = resolveStockRows();
    const stockHeader = document.createElement("div");
    stockHeader.textContent = "Stock";
    stockHeader.style.cssText = `
      color: #a88d63; font-size: 11px; font-weight: bold;
      text-transform: uppercase; letter-spacing: 0.04em;
    `;
    card.appendChild(stockHeader);

    if (stockRows.length === 0) {
      const emptyLine = document.createElement("div");
      emptyLine.textContent = "No stock entries.";
      emptyLine.style.cssText = `
        color: #7a6a4f; font-size: 12px; font-style: italic;
      `;
      card.appendChild(emptyLine);
    } else {
      for (const row of stockRows) {
        card.appendChild(createStockRow(row, currentMoney, options.onBuy, vendorId));
      }
    }

    // Sell section separator
    const sellSep = document.createElement("div");
    sellSep.style.cssText = "height: 1px; background: #3c3122;";
    card.appendChild(sellSep);

    // Sell section
    sellSectionEl = buildSellSection();
    card.appendChild(sellSectionEl);

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
      backdrop.remove();
      panelElement = null;
    });
    card.appendChild(dismissBtn);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    panelElement = backdrop;

    // Click-anywhere-else dismiss
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        backdrop.remove();
        panelElement = null;
      }
    });
  };

  const hideExisting = (): void => {
    if (panelElement !== null) {
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
      }
    }
  };

  return { show, destroy, updateMoney, showFeedback, updateInventory };
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

  const itemLabel = document.createElement("div");
  itemLabel.textContent = row.itemLabel;
  itemLabel.style.cssText = `
    color: #d8c6a3; font-size: 12px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  `;
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