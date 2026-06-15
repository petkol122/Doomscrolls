import type { WaypointDestinationEntry } from "@doomscrolls/shared";
import { t } from "@doomscrolls/localization";

export interface WaypointInteractionPanel {
  readonly show: (destinations: readonly WaypointDestinationEntry[]) => void;
  readonly destroy: () => void;
}

export function createWaypointInteractionPanel(options: {
  readonly onTravel: (waypointId: string) => void;
}): WaypointInteractionPanel {
  let panelElement: HTMLDivElement | null = null;

  const hideExisting = (): void => {
    if (panelElement !== null) {
      panelElement.remove();
      panelElement = null;
    }
  };

  const show = (destinations: readonly WaypointDestinationEntry[]): void => {
    hideExisting();
    const backdrop = document.createElement("div");
    backdrop.style.cssText = "position: fixed; inset: 0; z-index: 20000; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center;";
    const stopWorldInput = (event: Event): void => {
      event.stopPropagation();
      if (event.cancelable) event.preventDefault();
    };
    backdrop.addEventListener("pointerdown", stopWorldInput, { capture: true });
    backdrop.addEventListener("mousedown", stopWorldInput, { capture: true });
    backdrop.addEventListener("contextmenu", stopWorldInput, { capture: true });

    const card = document.createElement("div");
    card.style.cssText = "background: #10181a; border: 1px solid #41657a; border-radius: 10px; padding: 20px 24px; min-width: 360px; max-width: 460px; box-shadow: 0 6px 20px rgba(0,0,0,0.7); display: grid; gap: 12px;";

    const title = document.createElement("div");
    title.textContent = t("town_service.waypoint.panel_title" as never);
    title.style.cssText = "color: #d3e5f3; font-size: 16px; font-weight: bold;";
    card.appendChild(title);

    const subtitle = document.createElement("div");
    subtitle.textContent = t("town_service.waypoint.panel_subtitle" as never);
    subtitle.style.cssText = "color: #8fb5cc; font-size: 12px;";
    card.appendChild(subtitle);

    if (destinations.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = t("town_service.waypoint.empty" as never);
      empty.style.cssText = "color: #c8a86b; font-size: 12px; border: 1px solid #5f4a2f; background: rgba(60,40,20,0.45); padding: 8px; border-radius: 6px;";
      card.appendChild(empty);
    } else {
      for (const destination of destinations) {
        const row = document.createElement("div");
        row.style.cssText = "display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; padding: 8px; border: 1px solid #29414f; border-radius: 6px; background: rgba(19,27,32,0.9);";

        const info = document.createElement("div");
        info.textContent = t(destination.labelKey as never);
        info.style.cssText = "color: #d8e2ea; font-size: 12px;";
        row.appendChild(info);

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = t("town_service.waypoint.travel_action" as never);
        button.style.cssText = "padding: 6px 12px; font-size: 12px; background: #1d2d36; border: 1px solid #41657a; border-radius: 6px; color: #d3e5f3; cursor: pointer;";
        button.addEventListener("click", () => options.onTravel(destination.waypointId));
        row.appendChild(button);
        card.appendChild(row);
      }
    }

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = t("ui.close" as never);
    close.style.cssText = "justify-self: end; padding: 6px 14px; font-size: 12px; background: #1a2628; border: 1px solid #2f5a5a; border-radius: 6px; color: #c8e6e6; cursor: pointer;";
    close.addEventListener("click", hideExisting);
    card.appendChild(close);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    panelElement = backdrop;
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) hideExisting();
    });
  };

  return { show, destroy: hideExisting };
}