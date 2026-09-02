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
 * Task 197 — Added vendor rendering (purple NPC-like).
 * Task 205 — Added town_service rendering (teal NPC-like).
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
  readonly updateProjection: (
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
  ) => { readonly objectId: string; readonly objectType: string; readonly worldX: number; readonly worldY: number } | null;
  // Task 314 — set the hovered interactable object ID for highlight feedback.
  readonly setHoveredObject: (objectId: string | null) => void;
  readonly getHoveredObject: () => string | null;
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
  const objectTypes = new Map<string, string>();
  const openedStates = new Map<string, boolean>();
  const objectLabels = new Map<string, string>();
  const hitAreas = new Map<
    string,
    { readonly screenX: number; readonly screenY: number; readonly worldX: number; readonly worldY: number }
  >();
  let screenOffsetX = 0;
  let screenOffsetY = 0;

  const clearAll = (): void => {
    graphicsObjects.forEach((g) => g.destroy());
    labelTexts.forEach((t) => t.destroy());
    graphicsObjects.clear();
    labelTexts.clear();
    objectTypes.clear();
    openedStates.clear();
    objectLabels.clear();
    hitAreas.clear();
  };

  const drawInteractableGraphic = (
    graphic: Phaser.GameObjects.Graphics,
    objectType: string,
    pixelX: number,
    pixelY: number,
    opened: boolean,
  ): void => {
    graphic.clear();
    if (objectType === "vendor") {
      graphic.fillStyle(0x7a4a8a, 0.9);
      graphic.fillRect(pixelX - 12, pixelY - 16, 24, 32);
      graphic.lineStyle(2, 0x5a2a6a, 0.9);
      graphic.strokeRect(pixelX - 12, pixelY - 16, 24, 32);
      return;
    }
    if (objectType === "town_service") {
      graphic.fillStyle(0x2f7a7a, 0.9);
      graphic.fillRect(pixelX - 12, pixelY - 16, 24, 32);
      graphic.lineStyle(2, 0x1f5a5a, 0.9);
      graphic.strokeRect(pixelX - 12, pixelY - 16, 24, 32);
      return;
    }
    if (objectType === "combat_return_gate") {
      graphic.fillStyle(0x5f8fda, 0.92);
      graphic.fillCircle(pixelX, pixelY, 15);
      graphic.lineStyle(3, 0xd6ecff, 0.95);
      graphic.strokeCircle(pixelX, pixelY, 19);
      graphic.lineStyle(2, 0x284f7d, 0.95);
      graphic.strokeCircle(pixelX, pixelY, 11);
      return;
    }
    if (objectType === "loot_container") {
      if (opened) {
        graphic.fillStyle(0x5a4a3a, 0.8);
        graphic.fillRect(pixelX - 10, pixelY - 6, 20, 12);
        graphic.lineStyle(1, 0x3a2a1a, 0.9);
        graphic.strokeRect(pixelX - 10, pixelY - 6, 20, 12);
      } else {
        graphic.fillStyle(0xc8a84a, 0.9);
        graphic.fillRect(pixelX - 12, pixelY - 10, 24, 20);
        graphic.lineStyle(1, 0x8a7a2a, 0.9);
        graphic.strokeRect(pixelX - 12, pixelY - 10, 24, 20);
      }
      return;
    }
    graphic.fillStyle(0xa8873f, 0.8);
    graphic.fillRect(pixelX - 8, pixelY - 8, 16, 16);
    graphic.lineStyle(1, 0x6b5a2e, 0.9);
    graphic.strokeRect(pixelX - 8, pixelY - 8, 16, 16);
  };

  const resolveDisplayLabel = (objectType: string, label: string, opened: boolean): string => {
    if (objectType === "loot_container" && opened) {
      return "Empty";
    }
    return label;
  };

  const refresh = (
    room: Room<RoomState>,
    projection: {
      readonly bounds: WorldProjectionBounds;
      readonly viewport: WorldProjectionViewport;
      readonly projectionMode: WorldProjectionMode;
    },
  ): void => {
    clearAll();

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

      const graphic = scene.add.graphics();
      drawInteractableGraphic(graphic, objectType, pixelX, pixelY, opened);
      container.add(graphic);
      graphicsObjects.set(objectId, graphic);
      objectTypes.set(objectId, objectType);
      openedStates.set(objectId, opened);
      objectLabels.set(objectId, label);

      const displayLabel = resolveDisplayLabel(objectType, label, opened);
      const labelText = scene.add.text(pixelX + 14, pixelY - 14, displayLabel, {
        color: "#d8c6a3",
        fontFamily: "Arial, sans-serif",
        fontSize: "10px",
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

  const updateProjection = (
    room: Room<RoomState>,
    projection: {
      readonly bounds: WorldProjectionBounds;
      readonly viewport: WorldProjectionViewport;
      readonly projectionMode: WorldProjectionMode;
    },
  ): void => {
    const state = room.state as unknown as Record<string, unknown>;
    const interactables = state.interactables as
      | { forEach: (fn: (value: Record<string, unknown>, key: string) => void) => void }
      | undefined;

    if (!interactables) {
      return;
    }

    interactables.forEach((value) => {
      const objectId = String(value.id ?? "");
      const x = typeof value.x === "number" ? value.x : 0;
      const y = typeof value.y === "number" ? value.y : 0;
      const opened = typeof value.opened === "boolean" ? value.opened : false;
      const objectType = String(value.type ?? objectTypes.get(objectId) ?? "");
      const label = String(value.label ?? objectLabels.get(objectId) ?? "Object");
      const projectedPosition = worldToScreenActiveProjection(
        x,
        y,
        projection.bounds,
        projection.viewport,
        projection.projectionMode,
      );
      const pixelX = projectedPosition.x;
      const pixelY = projectedPosition.y;

      const graphic = graphicsObjects.get(objectId);
      if (graphic !== undefined) {
        drawInteractableGraphic(graphic, objectType, pixelX, pixelY, opened);
      }

      const labelText = labelTexts.get(objectId);
      if (labelText !== undefined) {
        labelText.setPosition(pixelX + 14, pixelY - 14);
        labelText.setText(resolveDisplayLabel(objectType, label, opened));
      }

      objectTypes.set(objectId, objectType);
      openedStates.set(objectId, opened);
      objectLabels.set(objectId, label);
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
  ): { readonly objectId: string; readonly objectType: string; readonly worldX: number; readonly worldY: number } | null => {
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
      objectType: objectTypes.get(closestHit.objectId) ?? "",
      worldX: closestHit.worldX,
      worldY: closestHit.worldY,
    };
  };

  let hoveredObjectId: string | null = null;

  const setHoveredObject = (objectId: string | null): void => {
    // Clear previous hover highlight
    if (hoveredObjectId !== null && hoveredObjectId !== objectId) {
      const prevGraphic = graphicsObjects.get(hoveredObjectId);
      if (prevGraphic !== undefined) {
        prevGraphic.clear();
        // Redraw the graphic without hover highlight — we rely on the next
        // refresh() call to fully redraw, so we just do a simple clear here.
        hoveredObjectId = null;
      }
    }
    hoveredObjectId = objectId;
  };

  const getHoveredObject = (): string | null => hoveredObjectId;

  return {
    refresh,
    updateProjection,
    findClickedInteractable,
    setHoveredObject,
    getHoveredObject,
    setScreenOffset: (x: number, y: number) => {
      screenOffsetX = x;
      screenOffsetY = y;
    },
    destroy: () => {
      clearAll();
      container.destroy(true);
    },
  };
}
