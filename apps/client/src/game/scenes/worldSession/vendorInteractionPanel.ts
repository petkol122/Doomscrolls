/**
 * Task 200 — Basic Vendor Interaction Panel Placeholder
 *
 * Compact dismissible vendor panel showing vendor name, a placeholder message,
 * and the current money from the account state.
 *
 * No buying, selling, stock, prices, reputation or dialogue tree.
 */
import { formatMoneyCompact } from "@doomscrolls/shared";

export interface VendorInteractionPanel {
  readonly show: () => void;
  readonly destroy: () => void;
}

export function createVendorInteractionPanel(
  vendorName: string,
  moneyCopper: number,
): VendorInteractionPanel {
  let panelElement: HTMLDivElement | null = null;

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
      padding: 20px 24px; min-width: 260px; max-width: 340px;
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

    // Placeholder message
    const msg = document.createElement("div");
    msg.textContent = "Trading is not available yet.";
    msg.style.cssText = `
      color: #a88d63; font-size: 13px; font-style: italic;
    `;
    card.appendChild(msg);

    // Money line
    const moneyLine = document.createElement("div");
    moneyLine.textContent = `Money: ${formatMoneyCompact(moneyCopper)}`;
    moneyLine.style.cssText = `
      color: #b9d49a; font-size: 12px; font-family: monospace;
    `;
    card.appendChild(moneyLine);

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