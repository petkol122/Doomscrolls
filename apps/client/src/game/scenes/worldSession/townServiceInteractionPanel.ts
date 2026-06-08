/**
 * Task 205 — Vendor Preview + Safe-Zone Services Batch
 *
 * Compact dismissible placeholder panel for non-vendor town services
 * (Stash Keeper, future Trainer). It shows the service's localized
 * label, a short unavailable notice pulled from the content
 * definition's `unavailableMessageKey`, and a Close button.
 *
 * No stash storage, no trainer skills, no persistence, no money,
 * no reputation. The panel is a visual placeholder only.
 */
import type { TownServiceContentDefinition } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";

export interface TownServiceInteractionPanel {
  readonly show: () => void;
  readonly destroy: () => void;
}

export function createTownServiceInteractionPanel(
  service: TownServiceContentDefinition,
): TownServiceInteractionPanel {
  let panelElement: HTMLDivElement | null = null;

  const show = (): void => {
    hideExisting();

    // Task 242 — town-service modal backdrop. See vendorInteractionPanel
    // for the rationale: `pointer-events: auto` alone is not enough.
    // We install capture-phase pointerdown / mousedown / click /
    // contextmenu stoppers so any click in the modal area never
    // leaks to the Phaser world canvas as a movement intent.
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
    backdrop.addEventListener("click", stopWorldInput, { capture: true });
    backdrop.addEventListener("contextmenu", stopWorldInput, { capture: true });

    const card = document.createElement("div");
    card.style.cssText = `
      background: #10181a; border: 1px solid #2f5a5a; border-radius: 10px;
      padding: 20px 24px; min-width: 320px; max-width: 420px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.7);
      display: grid; gap: 12px;
    `;

    // Service label
    const nameLine = document.createElement("div");
    nameLine.textContent = t(service.labelKey as never);
    nameLine.style.cssText = `
      color: #c8e6e6; font-size: 16px; font-weight: bold;
    `;
    card.appendChild(nameLine);

    // Separator
    const sep = document.createElement("div");
    sep.style.cssText = "height: 1px; background: #1f4a4a;";
    card.appendChild(sep);

    // Service kind tag
    const kindLine = document.createElement("div");
    kindLine.textContent = `Service: ${service.serviceKind}`;
    kindLine.style.cssText = `
      color: #7fb5b5; font-size: 11px; font-family: monospace;
      text-transform: uppercase; letter-spacing: 0.04em;
    `;
    card.appendChild(kindLine);

    // Unavailable notice (from content unavailableMessageKey)
    const note = document.createElement("div");
    note.textContent = t(service.unavailableMessageKey as never);
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
      background: #1a2628; border: 1px solid #2f5a5a; border-radius: 6px;
      color: #c8e6e6; cursor: pointer; justify-self: end;
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
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
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
