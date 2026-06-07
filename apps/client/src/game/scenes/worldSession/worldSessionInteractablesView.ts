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
 * Task 180 — Added loot container rendering with opened state.
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
  readonly setScreenOffset: (x: number, y: number) => void;
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
  let screenOffsetX = 0;
  let screenOffsetY = 0;

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
      const opened = typeof value.opened === "boolean" ? value.opened : false;

      const projectedPosition = worldToScreenActiveProjection(
        x,
        y,
        projection.bounds,
        projection.viewport,
        projection.projectionMode,
      );
      const pixelX = projectedPosition.x;
      const pixelY = projectedPosition.y;

      // Task 197 — Vendor placeholder (purple, larger, NPC-like)
      const graphic = scene.add.graphics();
      if (objectType === "vendor") {
        graphic.fillStyle(0x7a4a8a, 0.9);
        graphic.fillRect(pixelX - 12, pixelY - 16, 24, 32);
        graphic.lineStyle(2, 0x5a2a6a, 0.9);
        graphic.strokeRect(pixelX - 12, pixelY - 16, 24, 32);
      } else if (objectType === "loot_container") {
        if (opened) {
          // Opened container - grey/dark color, smaller
          graphic.fillStyle(0x5a4a3a, 0.8);
          graphic.fillRect(pixelX - 10, pixelY - 6, 20, 12);
          graphic.lineStyle(1, 0x3a2a1a, 0.9);
          graphic.strokeRect(pixelX - 10, pixelY - 6, 20, 12);
        } else {
          // Unopened container - golden/bronze color, larger
          graphic.fillStyle(0xc8a84a, 0.9);
          graphic.fillRect(pixelX - 12, pixelY - 10, 24, 20);
          graphic.lineStyle(1, 0x8a7a2a, 0.9);
          graphic.strokeRect(pixelX - 12, pixelY - 10, 24, 20);
        }
      } else {
        // Default square placeholder for other interactables
        graphic.fillStyle(0xa8873f, 0.8); // Gold-ish color for objects
        graphic.fillRect(pixelX - 8, pixelY - 8, 16, 16);
        graphic.lineStyle(1, 0x6b5a2e, 0.9);
        graphic.strokeRect(pixelX - 8, pixelY - 8, 16, 16);
      }
      container.add(graphic);
      graphicsObjects.set(objectId, graphic);

      // Draw label - show different label for opened containers
      let displayLabel = label;
      if (objectType === "loot_container" && opened) {
        displayLabel = "Empty";
      }
      const labelText = scene.add.text(pixelX + 14, pixelY - 14, displayLabel, {
        color: "#d8c6a3",
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
      });
      container.add(labelText);
      labelTexts.set(objectId, labelText);

      hitAreas.set(objectId, {
        screenX: pixelX + screenOffsetX,
        screenY: pixelY + screenOffsetY,
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
    setScreenOffset: (x: number, y: number) => {
      screenOffsetX = x;
      screenOffsetY = y;
    },
    destroy: () => {
      graphicsObjects.forEach((g) => g.destroy());
      labelTexts.forEach((t) => t.destroy());
      hitAreas.clear();
      container.destroy(true);
    },
  };
}
