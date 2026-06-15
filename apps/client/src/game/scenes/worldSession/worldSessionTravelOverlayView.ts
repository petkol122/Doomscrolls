import { t } from "@doomscrolls/localization";

const FADE_DURATION_MS = 150;

export type WorldSessionTravelOverlayKind = "route" | "waypoint";

export interface WorldSessionTravelOverlayView {
  readonly show: (kind: WorldSessionTravelOverlayKind) => void;
  readonly hide: () => void;
  readonly destroy: () => void;
}

function resolveOverlayCopy(kind: WorldSessionTravelOverlayKind): {
  readonly title: string;
  readonly message: string;
} {
  if (kind === "waypoint") {
    return {
      title: t("world_session.travel_overlay.waypoint_title" as never),
      message: t("world_session.travel_overlay.waypoint_message" as never),
    };
  }

  return {
    title: t("world_session.travel_overlay.route_title" as never),
    message: t("world_session.travel_overlay.route_message" as never),
  };
}

export function createWorldSessionTravelOverlayView(): WorldSessionTravelOverlayView {
  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "25000";
  root.style.display = "flex";
  root.style.alignItems = "center";
  root.style.justifyContent = "center";
  root.style.pointerEvents = "auto";
  root.style.background = "rgba(3, 5, 8, 0.72)";
  root.style.backdropFilter = "blur(2px)";
  root.style.opacity = "0";
  root.style.visibility = "hidden";
  root.style.transition = `opacity ${FADE_DURATION_MS}ms ease-out, visibility ${FADE_DURATION_MS}ms ease-out`;

  const stopInput = (event: Event): void => {
    event.stopPropagation();
    if (event.cancelable) {
      event.preventDefault();
    }
  };

  root.addEventListener("pointerdown", stopInput, { capture: true });
  root.addEventListener("pointerup", stopInput, { capture: true });
  root.addEventListener("mousedown", stopInput, { capture: true });
  root.addEventListener("mouseup", stopInput, { capture: true });
  root.addEventListener("click", stopInput, { capture: true });
  root.addEventListener("contextmenu", stopInput, { capture: true });

  const card = document.createElement("div");
  card.style.display = "grid";
  card.style.gap = "10px";
  card.style.minWidth = "280px";
  card.style.maxWidth = "min(420px, calc(100vw - 48px))";
  card.style.padding = "22px 28px";
  card.style.border = "1px solid rgba(152, 172, 196, 0.32)";
  card.style.borderRadius = "12px";
  card.style.background = "linear-gradient(180deg, rgba(16, 20, 26, 0.96) 0%, rgba(8, 10, 14, 0.96) 100%)";
  card.style.boxShadow = "0 16px 42px rgba(0, 0, 0, 0.45)";
  card.style.textAlign = "center";

  const title = document.createElement("div");
  title.style.color = "#f0ddbb";
  title.style.fontFamily = "'Segoe UI', Arial, sans-serif";
  title.style.fontSize = "20px";
  title.style.fontWeight = "700";
  title.style.letterSpacing = "0.04em";

  const message = document.createElement("div");
  message.style.color = "#b9c8d8";
  message.style.fontFamily = "'Segoe UI', Arial, sans-serif";
  message.style.fontSize = "13px";
  message.style.lineHeight = "1.45";

  card.appendChild(title);
  card.appendChild(message);
  root.appendChild(card);
  document.body.appendChild(root);

  let isVisible = false;

  return {
    show: (kind: WorldSessionTravelOverlayKind) => {
      const copy = resolveOverlayCopy(kind);
      title.textContent = copy.title;
      message.textContent = copy.message;
      isVisible = true;
      root.style.visibility = "visible";
      root.style.opacity = "1";
    },
    hide: () => {
      if (!isVisible) {
        return;
      }
      isVisible = false;
      root.style.opacity = "0";
      root.style.visibility = "hidden";
    },
    destroy: () => {
      isVisible = false;
      root.remove();
    },
  };
}