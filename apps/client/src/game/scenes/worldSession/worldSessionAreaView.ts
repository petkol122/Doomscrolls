import type { Room } from "@colyseus/sdk";
import { t } from "@doomscrolls/localization";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import Phaser from "phaser";

import { sendMovementIntent } from "../../../net/movementIntentClient";
import { getTownRoomPresence } from "../../../net/townRoomPresence";
import { resolveWorldAreaBounds } from "../accountShell/resolveWorldAreaBounds";

const AREA_WIDTH = 800;
const AREA_HEIGHT = 600;

const BOUNDS_ORIGIN_X = 84;
const BOUNDS_ORIGIN_Y = 84;

interface PositionSnapshot {
  readonly x: number;
  readonly y: number;
}

export interface WorldSessionAreaView {
  readonly refreshFromRoomState: (room: Room<DoomscrollsRoomState>) => void;
  readonly destroy: () => void;
}

export function createWorldSessionAreaView(
  scene: Phaser.Scene,
  room: Room<DoomscrollsRoomState>,
): WorldSessionAreaView {
  const container = scene.add.container(0, 0);
  const frame = scene.add.graphics();
  const marker = scene.add.circle(-9999, -9999, 7, 0x4a9eff, 1);
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

  container.add([frame, marker, title, instruction, boundsLabel, positionLabel, statusLabel]);

  const inputZone = scene.add
    .zone(BOUNDS_ORIGIN_X, BOUNDS_ORIGIN_Y, AREA_WIDTH, AREA_HEIGHT)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });

  container.add(inputZone);

  let previousPosition: PositionSnapshot | null = null;

  const refreshFromRoomState = (nextRoom: Room<DoomscrollsRoomState>): void => {
    const zoneId = nextRoom.state.zoneId;
    const bounds = resolveWorldAreaBounds(zoneId);

    drawBounds(frame);
    boundsLabel.setText(
      `zone=${zoneId} bounds: x=${bounds.minX}..${bounds.maxX}, y=${bounds.minY}..${bounds.maxY}`,
    );

    inputZone.removeAllListeners();
    inputZone.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      const localX = Phaser.Math.Clamp(pointer.x - BOUNDS_ORIGIN_X, 0, AREA_WIDTH);
      const localY = Phaser.Math.Clamp(pointer.y - BOUNDS_ORIGIN_Y, 0, AREA_HEIGHT);
      const worldX = bounds.minX + (localX / AREA_WIDTH) * (bounds.maxX - bounds.minX);
      const worldY = bounds.minY + (localY / AREA_HEIGHT) * (bounds.maxY - bounds.minY);
      sendMovementIntent(nextRoom, Math.round(worldX), Math.round(worldY));
    });

    const presence = getTownRoomPresence(nextRoom.state as unknown as Record<string, unknown>);
    const self = presence?.players.find((player) => player.sessionId === nextRoom.sessionId) ?? null;

    if (self?.position === undefined) {
      marker.setPosition(-9999, -9999);
      positionLabel.setText(t("world_area.no_position"));
      statusLabel.setText("");
      previousPosition = null;
      return;
    }

    const { x, y } = self.position;
    const pixelX = BOUNDS_ORIGIN_X + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * AREA_WIDTH;
    const pixelY = BOUNDS_ORIGIN_Y + ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * AREA_HEIGHT;

    marker.setPosition(pixelX, pixelY);
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
    destroy: () => {
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