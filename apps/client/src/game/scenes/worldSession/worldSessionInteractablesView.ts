import Phaser from "phaser";
import type { RoomState } from "@doomscrolls/shared";
import type { Room } from "@colyseus/sdk";

import {
  worldToScreenActiveProjection,
  type WorldProjectionBounds,
  type WorldProjectionMode,
  type WorldProjectionViewport,
} from "../../worldProjection";
import type { WorldSessionAreaLayout } from "./worldSessionAreaLayout";

/**
 * Task 057 — Interactable Object Foundation Batch
 *
 * Render interactable objects as simple placeholder shapes + labels.
 * Handle click to send interact intent.
 */
export interface WorldSessionInteractablesView {
  readonly refresh: (
    room: Room<RoomState>,
    projection: {
      readonly bounds: WorldProjectionBounds;
      readonly viewport: WorldProjectionViewport;
      readonly projectionMode: WorldProjectionMode;
    },
  ) => void;
  readonly findClickedInteractable: (
    pointerX: number,
    pointerY: number,
  ) => { readonly objectId: string; readonly worldX: number; readonly worldY: number } | null;
  readonly destroy: () => void;
}

export function createWorldSessionInteractablesView(
  scene: Phaser.Scene,
  layout: WorldSessionAreaLayout,
  onInteractClick: (objectId: string) => void,
  parentContainer?: Phaser.GameObjects.Container,
): WorldSessionInteractablesView {
  const container = scene.add.container(0, 0);
  parentContainer?.add(container);
  const graphicsObjects = new Map<string, Phaser.GameObjects.Graphics>();
  const labelTexts = new Map<string, Phaser.GameObjects.Text>();
  const hitAreas = new Map<
    string,
    { readonly screenX: number; readonly screenY: number; readonly worldX: number; readonly worldY: number }
  >();

  const refresh = (
    room: Room<RoomState>,
    projection: {
      readonly bounds: WorldProjectionBounds;
      readonly viewport: WorldProjectionViewport;
      readonly projectionMode: WorldProjectionMode;
    },
  ): void => {
    // Clear existing objects
    graphicsObjects.forEach((g) => g.destroy());
    labelTexts.forEach((t) => t.destroy());
    graphicsObjects.clear();
    labelTexts.clear();
    hitAreas.clear();

    // Get room state - check if it has interactables
    const state = room.state as unknown as Record<string, unknown>;
    const interactables = state.interactables as
      | { forEach: (fn: (value: Record<string, unknown>, key: string) => void) => void }
      | undefined;

    if (!interactables) {
      return;
    }

    interactables.forEach((value) => {
      const objectId = String(value.id ?? "");
      const objectType = String(value.type ?? "");
      const label = String(value.label ?? "Object");
      const x = typeof value.x === "number" ? value.x : 0;
      const y = typeof value.y === "number" ? value.y : 0;

      const projectedPosition = worldToScreenActiveProjection(
        x,
        y,
        projection.bounds,
        projection.viewport,
        projection.projectionMode,
      );
      const pixelX = projectedPosition.x;
      const pixelY = projectedPosition.y;

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

      hitAreas.set(objectId, {
        screenX: pixelX,
        screenY: pixelY,
        worldX: x,
        worldY: y,
      });
    });
  };

  const findClickedInteractable = (
    pointerX: number,
    pointerY: number,
  ): { readonly objectId: string; readonly worldX: number; readonly worldY: number } | null => {
    const hitRadiusPx = 24;
    const hitRadiusSquared = hitRadiusPx * hitRadiusPx;
    let closestHit:
      | { readonly objectId: string; readonly worldX: number; readonly worldY: number; readonly distanceSquared: number }
      | null = null;

    for (const [objectId, area] of hitAreas.entries()) {
      const dx = pointerX - area.screenX;
      const dy = pointerY - area.screenY;
      const distanceSquared = (dx * dx) + (dy * dy);
      if (distanceSquared > hitRadiusSquared) {
        continue;
      }

      if (closestHit === null || distanceSquared < closestHit.distanceSquared) {
        closestHit = {
          objectId,
          worldX: area.worldX,
          worldY: area.worldY,
          distanceSquared,
        };
      }
    }

    if (closestHit === null) {
      return null;
    }

    return {
      objectId: closestHit.objectId,
      worldX: closestHit.worldX,
      worldY: closestHit.worldY,
    };
  };

  return {
    refresh,
    findClickedInteractable,
    destroy: () => {
      graphicsObjects.forEach((g) => g.destroy());
      labelTexts.forEach((t) => t.destroy());
      hitAreas.clear();
      container.destroy(true);
    },
  };
}
