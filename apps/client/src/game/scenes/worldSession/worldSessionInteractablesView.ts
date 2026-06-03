import Phaser from "phaser";
import type { RoomState } from "@doomscrolls/shared";
import type { Room } from "@colyseus/sdk";

/**
 * Task 057 — Interactable Object Foundation Batch
 *
 * Render interactable objects as simple placeholder shapes + labels.
 * Handle click to send interact intent.
 */
export interface WorldSessionInteractablesView {
  readonly refresh: (room: Room<RoomState>) => void;
  readonly destroy: () => void;
}

const BOUNDS_ORIGIN_X = 84;
const BOUNDS_ORIGIN_Y = 84;
const AREA_WIDTH = 800;
const AREA_HEIGHT = 600;

export function createWorldSessionInteractablesView(
  scene: Phaser.Scene,
  onInteractClick: (objectId: string) => void,
): WorldSessionInteractablesView {
  const container = scene.add.container(0, 0);
  const graphicsObjects = new Map<string, Phaser.GameObjects.Graphics>();
  const labelTexts = new Map<string, Phaser.GameObjects.Text>();
  const clickZones = new Map<string, Phaser.Input.Keyboard.Key>();

  const refresh = (room: Room<RoomState>): void => {
    // Clear existing objects
    graphicsObjects.forEach((g) => g.destroy());
    labelTexts.forEach((t) => t.destroy());
    clickZones.forEach((z) => z.destroy?.());
    graphicsObjects.clear();
    labelTexts.clear();
    clickZones.clear();

    // Get room state - check if it has interactables
    const state = room.state as unknown as Record<string, unknown>;
    const interactables = state.interactables as
      | { forEach: (fn: (value: Record<string, unknown>, key: string) => void) => void }
      | undefined;

    if (!interactables) {
      return;
    }

    // Get zone bounds for coordinate mapping (reuse from area view logic)
    const defaultBounds = { minX: 0, maxX: 800, minY: 0, maxY: 600 };
    const bounds = defaultBounds; // In a real scenario, resolve from content

    interactables.forEach((value) => {
      const objectId = String(value.id ?? "");
      const objectType = String(value.type ?? "");
      const label = String(value.label ?? "Object");
      const x = typeof value.x === "number" ? value.x : 0;
      const y = typeof value.y === "number" ? value.y : 0;

      // Map world coordinates to pixel coordinates
      const pixelX = BOUNDS_ORIGIN_X + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * AREA_WIDTH;
      const pixelY = BOUNDS_ORIGIN_Y + ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * AREA_HEIGHT;

      // Draw a simple square placeholder for the object
      const graphic = scene.add.graphics();
      graphic.fillStyle(0xa8873f, 0.8); // Gold-ish color for objects
      graphic.fillRect(pixelX - 8, pixelY - 8, 16, 16);
      graphic.lineStyle(1, 0x6b5a2e, 0.9);
      graphic.strokeRect(pixelX - 8, pixelY - 8, 16, 16);
      container.add(graphic);
      graphicsObjects.set(objectId, graphic);

      // Draw label
      const labelText = scene.add.text(pixelX + 12, pixelY - 12, label, {
        color: "#d8c6a3",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
      });
      container.add(labelText);
      labelTexts.set(objectId, labelText);

      // Create a clickable zone
      const clickZone = scene.add.zone(pixelX, pixelY, 32, 32).setInteractive();
      (clickZone as Phaser.GameObjects.Zone & { onClickCallback?: () => void }).setData(
        "objectId",
        objectId,
      );

      clickZone.on("pointerdown", () => {
        onInteractClick(objectId);
      });

      container.add(clickZone);
      clickZones.set(objectId, clickZone as unknown as Phaser.Input.Keyboard.Key);
    });
  };

  return {
    refresh,
    destroy: () => {
      graphicsObjects.forEach((g) => g.destroy());
      labelTexts.forEach((t) => t.destroy());
      clickZones.forEach((z) => (z as unknown as Phaser.GameObjects.Zone).destroy?.());
      container.destroy(true);
    },
  };
}
