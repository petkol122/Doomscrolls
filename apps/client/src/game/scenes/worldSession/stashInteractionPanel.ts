import { contentRegistry } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";
import type { ItemInstance } from "@doomscrolls/shared";

export interface StashInteractionPanel {
  readonly show: () => void;
  readonly destroy: () => void;
  readonly setItems: (items: readonly ItemInstance[]) => void;
  readonly setInventoryItems: (items: readonly ItemInstance[]) => void;
  readonly showFeedback: (message: string) => void;
}

export function createStashInteractionPanel(options?: {
  readonly onStore?: (itemInstanceId: string) => void;
  readonly onTake?: (itemInstanceId: string) => void;
}): StashInteractionPanel {
  let panelElement: HTMLDivElement | null = null;
  let listElement: HTMLDivElement | null = null;
  let feedbackElement: HTMLDivElement | null = null;
  let currentItems: readonly ItemInstance[] = [];
  let currentInventoryItems: readonly ItemInstance[] = [];

  const buildList = (): HTMLDivElement => {
    const section = document.createElement("div");
    section.style.cssText = "display: grid; gap: 6px;";

    const buildRow = (item: ItemInstance, actionLabel: string, onClick?: (itemInstanceId: string) => void): HTMLDivElement => {
      const row = document.createElement("div");
      row.style.cssText = `
        display: grid;
        gap: 4px;
        padding: 8px;
        background: rgba(24, 18, 13, 0.7);
        border: 1px solid #3c3122;
        border-radius: 6px;
      `;

      const def = contentRegistry.items.get(item.definitionId as never);
      const name = document.createElement("div");
      name.textContent = def !== undefined ? t(def.nameKey as never) : item.definitionId;
      name.style.cssText = "color: #d8c6a3; font-size: 12px; font-weight: bold;";
      row.appendChild(name);

      const location = item.location.type === "stash"
        ? t("town_service.stash_keeper.page_position" as never, {
            page: item.location.pageIndex,
            x: item.location.x,
            y: item.location.y,
          })
        : item.location.type;
      const meta = document.createElement("div");
      meta.textContent = location;
      meta.style.cssText = "color: #a88d63; font-size: 11px; font-family: monospace;";
      row.appendChild(meta);

      if (item.stackQuantity > 1) {
        const qty = document.createElement("div");
        qty.textContent = `Qty: ${item.stackQuantity}`;
        qty.style.cssText = "color: #b9d49a; font-size: 11px;";
        row.appendChild(qty);
      }

      if (onClick !== undefined) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = actionLabel;
        button.style.cssText = "margin-top: 4px; justify-self: start; padding: 4px 10px; font-size: 11px; background: #2a2218; border: 1px solid #4d3f2a; border-radius: 6px; color: #d8c6a3; cursor: pointer;";
        button.addEventListener("click", () => onClick(item.id));
        row.appendChild(button);
      }

      return row;
    };

    const inventoryHeader = document.createElement("div");
    inventoryHeader.textContent = t("town_service.stash_keeper.inventory_header" as never);
    inventoryHeader.style.cssText = "color: #f0ddbb; font-size: 13px; font-weight: bold; margin-top: 4px;";
    section.appendChild(inventoryHeader);

    if (currentInventoryItems.length === 0) {
      const emptyInventory = document.createElement("div");
      emptyInventory.textContent = t("town_service.vendor_panel.sell_empty" as never);
      emptyInventory.style.cssText = "color: #7a6a4f; font-size: 12px; font-style: italic;";
      section.appendChild(emptyInventory);
    } else {
      for (const item of currentInventoryItems) {
        section.appendChild(buildRow(item, t("town_service.stash_keeper.store_action" as never), options?.onStore));
      }
    }

    const stashHeader = document.createElement("div");
    stashHeader.textContent = t("town_service.stash_keeper.stash_header" as never);
    stashHeader.style.cssText = "color: #f0ddbb; font-size: 13px; font-weight: bold; margin-top: 8px;";
    section.appendChild(stashHeader);

    if (currentItems.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = t("town_service.stash_keeper.empty" as never);
      empty.style.cssText = "color: #7a6a4f; font-size: 12px; font-style: italic;";
      section.appendChild(empty);
      return section;
    }

    for (const item of currentItems) {
      section.appendChild(buildRow(item, t("town_service.stash_keeper.take_action" as never), options?.onTake));
    }

    return section;
  };

  const rerenderList = (): void => {
    if (listElement === null) return;
    const parent = listElement.parentElement;
    if (parent === null) return;
    const next = buildList();
    parent.replaceChild(next, listElement);
    listElement = next;
  };

  const hideExisting = (): void => {
    if (panelElement !== null) {
      panelElement.remove();
      panelElement = null;
    }
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
      if (event.cancelable) event.preventDefault();
    };
    backdrop.addEventListener("pointerdown", stopWorldInput, { capture: true });
    backdrop.addEventListener("mousedown", stopWorldInput, { capture: true });
    backdrop.addEventListener("contextmenu", stopWorldInput, { capture: true });

    const card = document.createElement("div");
    card.style.cssText = `
      background: #1a1510; border: 1px solid #5f4a2f; border-radius: 10px;
      padding: 20px 24px; min-width: 340px; max-width: 460px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.7);
      display: grid; gap: 12px;
    `;

    const title = document.createElement("div");
    title.textContent = t("town_service.stash_keeper.panel_title" as never);
    title.style.cssText = "color: #f0ddbb; font-size: 16px; font-weight: bold;";
    card.appendChild(title);

    const note = document.createElement("div");
    note.textContent = t("town_service.stash_keeper.foundation_notice" as never);
    note.style.cssText = `
      color: #c8a86b; font-size: 12px;
      padding: 6px 8px; border: 1px solid #5f4a2f; border-radius: 6px;
      background: rgba(60, 40, 20, 0.45);
    `;
    card.appendChild(note);

    listElement = buildList();
    card.appendChild(listElement);

    feedbackElement = document.createElement("div");
    feedbackElement.style.cssText = `
      display: none; color: #e8c36a; font-size: 12px;
      text-align: center; padding: 4px 8px;
      border: 1px solid #5f4a2f; border-radius: 6px;
      background: rgba(60, 40, 20, 0.45);
    `;
    card.appendChild(feedbackElement);

    const close = document.createElement("button");
    close.textContent = t("ui.close" as never);
    close.style.cssText = `
      margin-top: 4px; padding: 6px 14px; font-size: 12px;
      background: #2a2218; border: 1px solid #4d3f2a; border-radius: 6px;
      color: #d8c6a3; cursor: pointer; justify-self: end;
    `;
    close.addEventListener("click", () => {
      backdrop.remove();
      panelElement = null;
    });
    card.appendChild(close);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    panelElement = backdrop;
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        backdrop.remove();
        panelElement = null;
      }
    });
  };

  return {
    show,
    destroy: hideExisting,
    setItems: (items) => {
      currentItems = items;
      rerenderList();
    },
    setInventoryItems: (items) => {
      currentInventoryItems = items;
      rerenderList();
    },
    showFeedback: (message) => {
      if (feedbackElement !== null) {
        feedbackElement.textContent = message;
        feedbackElement.style.display = "block";
      }
    },
  };
}