import { t } from "@doomscrolls/localization";
import type { Room } from "@colyseus/sdk";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import { sendMovementIntent } from "../../../net/movementIntentClient";
import { getTownRoomPresence, type PlayerPresenceEntry } from "../../../net/townRoomPresence";

// ---------------------------------------------------------------------------
// World area input view (Task 033 — Click-to-Move Input Intent Only)
//
// Renders a simple bounded "world area" panel that:
//   - displays the zone bounds and the player's current synced position
//   - sends movement intent on click/tap inside the area
//   - does NOT fake movement locally (only server changes matter)
//   - does NOT do pathfinding, collision, speed checks, or animation
//
// This module stays small and isolated from AccountShellScene.
// The parent AccountShellScene already re-renders the full overlay on
// room state change, so we only snapshot the current state once.
// ---------------------------------------------------------------------------

/** Zone bounds matching the nightmarket content definition (0–800 x 0–600). */
const DEFAULT_AREA_W = 800;
const DEFAULT_AREA_H = 600;

/** CSS pixel size of the world area panel. */
const PANEL_W = 400;
const PANEL_H = 300;

export interface WorldAreaInputElements {
  readonly container: HTMLElement;
}

interface WorldAreaInputOptions {
  readonly room: Room<DoomscrollsRoomState>;
  readonly bounds?: { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number };
}

/**
 * Create a world area input panel.
 *
 * The panel draws a bounded rectangle representing the zone world. Clicking/
 * tapping inside converts the click coordinates to world space and sends a
 * movement intent. The player's current synced position (x, y) from the
 * server is displayed as a blue dot inside the panel and as text below it.
 *
 * No local position faking — the dot only moves when the server confirms
 * a new position via Colyseus schema sync.
 */
export function createWorldAreaInput(options: WorldAreaInputOptions): WorldAreaInputElements {
  const { room } = options;
  const bounds = options.bounds ?? { minX: 0, maxX: DEFAULT_AREA_W, minY: 0, maxY: DEFAULT_AREA_H };

  const container = document.createElement("div");
  container.style.marginTop = "12px";

  // -- Title --
  const title = document.createElement("p");
  title.textContent = t("world_area.title");
  title.style.margin = "0 0 6px";
  title.style.fontSize = "14px";
  title.style.fontWeight = "bold";
  title.style.color = "#f0dec0";
  container.appendChild(title);

  // -- Clickable area (the "world area" panel) --
  const area = document.createElement("div");
  area.style.width = `${PANEL_W}px`;
  area.style.height = `${PANEL_H}px`;
  area.style.border = "2px solid #5f4a2f";
  area.style.borderRadius = "4px";
  area.style.background = "#1a1510";
  area.style.position = "relative";
  area.style.cursor = "crosshair";
  area.style.overflow = "hidden";
  area.setAttribute("role", "img");
  area.setAttribute("aria-label", t("world_area.click_instruction"));

  // Blue dot — shown at the player's synced server position.
  const dot = document.createElement("div");
  dot.id = "doomscrolls-world-area-dot";
  dot.style.width = "8px";
  dot.style.height = "8px";
  dot.style.borderRadius = "50%";
  dot.style.background = "#4a9eff";
  dot.style.position = "absolute";
  dot.style.transform = "translate(-50%, -50%)";
  dot.style.pointerEvents = "none";
  dot.style.left = "-999px";
  dot.style.top = "-999px";
  area.appendChild(dot);

  // Hint label inside the panel.
  const hint = document.createElement("span");
  hint.textContent = t("world_area.click_instruction");
  hint.style.position = "absolute";
  hint.style.bottom = "8px";
  hint.style.left = "8px";
  hint.style.fontSize = "11px";
  hint.style.color = "#6a5a3a";
  hint.style.pointerEvents = "none";
  area.appendChild(hint);

  const scaleX = PANEL_W / (bounds.maxX - bounds.minX);
  const scaleY = PANEL_H / (bounds.maxY - bounds.minY);

  area.addEventListener("click", (event: MouseEvent) => {
    const rect = area.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;

    const clampedPx = Math.max(0, Math.min(PANEL_W, px));
    const clampedPy = Math.max(0, Math.min(PANEL_H, py));

    const worldX = bounds.minX + clampedPx / scaleX;
    const worldY = bounds.minY + clampedPy / scaleY;

    sendMovementIntent(room, Math.round(worldX), Math.round(worldY));
  });

  container.appendChild(area);

  // -- Position display (read from current room state snapshot) --
  const positionDisplay = document.createElement("p");
  positionDisplay.id = "doomscrolls-world-area-position";
  positionDisplay.style.margin = "8px 0 0";
  positionDisplay.style.fontSize = "13px";
  positionDisplay.style.color = "#b9d49a";
  container.appendChild(positionDisplay);

  // Snapshot current state (parent AccountShellScene re-renders on
  // room.onStateChange, so we only need to read once).
  const presence = getTownRoomPresence(room.state as unknown as Record<string, unknown>);
  if (presence !== null && presence.players.length > 0) {
    const self = presence.players[0] as PlayerPresenceEntry;
    updateDotAndPosition(dot, positionDisplay, self, bounds, scaleX, scaleY);
  } else {
    positionDisplay.textContent = t("world_area.no_position");
  }

  return { container };
}

function updateDotAndPosition(
  dot: HTMLDivElement,
  display: HTMLElement,
  player: PlayerPresenceEntry,
  bounds: { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number },
  scaleX: number,
  scaleY: number,
): void {
  if (player.position === undefined) {
    dot.style.left = "-999px";
    dot.style.top = "-999px";
    display.textContent = t("world_area.no_position");
    return;
  }

  const { x, y } = player.position;
  const px = (x - bounds.minX) * scaleX;
  const py = (y - bounds.minY) * scaleY;

  dot.style.left = `${Math.round(px)}px`;
  dot.style.top = `${Math.round(py)}px`;

  display.textContent = `x=${Math.round(x)}, y=${Math.round(y)}`;
}