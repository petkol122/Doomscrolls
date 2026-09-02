/**
 * Task 298 — Area Name Banner on Zone/Town Entry.
 *
 * Shows a Diablo-like top-center location name banner when the player
 * enters a town or gameplay zone. The banner fades in, stays briefly,
 * then fades out. It is screen-fixed (not world-positioned) and does
 * not block world input (pointer-events: none).
 */

import { contentRegistry, type ZoneContentId } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";

export interface WorldSessionAreaBannerView {
  /** Show the banner for the given zone id. Resolves the display name
   *  from the content registry and localization layer. */
  readonly show: (zoneId: string) => void;
  /** Tear down DOM elements and timers. */
  readonly destroy: () => void;
}

/** Resolve a player-facing zone name from the content registry.
 *  Falls back to the raw zoneId when the content lookup or
 *  localization fails. */
export function resolveZoneDisplayName(zoneId: string): string {
  try {
    const zone = contentRegistry.zones.get(zoneId as ZoneContentId);
    if (zone !== undefined && typeof zone.nameKey === "string") {
      const name = t(zone.nameKey as never);
      if (typeof name === "string" && name.length > 0) {
        return name;
      }
    }
  } catch { /* fall through */ }

  // Fallback to a generic name or title-case the raw id.
  if (zoneId === undefined || zoneId.length === 0) {
    return "Unknown Area";
  }
  return zoneId.charAt(0).toUpperCase() + zoneId.slice(1).replace(/_/g, " ");
}

/** Duration (ms) the banner stays fully visible after fade-in. */
const HOLD_DURATION_MS = 2400;

/** Duration (ms) of the fade-in and fade-out transitions. */
const FADE_DURATION_MS = 600;

export function createWorldSessionAreaBannerView(): WorldSessionAreaBannerView {
  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.top = "28px";
  root.style.left = "0";
  root.style.right = "0";
  root.style.display = "flex";
  root.style.justifyContent = "center";
  root.style.pointerEvents = "none";
  root.style.zIndex = "9000";
  root.style.transition = `opacity ${FADE_DURATION_MS}ms ease-in-out`;
  root.style.opacity = "0";

  const label = document.createElement("div");
  label.style.fontFamily = "'Segoe UI', Arial, sans-serif";
  label.style.fontSize = "22px";
  label.style.fontWeight = "bold";
  label.style.letterSpacing = "2px";
  label.style.textTransform = "uppercase";
  label.style.color = "#e8d5a3";
  label.style.textShadow = "0 1px 6px rgba(0,0,0,0.85), 0 0 20px rgba(0,0,0,0.5)";
  label.style.padding = "6px 28px";
  label.style.background = "linear-gradient(180deg, rgba(30,22,12,0.72) 0%, rgba(16,12,6,0.56) 100%)";
  label.style.borderRadius = "4px";
  label.style.whiteSpace = "nowrap";
  label.textContent = "";

  root.appendChild(label);
  document.body.appendChild(root);

  let fadeTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimers = (): void => {
    if (fadeTimer !== null) {
      clearTimeout(fadeTimer);
      fadeTimer = null;
    }
    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  return {
    show: (zoneId: string) => {
      clearTimers();
      const displayName = resolveZoneDisplayName(zoneId);
      label.textContent = displayName;

      // Reset to invisible, then fade in on next frame.
      root.style.opacity = "0";
      // Force reflow so the browser registers the reset before the transition.
      void root.offsetHeight;
      root.style.opacity = "1";

      // After hold duration, fade out.
      fadeTimer = setTimeout(() => {
        root.style.opacity = "0";
        fadeTimer = null;
        hideTimer = setTimeout(() => {
          label.textContent = "";
          hideTimer = null;
        }, FADE_DURATION_MS + 50);
      }, FADE_DURATION_MS + HOLD_DURATION_MS);
    },
    destroy: () => {
      clearTimers();
      root.remove();
    },
  };
}