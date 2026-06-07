/**
 * Task 200 — Basic Vendor Interaction Panel Placeholder
 * Task 204 — Basic Sell-Disabled Vendor Inventory Preview
 * Task 205 — Vendor Preview + Safe-Zone Services Batch
 *
 * Compact dismissible vendor panel showing vendor name, money line,
 * placeholder stock rows (item label + formatted price) and a disabled
 * Buy button per row. The "Trading locked for Core 0.1" note reflects
 * that no purchase flow exists yet.
 *
 * No buying, selling, stock persistence, stock mutation or reputation.
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
}

export interface VendorInteractionPanel {
  readonly show: () => void;
  readonly destroy: () => void;
}

export interface CreateVendorInteractionPanelOptions {
  readonly stockEntries?: readonly VendorStockEntryDefinition[];
}

export function createVendorInteractionPanel(
  vendorName: string,
  moneyCopper: number,
  options: CreateVendorInteractionPanelOptions = {},
): VendorInteractionPanel {
  let panelElement: HTMLDivElement | null = null;

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
      });
    }
    return rows;
  };

  const show = (): void => {
    hideExisting();

    const backdrop = document.createElement("div");
    backdrop.style.cssText = `
      position: fixed; inset: 0; z-index: 20000;
      background: rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
    `;

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
    const moneyLine = document.createElement("div");
    moneyLine.textContent = `Money: ${formatMoneyCompact(moneyCopper)}`;
    moneyLine.style.cssText = `
      color: #b9d49a; font-size: 12px; font-family: monospace;
    `;
    card.appendChild(moneyLine);

    // Stock preview
    const stockRows = resolveStockRows();
    const stockHeader = document.createElement("div");
    stockHeader.textContent = "Stock (preview)";
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
        card.appendChild(createStockRow(row));
      }
    }

    // Task 205 — Clear "Trading locked for Core 0.1" note replaces the
    // previous generic "Trading is not available yet." copy.
    const note = document.createElement("div");
    note.textContent = t("town_service.vendor_panel.trading_locked");
    note.style.cssText = `
      color: #c8a86b; font-size: 12px; font-weight: bold;
      text-align: center; padding: 6px 8px;
      border: 1px solid #5f4a2f; border-radius: 6px;
      background: rgba(60, 40, 20, 0.45);
    `;
    card.appendChild(note);

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

  return { show, destroy };
}

function createStockRow(row: VendorStockRowView): HTMLElement {
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

  const buyBtn = document.createElement("button");
  buyBtn.textContent = "Buy";
  buyBtn.disabled = true;
  buyBtn.title = "Unavailable";
  buyBtn.style.cssText = `
    padding: 4px 10px; font-size: 11px;
    background: #2a2218; border: 1px solid #4d3f2a; border-radius: 5px;
    color: #7a6a4f; cursor: not-allowed; opacity: 0.7;
  `;
  rowEl.appendChild(buyBtn);

  return rowEl;
}
