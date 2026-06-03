import type { Room } from "@colyseus/sdk";
import { t } from "@doomscrolls/localization";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import Phaser from "phaser";

import { sendMovementIntent } from "../../../net/movementIntentClient";
import { sendInteractIntent } from "../../../net/interactIntentClient";
import { getTownRoomPresence } from "../../../net/townRoomPresence";
import { resolveWorldAreaBounds } from "../accountShell/resolveWorldAreaBounds";
import { createWorldSessionPlayerPlaceholderView } from "./worldSessionPlayerPlaceholderView";
import { createWorldSessionInteractablesView } from "./worldSessionInteractablesView";
import { createWorldSessionEnemyPlaceholderView } from "./worldSessionEnemyPlaceholderView";
import {
  getTownRoomEnemies,
  type TownRoomEnemySnapshot,
} from "../../../net/townRoomEnemies";
import type { WorldSessionEnemyPlaceholderView } from "./worldSessionEnemyPlaceholderView";

const AREA_WIDTH = 800;
const AREA_HEIGHT = 600;

const BOUNDS_ORIGIN_X = 84;
const BOUNDS_ORIGIN_Y = 84;

interface PositionSnapshot {
  readonly x: number;
  readonly y: number;
}

interface ClickTargetSnapshot {
  readonly x: number;
  readonly y: number;
}

export interface WorldSessionDebugState {
  readonly lastClickTarget: ClickTargetSnapshot | null;
}

export interface WorldSessionAreaView {
  readonly refreshFromRoomState: (room: Room<DoomscrollsRoomState>) => void;
  readonly getDebugState: () => WorldSessionDebugState;
  readonly destroy: () => void;
}

export function createWorldSessionAreaView(
  scene: Phaser.Scene,
  room: Room<DoomscrollsRoomState>,
  onDebugStateChange?: () => void,
): WorldSessionAreaView {
  const container = scene.add.container(0, 0);
  const frame = scene.add.graphics();
  const playerPlaceholder = createWorldSessionPlayerPlaceholderView(scene);
  const interactablesView = createWorldSessionInteractablesView(scene, (objectId) => {
    sendInteractIntent(room, objectId);
  });

  // Task 058 — Add enemy placeholder view
  const enemyPlaceholders = new Map<string, WorldSessionEnemyPlaceholderView>();

  const targetMarker = scene.add.circle(-9999, -9999, 7, 0xff4a4a, 0.8);
  const targetLabel = scene.add.text(BOUNDS_ORIGIN_X, BOUNDS_ORIGIN_Y + AREA_HEIGHT + 112, "", {
    color: "#ff4a4a",
    fontFamily: "Arial, sans-serif",
    fontSize: "14px",
  });
  const lineGraphic = scene.add.graphics();
  lineGraphic.lineStyle(1, 0xffffff, 0.5);
  const title = scene.add.text(BOUNDS_ORIGIN_X, 48, t("world_area.title"), {
    color: "#d8c6a3",
    fontFamily: "Arial, sans-serif",
    fontSize: "20px",
    fontStyle: "bold",
  });
  const instruction = scene.add.text(
    BOUNDS_ORIGIN_X,
    BOUNDS_ORIGIN_Y + AREA_HEIGHT + 14,
    t("world_area.click_instruction"),
    {
      color: "#8d7958",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
    },
  );
  const boundsLabel = scene.add.text(BOUNDS_ORIGIN_X, BOUNDS_ORIGIN_Y + AREA_HEIGHT + 40, "", {
    color: "#a88d63",
    fontFamily: "Arial, sans-serif",
    fontSize: "14px",
  });
  const positionLabel = scene.add.text(BOUNDS_ORIGIN_X, BOUNDS_ORIGIN_Y + AREA_HEIGHT + 64, "", {
    color: "#b9d49a",
    fontFamily: "Arial, sans-serif",
    fontSize: "15px",
  });
  const statusLabel = scene.add.text(BOUNDS_ORIGIN_X, BOUNDS_ORIGIN_Y + AREA_HEIGHT + 88, "", {
    color: "#8fb0d8",
    fontFamily: "Arial, sans-serif",
    fontSize: "14px",
  });

  container.add([
    frame,
    targetMarker,
    lineGraphic,
    title,
    instruction,
    boundsLabel,
    positionLabel,
    statusLabel,
    targetLabel,
  ]);

  const inputZone = scene.add
    .zone(BOUNDS_ORIGIN_X, BOUNDS_ORIGIN_Y, AREA_WIDTH, AREA_HEIGHT)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });

  container.add(inputZone);

  let previousPosition: PositionSnapshot | null = null;
  let lastClickTarget: ClickTargetSnapshot | null = null;

  const refreshFromRoomState = (nextRoom: Room<DoomscrollsRoomState>): void => {
    const zoneId = nextRoom.state.zoneId;
    const bounds = resolveWorldAreaBounds(zoneId);

    drawBounds(frame);
    boundsLabel.setText(
      `zone=${zoneId} bounds: x=${bounds.minX}..${bounds.maxX}, y=${bounds.minY}..${bounds.maxY}`,
    );

    // Task 057 — Refresh interactables view
    interactablesView.refresh(nextRoom);

    // Task 058 — Refresh enemies view
    const currentEnemies = getTownRoomEnemies(nextRoom.state);
    const projectedEnemies = currentEnemies
      .map((enemy: TownRoomEnemySnapshot) => projectEnemyToArea(enemy, bounds))
      .filter((enemy: TownRoomEnemySnapshot | null): enemy is TownRoomEnemySnapshot => enemy !== null);
    const newEnemyIds = new Set(projectedEnemies.map((enemy: TownRoomEnemySnapshot) => enemy.id));

    // Remove old enemies
    for (const [id, view] of enemyPlaceholders.entries()) {
      if (!newEnemyIds.has(id)) {
        view.destroy();
        enemyPlaceholders.delete(id);
      }
    }

    // Add or refresh new/existing enemies
    for (const enemy of projectedEnemies) {
      let enemyView = enemyPlaceholders.get(enemy.id);
      if (enemyView === undefined) {
        enemyView = createWorldSessionEnemyPlaceholderView(scene, enemy);
        enemyPlaceholders.set(enemy.id, enemyView);
      } else {
        enemyView.refresh(enemy);
      }
    }



    inputZone.removeAllListeners();
    inputZone.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      const localX = Phaser.Math.Clamp(pointer.x - BOUNDS_ORIGIN_X, 0, AREA_WIDTH);
      const localY = Phaser.Math.Clamp(pointer.y - BOUNDS_ORIGIN_Y, 0, AREA_HEIGHT);
      const worldX = bounds.minX + (localX / AREA_WIDTH) * (bounds.maxX - bounds.minX);
      const worldY = bounds.minY + (localY / AREA_HEIGHT) * (bounds.maxY - bounds.minY);
      lastClickTarget = { x: Math.round(worldX), y: Math.round(worldY) };
      onDebugStateChange?.();
      sendMovementIntent(nextRoom, lastClickTarget.x, lastClickTarget.y);
    });

    const presence = getTownRoomPresence(nextRoom.state as unknown as Record<string, unknown>);
    const self = presence?.players.find((player) => player.sessionId === nextRoom.sessionId) ?? null;

    if (self?.position === undefined) {
      playerPlaceholder.hide();
      targetMarker.setPosition(-9999, -9999);
      targetLabel.setText("");
      lineGraphic.clear();
      positionLabel.setText(t("world_area.no_position"));
      statusLabel.setText("");
      previousPosition = null;
      return;
    }

    const { x, y } = self.position;
    const pixelX = BOUNDS_ORIGIN_X + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * AREA_WIDTH;
    const pixelY = BOUNDS_ORIGIN_Y + ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * AREA_HEIGHT;

    // Update placeholder using authoritative synced position only.
    playerPlaceholder.setPosition(pixelX, pixelY);

    // Update target marker and line if a click target exists (debug, non-authoritative)
    if (lastClickTarget) {
      const targetPixelX = BOUNDS_ORIGIN_X + ((lastClickTarget.x - bounds.minX) / (bounds.maxX - bounds.minX)) * AREA_WIDTH;
      const targetPixelY = BOUNDS_ORIGIN_Y + ((lastClickTarget.y - bounds.minY) / (bounds.maxY - bounds.minY)) * AREA_HEIGHT;
      targetMarker.setPosition(targetPixelX, targetPixelY);
      targetLabel.setText(`Target: ${lastClickTarget.x}, ${lastClickTarget.y} (non-auth)`);
      lineGraphic.clear();
      lineGraphic.lineStyle(1, 0xffffff, 0.5);
      lineGraphic.lineBetween(pixelX, pixelY, targetPixelX, targetPixelY);
      
      // Point marker toward target direction
      const dx = targetPixelX - pixelX;
      const dy = targetPixelY - pixelY;
      const angle = Math.atan2(dy, dx) - Math.PI / 2;
      playerPlaceholder.setMarkerDirection(angle);
    } else {
      targetMarker.setPosition(-9999, -9999);
      targetLabel.setText("");
      lineGraphic.clear();
    }

    positionLabel.setText(`x=${Math.round(x)}, y=${Math.round(y)}`);
    statusLabel.setText(
      previousPosition !== null && (previousPosition.x !== x || previousPosition.y !== y)
        ? t("world_area.server_position_updated")
        : "",
    );
    previousPosition = { x, y };
  };

  refreshFromRoomState(room);

  return {
    refreshFromRoomState,
    getDebugState: () => ({ lastClickTarget }),
    destroy: () => {
      playerPlaceholder.destroy();
      interactablesView.destroy();
      // Task 058 — Destroy enemy placeholders
      for (const view of enemyPlaceholders.values()) {
        view.destroy();
      }
      enemyPlaceholders.clear();
      container.destroy(true);
    },
  };
}

function drawBounds(graphics: Phaser.GameObjects.Graphics): void {
  graphics.clear();
  graphics.fillStyle(0x1a1510, 1);
  graphics.fillRect(BOUNDS_ORIGIN_X, BOUNDS_ORIGIN_Y, AREA_WIDTH, AREA_HEIGHT);
  graphics.lineStyle(2, 0x5f4a2f, 1);
  graphics.strokeRect(BOUNDS_ORIGIN_X, BOUNDS_ORIGIN_Y, AREA_WIDTH, AREA_HEIGHT);
}

function projectEnemyToArea(
  enemy: TownRoomEnemySnapshot,
  bounds: { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number },
): TownRoomEnemySnapshot | null {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  if (width <= 0 || height <= 0) {
    return null;
  }

  const normalizedX = (enemy.x - bounds.minX) / width;
  const normalizedY = (enemy.y - bounds.minY) / height;

  if (
    !Number.isFinite(normalizedX) ||
    !Number.isFinite(normalizedY) ||
    normalizedX < 0 ||
    normalizedX > 1 ||
    normalizedY < 0 ||
    normalizedY > 1
  ) {
    return null;
  }

  return {
    ...enemy,
    x: BOUNDS_ORIGIN_X + normalizedX * AREA_WIDTH,
    y: BOUNDS_ORIGIN_Y + normalizedY * AREA_HEIGHT,
  };
}