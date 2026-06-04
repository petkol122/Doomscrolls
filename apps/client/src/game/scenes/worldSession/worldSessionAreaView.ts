import type { Room } from "@colyseus/sdk";
import { t } from "@doomscrolls/localization";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import Phaser from "phaser";

import { sendMovementIntent } from "../../../net/movementIntentClient";
import { sendInteractIntent } from "../../../net/interactIntentClient";
import { sendAttackIntent } from "../../../net/attackIntentClient";
import { sendPickupWorldLootIntent } from "../../../net/pickupWorldLootClient";
import { getTownRoomPresence } from "../../../net/townRoomPresence";
import {
  defaultWorldProjection,
  screenToWorldActiveProjection,
  worldToScreenActiveProjection,
  type WorldProjectionMode,
  type WorldProjectionBounds,
  type WorldProjectionViewport,
} from "../../worldProjection";
import { resolveWorldAreaBounds } from "../accountShell/resolveWorldAreaBounds";
import { resolveWorldSessionAreaLayout, type WorldSessionAreaLayout } from "./worldSessionAreaLayout";
import { createWorldSessionPlayerPlaceholderView } from "./worldSessionPlayerPlaceholderView";
import { createWorldSessionInteractablesView } from "./worldSessionInteractablesView";
import { createWorldSessionEnemyPlaceholderView } from "./worldSessionEnemyPlaceholderView";
import {
  getTownRoomEnemies,
  type TownRoomEnemySnapshot,
} from "../../../net/townRoomEnemies";
import {
  getTownRoomWorldLoot,
  type TownRoomWorldLootSnapshot,
} from "../../../net/townRoomWorldLoot";
import type { WorldSessionEnemyPlaceholderView } from "./worldSessionEnemyPlaceholderView";
import {
  createWorldSessionLootPlaceholderView,
  type WorldSessionLootPlaceholderView,
} from "./worldSessionLootPlaceholderView";
import {
  createFloatingDamageNumberView,
  type FloatingDamageNumberView,
} from "./floatingDamageNumberView";

interface PositionSnapshot {
  readonly x: number;
  readonly y: number;
}

interface ClickTargetSnapshot {
  readonly x: number;
  readonly y: number;
}

interface AreaProjectionContext {
  readonly bounds: WorldProjectionBounds;
  readonly viewport: WorldProjectionViewport;
  readonly projectionMode: WorldProjectionMode;
}

export interface WorldSessionDebugState {
  readonly lastClickTarget: ClickTargetSnapshot | null;
  readonly projectionMode: WorldProjectionMode;
  readonly isMovementInputEnabled: boolean;
  readonly zoom: number;
}

export interface WorldSessionAreaView {
  readonly refreshFromRoomState: (room: Room<DoomscrollsRoomState>) => void;
  readonly getDebugState: () => WorldSessionDebugState;
  readonly setProjectionMode: (mode: WorldProjectionMode) => void;
  readonly showEnemyFloatingDamage: (enemyId: string, text: string) => void;
  readonly showPlayerFloatingDamage: (text: string) => void;
  readonly showEnemyTelegraph: (enemyId: string) => void;
  readonly getSelfWorldPosition: () => { readonly x: number; readonly y: number } | null;
  readonly getLastClickTarget: () => ClickTargetSnapshot | null;
  readonly destroy: () => void;
}

export function createWorldSessionAreaView(
  scene: Phaser.Scene,
  room: Room<DoomscrollsRoomState>,
  onAttackFeedback?: (message: string) => void,
  onPickupFeedback?: (message: string) => void,
  onDebugStateChange?: () => void,
): WorldSessionAreaView {
  const layout = resolveWorldSessionAreaLayout(scene);
  const container = scene.add.container(0, 0);
  const frame = scene.add.graphics();
  const playerPlaceholder = createWorldSessionPlayerPlaceholderView(scene);
  const interactablesView = createWorldSessionInteractablesView(scene, layout, (objectId) => {
    pointerHandledByTarget = true;
    sendInteractIntent(room, objectId);
    const roomState = room.state as any;
    if (roomState?.interactables) {
      const targetInteractable = roomState.interactables.get(objectId);
      if (targetInteractable) {
        lastClickTarget = { x: targetInteractable.x, y: targetInteractable.y };
        onDebugStateChange?.();
      }
    }
  });

  const enemyPlaceholders = new Map<string, WorldSessionEnemyPlaceholderView>();
  const lootPlaceholders = new Map<string, WorldSessionLootPlaceholderView>();
  const floatingDamageView: FloatingDamageNumberView = createFloatingDamageNumberView(scene);
  const enemyScreenPositions = new Map<string, { readonly x: number; readonly y: number }>();

  const targetMarker = scene.add.circle(-9999, -9999, 7, 0xff4a4a, 0.8);
  const targetLabel = scene.add.text(layout.originX + 10, layout.originY + layout.height - 20, "", {
    color: "#ff4a4a",
    fontFamily: "Arial, sans-serif",
    fontSize: "12px",
  });
  const lineGraphic = scene.add.graphics();
  lineGraphic.lineStyle(1, 0xffffff, 0.5);
  const title = scene.add.text(layout.originX, layout.originY - 28, t("world_area.title"), {
    color: "#d8c6a3",
    fontFamily: "Arial, sans-serif",
    fontSize: "16px",
    fontStyle: "bold",
  });
  const instruction = scene.add.text(
    layout.originX + 10,
    layout.originY + layout.height - 40,
    t("world_area.click_instruction"),
    {
      color: "#8d7958",
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
    },
  );
  const boundsLabel = scene.add.text(layout.originX + 10, layout.originY + 10, "", {
    color: "#a88d63",
    fontFamily: "Arial, sans-serif",
    fontSize: "11px",
  });
  const positionLabel = scene.add.text(layout.originX + 10, layout.originY + 28, "", {
    color: "#b9d49a",
    fontFamily: "Arial, sans-serif",
    fontSize: "12px",
  });
  const statusLabel = scene.add.text(layout.originX + 10, layout.originY + 46, "", {
    color: "#8fb0d8",
    fontFamily: "Arial, sans-serif",
    fontSize: "12px",
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
    .zone(layout.originX, layout.originY, layout.width, layout.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });

  container.add(inputZone);

  // The interactive target zones (enemy / loot / interactable) live on top
  // of `inputZone` in the container, so Phaser's input manager fires their
  // pointerdown handlers before the inputZone's. We set this flag from
  // those handlers and the inputZone handler short-circuits when it is set.
  let pointerHandledByTarget = false;

  let previousPosition: PositionSnapshot | null = null;
  let lastClickTarget: ClickTargetSnapshot | null = null;
  let projectionMode: WorldProjectionMode = defaultWorldProjection;
  let selfScreenPosition: { readonly x: number; readonly y: number } | null = null;
  let cameraZoom = 1;
  const minZoom = 0.75;
  const maxZoom = 1.6;
  let selfWorldPosition: { readonly x: number; readonly y: number } | null = null;
  const previousEnemyHp = new Map<string, number>();
  const previousEnemyDefeated = new Map<string, boolean>();
  const previousEnemyRespawnAtMs = new Map<string, number>();

  const clampZoom = (value: number): number => Math.min(Math.max(value, minZoom), maxZoom);
  const setZoom = (value: number): void => {
    const nextZoom = clampZoom(value);
    if (nextZoom === cameraZoom) {
      return;
    }
    cameraZoom = nextZoom;
    refreshFromRoomState(room);
    onDebugStateChange?.();
  };

  scene.input.on(Phaser.Input.Events.POINTER_WHEEL, (_pointer: Phaser.Input.Pointer, _currentlyOver: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
    const step = deltaY > 0 ? -0.1 : 0.1;
    setZoom(cameraZoom + step);
  });

  const keyboard = scene.input.keyboard;
  if (keyboard !== null) {
    const zoomInKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_ADD),
    ];
    const zoomOutKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_SUBTRACT),
    ];
    for (const key of zoomInKeys) {
      key.on("down", () => setZoom(cameraZoom + 0.1));
    }
    for (const key of zoomOutKeys) {
      key.on("down", () => setZoom(cameraZoom - 0.1));
    }
  }

  const computeFollowViewport = (
    baseProjection: AreaProjectionContext,
    selfX: number,
    selfY: number,
  ): WorldProjectionViewport => {
    const boundsWidth = baseProjection.bounds.maxX - baseProjection.bounds.minX;
    const boundsHeight = baseProjection.bounds.maxY - baseProjection.bounds.minY;
    if (boundsWidth <= 0 || boundsHeight <= 0) {
      return baseProjection.viewport;
    }
    const viewportCenterX = layout.originX + layout.width / 2;
    const viewportCenterY = layout.originY + layout.height / 2;
    return {
      ...baseProjection.viewport,
      originX: viewportCenterX - ((selfX - baseProjection.bounds.minX) / boundsWidth) * layout.width,
      originY: viewportCenterY - ((selfY - baseProjection.bounds.minY) / boundsHeight) * layout.height,
    };
  };

  const refreshFromRoomState = (nextRoom: Room<DoomscrollsRoomState>): void => {
    const zoneId = typeof nextRoom.state?.zoneId === "string" && nextRoom.state.zoneId.length > 0
      ? nextRoom.state.zoneId
      : "nightmarket";
    const bounds = resolveWorldAreaBounds(zoneId);
    const presence = getTownRoomPresence(nextRoom.state as unknown as Record<string, unknown>);
    const self = presence?.players.find((player) => player.sessionId === nextRoom.sessionId) ?? null;
    const currentFocusPosition = self?.position === undefined
      ? selfWorldPosition
      : { x: self.position.x, y: self.position.y };
    const projection = createAreaProjectionContext(layout, bounds, projectionMode, currentFocusPosition, cameraZoom);

    // Camera follow: shift the viewport origin so the player's world
    // position maps to the centre pixel of the layout area. All world
    // entities are then rendered relative to this shifted viewport, so
    // the world scrolls around the player. While the self position is
    // unknown, fall back to the raw layout viewport.
    const followViewport: WorldProjectionViewport = currentFocusPosition === null
      ? projection.viewport
      : computeFollowViewport(projection, currentFocusPosition.x, currentFocusPosition.y);
    const followProjection: AreaProjectionContext = {
      ...projection,
      viewport: followViewport,
    };

    drawBounds(frame, layout);
    boundsLabel.setText(
      `zone=${zoneId} bounds: x=${bounds.minX}..${bounds.maxX}, y=${bounds.minY}..${bounds.maxY}`,
    );

    interactablesView.refresh(nextRoom, followProjection);

    const currentEnemies = getTownRoomEnemies(nextRoom.state);
    const projectedEnemies = currentEnemies
      .map((enemy: TownRoomEnemySnapshot) => projectEnemyToArea(enemy, followProjection))
      .filter((enemy: TownRoomEnemySnapshot | null): enemy is TownRoomEnemySnapshot => enemy !== null);
    const newEnemyIds = new Set(projectedEnemies.map((enemy: TownRoomEnemySnapshot) => enemy.id));

    for (const [id, view] of enemyPlaceholders.entries()) {
      if (!newEnemyIds.has(id)) {
        view.destroy();
        enemyPlaceholders.delete(id);
        enemyScreenPositions.delete(id);
      }
    }

    for (const enemy of projectedEnemies) {
      let enemyView = enemyPlaceholders.get(enemy.id);
      if (enemyView === undefined) {
        enemyView = createWorldSessionEnemyPlaceholderView(scene, enemy, (enemyId) => {
          pointerHandledByTarget = true;
          const result = sendAttackIntent(nextRoom, enemyId);
          if (result.dispatched) {
            onAttackFeedback?.(t("world_area.attack_sent"));
          }
          const targetEnemy = getTownRoomEnemies(nextRoom.state).find((e) => e.id === enemyId);
          if (targetEnemy) {
            lastClickTarget = { x: targetEnemy.x, y: targetEnemy.y };
            onDebugStateChange?.();
          }
        });
        enemyPlaceholders.set(enemy.id, enemyView);
      } else {
        enemyView.refresh(enemy);
      }

      enemyScreenPositions.set(enemy.id, { x: enemy.x, y: enemy.y });

      const lastHp = previousEnemyHp.get(enemy.id);
      const lastDefeated = previousEnemyDefeated.get(enemy.id);
      const lastRespawnAtMs = previousEnemyRespawnAtMs.get(enemy.id);
      if (lastHp !== undefined && lastHp !== enemy.hp) {
        onAttackFeedback?.(
          enemy.defeated
            ? t("world_area.enemy_defeated")
            : t("world_area.enemy_hp_synced", {
                hp: enemy.hp,
                maxHp: enemy.maxHp,
              }),
        );
      }
      if (lastDefeated !== true && enemy.defeated) {
        const remainingSeconds = Math.max(0, Math.ceil((enemy.respawnAtMs - Date.now()) / 1000));
        onAttackFeedback?.(
          t("world_area.enemy_defeated_respawn", {
            seconds: remainingSeconds,
          }),
        );
      }
      if (
        lastDefeated === true &&
        enemy.defeated === false &&
        lastRespawnAtMs !== undefined &&
        lastRespawnAtMs > 0
      ) {
        onAttackFeedback?.(t("world_area.enemy_respawned"));
      }
      previousEnemyHp.set(enemy.id, enemy.hp);
      previousEnemyDefeated.set(enemy.id, enemy.defeated);
      previousEnemyRespawnAtMs.set(enemy.id, enemy.respawnAtMs);
    }

    const currentWorldLoot = getTownRoomWorldLoot(nextRoom.state);
    const projectedWorldLoot = currentWorldLoot
      .map((loot: TownRoomWorldLootSnapshot) => projectWorldLootToArea(loot, followProjection))
      .filter((loot: TownRoomWorldLootSnapshot | null): loot is TownRoomWorldLootSnapshot => loot !== null);
    const newWorldLootIds = new Set(projectedWorldLoot.map((loot: TownRoomWorldLootSnapshot) => loot.id));

    for (const [id, view] of lootPlaceholders.entries()) {
      if (!newWorldLootIds.has(id)) {
        view.destroy();
        lootPlaceholders.delete(id);
      }
    }

    for (const loot of projectedWorldLoot) {
      const existing = lootPlaceholders.get(loot.id);
      if (existing === undefined) {
        lootPlaceholders.set(
          loot.id,
          createWorldSessionLootPlaceholderView(scene, loot, (worldLootId) => {
            pointerHandledByTarget = true;
            const result = sendPickupWorldLootIntent(nextRoom, worldLootId);
            if (result.dispatched) {
              onPickupFeedback?.(t("world_area.pickup_sent"));
            }
            const targetLoot = getTownRoomWorldLoot(nextRoom.state).find((l) => l.id === worldLootId);
            if (targetLoot) {
              lastClickTarget = { x: targetLoot.x, y: targetLoot.y };
              onDebugStateChange?.();
            }
          }),
        );
      } else {
        existing.refresh(loot);
      }
    }

    inputZone.removeAllListeners();
    inputZone.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (projectionMode !== "debug_top_down") {
        return;
      }

      // Enemy / loot / interactable click handlers fire before this one
      // (they sit on top of inputZone in the container). If one of them
      // already handled the click we must not also send a movement intent.
      if (pointerHandledByTarget) {
        pointerHandledByTarget = false;
        return;
      }

      const localX = pointer.x - layout.originX;
      const localY = pointer.y - layout.originY;
      if (localX < 0 || localY < 0 || localX > layout.width || localY > layout.height) {
        return;
      }

      const screenPoint = screenToWorldActiveProjection(
        pointer.x,
        pointer.y,
        projection.bounds,
        followViewport,
        projectionMode,
      );
      const worldX = screenPoint.x;
      const worldY = screenPoint.y;
      lastClickTarget = { x: Math.round(worldX), y: Math.round(worldY) };
      onDebugStateChange?.();
      sendMovementIntent(nextRoom, lastClickTarget.x, lastClickTarget.y);
    });

    if (self?.position === undefined) {
      playerPlaceholder.hide();
      targetMarker.setPosition(-9999, -9999);
      targetLabel.setText("");
      lineGraphic.clear();
      positionLabel.setText(t("world_area.no_position"));
      statusLabel.setText("");
      previousPosition = null;
      selfWorldPosition = null;
      return;
    }

    const { x, y } = self.position;
    selfWorldPosition = { x, y };
    const playerScreenPosition = worldToScreenActiveProjection(
      x,
      y,
      projection.bounds,
      followViewport,
      projectionMode,
    );
    const pixelX = playerScreenPosition.x;
    const pixelY = playerScreenPosition.y;
    selfScreenPosition = { x: pixelX, y: pixelY };

    playerPlaceholder.setPosition(pixelX, pixelY);

    if (lastClickTarget) {
      const targetScreenPosition = worldToScreenActiveProjection(
        lastClickTarget.x,
        lastClickTarget.y,
        projection.bounds,
        followViewport,
        projectionMode,
      );
      const targetPixelX = targetScreenPosition.x;
      const targetPixelY = targetScreenPosition.y;
      targetMarker.setPosition(targetPixelX, targetPixelY);
      targetLabel.setText(`Target: ${lastClickTarget.x}, ${lastClickTarget.y} (non-auth)`);
      lineGraphic.clear();
      lineGraphic.lineStyle(1, 0xffffff, 0.5);
      lineGraphic.lineBetween(pixelX, pixelY, targetPixelX, targetPixelY);

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

  const setProjectionMode = (mode: WorldProjectionMode): void => {
    if (projectionMode === mode) {
      return;
    }

    projectionMode = mode;
    refreshFromRoomState(room);
    onDebugStateChange?.();
  };

  const showEnemyFloatingDamage = (enemyId: string, text: string): void => {
    const screenPos = enemyScreenPositions.get(enemyId);
    if (screenPos === undefined) {
      return;
    }
    floatingDamageView.show(screenPos.x, screenPos.y - 18, text);
  };

  const showPlayerFloatingDamage = (text: string): void => {
    if (selfScreenPosition === null) {
      return;
    }
    floatingDamageView.show(selfScreenPosition.x, selfScreenPosition.y - 18, text);
  };

  const showEnemyTelegraph = (enemyId: string): void => {
    const view = enemyPlaceholders.get(enemyId);
    if (view === undefined) {
      return;
    }
    view.setTelegraphing(true);
  };

  return {
    refreshFromRoomState,
    getDebugState: () => ({
      lastClickTarget,
      projectionMode,
      isMovementInputEnabled: projectionMode === "debug_top_down",
      zoom: cameraZoom,
    }),
    setProjectionMode,
    showEnemyFloatingDamage,
    showPlayerFloatingDamage,
    showEnemyTelegraph,
    getSelfWorldPosition: () => selfWorldPosition,
    getLastClickTarget: () => lastClickTarget,
    destroy: () => {
      scene.input.off(Phaser.Input.Events.POINTER_WHEEL);
      playerPlaceholder.destroy();
      interactablesView.destroy();
      for (const view of enemyPlaceholders.values()) {
        view.destroy();
      }
      enemyPlaceholders.clear();
      enemyScreenPositions.clear();
      for (const view of lootPlaceholders.values()) {
        view.destroy();
      }
      lootPlaceholders.clear();
      floatingDamageView.destroy();
      selfScreenPosition = null;
      container.destroy(true);
    },
  };
}

function projectWorldLootToArea(
  loot: TownRoomWorldLootSnapshot,
  projection: AreaProjectionContext,
): TownRoomWorldLootSnapshot | null {
  const width = projection.bounds.maxX - projection.bounds.minX;
  const height = projection.bounds.maxY - projection.bounds.minY;

  if (width <= 0 || height <= 0) {
    return null;
  }

  const normalizedX = (loot.x - projection.bounds.minX) / width;
  const normalizedY = (loot.y - projection.bounds.minY) / height;

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
    ...loot,
    ...worldToScreenActiveProjection(
      loot.x,
      loot.y,
      projection.bounds,
      projection.viewport,
      projection.projectionMode,
    ),
  };
}

function projectEnemyToArea(
  enemy: TownRoomEnemySnapshot,
  projection: AreaProjectionContext,
): TownRoomEnemySnapshot | null {
  const width = projection.bounds.maxX - projection.bounds.minX;
  const height = projection.bounds.maxY - projection.bounds.minY;

  if (width <= 0 || height <= 0) {
    return null;
  }

  const normalizedX = (enemy.x - projection.bounds.minX) / width;
  const normalizedY = (enemy.y - projection.bounds.minY) / height;

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
    ...worldToScreenActiveProjection(
      enemy.x,
      enemy.y,
      projection.bounds,
      projection.viewport,
      projection.projectionMode,
    ),
  };
}

function createAreaProjectionContext(
  layout: WorldSessionAreaLayout,
  bounds: WorldProjectionBounds,
  projectionMode: WorldProjectionMode,
  focusPosition: { readonly x: number; readonly y: number } | null,
  zoom: number,
): AreaProjectionContext {
  const clampedZoom = Math.min(Math.max(zoom, 0.75), 1.6);
  const fullWidth = bounds.maxX - bounds.minX;
  const fullHeight = bounds.maxY - bounds.minY;
  const visibleWidth = fullWidth / clampedZoom;
  const visibleHeight = fullHeight / clampedZoom;
  const desiredCenterX = focusPosition?.x ?? (bounds.minX + bounds.maxX) / 2;
  const desiredCenterY = focusPosition?.y ?? (bounds.minY + bounds.maxY) / 2;
  const minCenterX = bounds.minX + visibleWidth / 2;
  const maxCenterX = bounds.maxX - visibleWidth / 2;
  const minCenterY = bounds.minY + visibleHeight / 2;
  const maxCenterY = bounds.maxY - visibleHeight / 2;
  const centerX = Math.min(Math.max(desiredCenterX, minCenterX), maxCenterX);
  const centerY = Math.min(Math.max(desiredCenterY, minCenterY), maxCenterY);
  const cameraBounds: WorldProjectionBounds = {
    minX: centerX - visibleWidth / 2,
    maxX: centerX + visibleWidth / 2,
    minY: centerY - visibleHeight / 2,
    maxY: centerY + visibleHeight / 2,
  };

  return {
    bounds: cameraBounds,
    projectionMode,
    viewport: {
      originX: layout.originX,
      originY: layout.originY,
      width: layout.width,
      height: layout.height,
    },
  };
}

function drawBounds(graphics: Phaser.GameObjects.Graphics, layout: WorldSessionAreaLayout): void {
  graphics.clear();
  graphics.fillStyle(0x1a1510, 1);
  graphics.fillRect(layout.originX, layout.originY, layout.width, layout.height);
  graphics.lineStyle(2, 0x5f4a2f, 1);
  graphics.strokeRect(layout.originX, layout.originY, layout.width, layout.height);
}
