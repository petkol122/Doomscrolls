import { t } from "@doomscrolls/localization";
import type { Room } from "@colyseus/sdk";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import { sendMovementIntent } from "../../../net/movementIntentClient";
import { getTownRoomPresence, type PlayerPresenceEntry } from "../../../net/townRoomPresence";
import { resolveWorldAreaBounds } from "./resolveWorldAreaBounds";

// ---------------------------------------------------------------------------
// World area input view (Task 033 — Click-to-Move Input Intent Only)
//
// Renders a simple bounded "world area" panel that:
//   - displays the zone bounds and the player's current synced position
//   - sends movement intent on click/tap inside the area
//   - does NOT fake movement locally (only server changes matter)
//   - does NOT do pathfinding, collision, speed checks, or animation
//
// Bounds are resolved from content registry data (placeholder zone bounds,
// NOT collision geometry or map size).
//
// This module stays small and isolated from AccountShellScene.
// The parent AccountShellScene already re-renders the full overlay on
// room state change, so we only snapshot the current state once.
// ---------------------------------------------------------------------------

/** CSS pixel size of the world area panel. */
const PANEL_W = 400;
const PANEL_H = 300;

export interface WorldAreaInputElements {
  readonly container: HTMLElement;
}

interface PositionSnapshot {
  readonly x: number;
  readonly y: number;
}

interface WorldAreaInputOptions {
  readonly room: Room<DoomscrollsRoomState>;
  readonly zoneId?: string;
}

/**
 * Create a world area input panel.
 *
 * The panel draws a bounded rectangle representing the zone world. Clicking/
 * tapping inside converts the click coordinates to world space and sends a
 * movement intent. The player's current synced position (x, y) from the
 * server is displayed as a blue dot inside the panel and as text below it.
 *
 * Bounds are resolved from the content registry (placeholder zone bounds,
 * NOT collision geometry or map size). Falls back to safe defaults if the
 * zone is missing from content.
 *
 * No local position faking — the dot and status only update from Colyseus
 * schema sync after the server applies movement.
 */
export function createWorldAreaInput(options: WorldAreaInputOptions): WorldAreaInputElements {
  const { room } = options;
  const zoneId = options.zoneId ?? room.state.zoneId;
  const bounds = resolveWorldAreaBounds(zoneId);

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

  const statusDisplay = document.createElement("p");
  statusDisplay.id = "doomscrolls-world-area-status";
  statusDisplay.style.margin = "4px 0 0";
  statusDisplay.style.fontSize = "12px";
  statusDisplay.style.color = "#8fb0d8";
  container.appendChild(statusDisplay);

  // Snapshot current state (parent AccountShellScene re-renders on
  // room.onStateChange, so we only need to read once).
  const presence = getTownRoomPresence(room.state as unknown as Record<string, unknown>);
  if (presence !== null && presence.players.length > 0) {
    // Find the current client's player by matching Colyseus sessionId.
    const self = presence.players.find((p) => p.sessionId === room.sessionId) ?? null;
    if (self !== null) {
      updateDotAndPosition(dot, positionDisplay, statusDisplay, self, bounds, scaleX, scaleY);
    } else {
      positionDisplay.textContent = t("world_area.no_position");
      statusDisplay.textContent = "";
    }
  } else {
    positionDisplay.textContent = t("world_area.no_position");
    statusDisplay.textContent = "";
  }

  return { container };
}

function updateDotAndPosition(
  dot: HTMLDivElement,
  display: HTMLElement,
  statusDisplay: HTMLElement,
  player: PlayerPresenceEntry,
  bounds: { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number },
  scaleX: number,
  scaleY: number,
): void {
  if (player.position === undefined) {
    dot.style.left = "-999px";
    dot.style.top = "-999px";
    display.textContent = t("world_area.no_position");
    statusDisplay.textContent = "";
    return;
  }

  const { x, y } = player.position;
  const previousPosition = readPreviousPosition(dot);
  const px = (x - bounds.minX) * scaleX;
  const py = (y - bounds.minY) * scaleY;

  dot.style.left = `${Math.round(px)}px`;
  dot.style.top = `${Math.round(py)}px`;
  dot.dataset.serverX = String(x);
  dot.dataset.serverY = String(y);

  display.textContent = `x=${Math.round(x)}, y=${Math.round(y)}`;
  statusDisplay.textContent =
    previousPosition !== null && (previousPosition.x !== x || previousPosition.y !== y)
      ? t("world_area.server_position_updated")
      : "";
}

function readPreviousPosition(dot: HTMLDivElement): PositionSnapshot | null {
  const rawX = dot.dataset.serverX;
  const rawY = dot.dataset.serverY;

  if (rawX === undefined || rawY === undefined) {
    return null;
  }

  const x = Number(rawX);
  const y = Number(rawY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
}