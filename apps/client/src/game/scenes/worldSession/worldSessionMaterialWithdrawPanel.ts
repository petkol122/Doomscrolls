/**
 * Salvage-material currency (Iron Scrap / Arcane Dust) is a plain HUD
 * counter, not an inventory item -- picking it up (via salvaging gear)
 * never occupies a slot. Right-clicking its HUD readout opens this
 * transient quantity picker so a player can withdraw a chosen amount
 * back into a physical, tradeable inventory item stack (e.g. to trade
 * or drop). The server is the sole authority on whether the balance/
 * inventory space allow it -- this panel only sends the requested
 * quantity.
 */
import { t } from "@doomscrolls/localization";

export interface MaterialWithdrawPanelOptions {
  readonly materialLabel: string;
  readonly currentBalance: number;
  readonly onConfirm: (quantity: number) => void;
}

const MAX_STACK_SIZE = 99;

export function showMaterialWithdrawPanel(options: MaterialWithdrawPanelOptions): void {
  const maxQuantity = Math.max(1, Math.min(options.currentBalance, MAX_STACK_SIZE));
  let quantity = maxQuantity > 0 ? 1 : 0;

  const backdrop = document.createElement("div");
  backdrop.style.cssText = `
    position: fixed; inset: 0; z-index: 20001;
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
    padding: 18px 20px; min-width: 260px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.7);
    display: grid; gap: 10px;
  `;

  const titleLine = document.createElement("div");
  titleLine.textContent = t("town_service.material_withdraw.title" as never, { materialLabel: options.materialLabel });
  titleLine.style.cssText = "color: #f0ddbb; font-size: 14px; font-weight: bold;";
  card.appendChild(titleLine);

  const balanceLine = document.createElement("div");
  balanceLine.textContent = t("town_service.material_withdraw.balance" as never, { balance: options.currentBalance });
  balanceLine.style.cssText = "color: #a88d63; font-size: 11px;";
  card.appendChild(balanceLine);

  const stepperRow = document.createElement("div");
  stepperRow.style.cssText = "display: flex; align-items: center; gap: 8px; justify-content: center;";

  const stepperButtonStyle = `
    width: 28px; height: 28px; font-size: 14px; font-weight: bold;
    background: #2a2218; border: 1px solid #4d3f2a; border-radius: 5px;
    color: #d8c6a3; cursor: pointer;
  `;

  const decrementBtn = document.createElement("button");
  decrementBtn.textContent = "-";
  decrementBtn.style.cssText = stepperButtonStyle;
  stepperRow.appendChild(decrementBtn);

  const quantityInput = document.createElement("input");
  quantityInput.type = "number";
  quantityInput.min = "1";
  quantityInput.max = String(maxQuantity);
  quantityInput.value = String(quantity);
  quantityInput.style.cssText = `
    width: 60px; text-align: center; font-size: 13px; font-family: monospace;
    background: #10181a; border: 1px solid #4d3f2a; border-radius: 5px;
    color: #d8c6a3; padding: 4px;
  `;
  stepperRow.appendChild(quantityInput);

  const incrementBtn = document.createElement("button");
  incrementBtn.textContent = "+";
  incrementBtn.style.cssText = stepperButtonStyle;
  stepperRow.appendChild(incrementBtn);

  card.appendChild(stepperRow);

  const confirmBtn = document.createElement("button");

  const clampQuantity = (next: number): number => Math.max(1, Math.min(maxQuantity, Math.floor(next) || 1));

  const setQuantity = (next: number): void => {
    quantity = clampQuantity(next);
    quantityInput.value = String(quantity);
    confirmBtn.disabled = maxQuantity <= 0;
  };

  decrementBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setQuantity(quantity - 1);
  });
  incrementBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setQuantity(quantity + 1);
  });
  quantityInput.addEventListener("change", () => {
    setQuantity(Number(quantityInput.value));
  });

  const buttonRow = document.createElement("div");
  buttonRow.style.cssText = "display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = t("town_service.material_withdraw.cancel" as never);
  cancelBtn.style.cssText = `
    padding: 6px 14px; font-size: 12px;
    background: #2a2218; border: 1px solid #4d3f2a; border-radius: 6px;
    color: #d8c6a3; cursor: pointer;
  `;
  cancelBtn.addEventListener("click", () => backdrop.remove());
  buttonRow.appendChild(cancelBtn);

  confirmBtn.textContent = t("town_service.material_withdraw.confirm" as never);
  confirmBtn.disabled = maxQuantity <= 0;
  confirmBtn.style.cssText = `
    padding: 6px 14px; font-size: 12px;
    background: #2a3a18; border: 1px solid #4d6a2a; border-radius: 6px;
    color: #b9d49a; cursor: pointer;
  `;
  confirmBtn.addEventListener("click", () => {
    backdrop.remove();
    options.onConfirm(quantity);
  });
  buttonRow.appendChild(confirmBtn);

  card.appendChild(buttonRow);

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      backdrop.remove();
    }
  });
}
