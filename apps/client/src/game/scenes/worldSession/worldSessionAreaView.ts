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
}

export interface WorldSessionAreaView {
  readonly refreshFromRoomState: (room: Room<DoomscrollsRoomState>) => void;
  readonly getDebugState: () => WorldSessionDebugState;
  readonly setProjectionMode: (mode: WorldProjectionMode) => void;
  readonly showEnemyFloatingDamage: (enemyId: string, text: string) => void;
  readonly showPlayerFloatingDamage: (text: string) => void;
  // Task 094 - show the enemy attack telegraph warning marker.
  readonly showEnemyTelegraph: (enemyId: string) => void;
  // Task 095 - expose the last server-synced self world position so
  // the dodge input helper can compute a safe unit direction. Returns
  // `null` while the self presence entry is not yet available.
  readonly getSelfWorldPosition: () => { readonly x: number; readonly y: number } | null;
  // Task 095 - expose the last debug click target the area view
  // recorded (may be `null` until the player has clicked at least
  // once in this scene).
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

  // Task 058 — Add enemy placeholder view
  const enemyPlaceholders = new Map<string, WorldSessionEnemyPlaceholderView>();
  const lootPlaceholders = new Map<string, WorldSessionLootPlaceholderView>();
  // Task 091 — Floating damage number view (visual feedback only)
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

  let previousPosition: PositionSnapshot | null = null;
  let lastClickTarget: ClickTargetSnapshot | null = null;
  let projectionMode: WorldProjectionMode = defaultWorldProjection;
  let selfScreenPosition: { readonly x: number; readonly y: number } | null = null;
  // Task 095 - latest server-synced self world position. Tracked
  // independently of screen-projection state so the dodge input
  // helper can read a stable value even before the next render.
  let selfWorldPosition: { readonly x: number; readonly y: number } | null = null;
  const previousEnemyHp = new Map<string, number>();
  const previousEnemyDefeated = new Map<string, boolean>();
  const previousEnemyRespawnAtMs = new Map<string, number>();

  const refreshFromRoomState = (nextRoom: Room<DoomscrollsRoomState>): void => {
    const zoneId = typeof nextRoom.state?.zoneId === "string" && nextRoom.state.zoneId.length > 0
      ? nextRoom.state.zoneId
      : "nightmarket";
    const bounds = resolveWorldAreaBounds(zoneId);
    const projection = createAreaProjectionContext(layout, bounds, projectionMode);

    drawBounds(frame, layout);
    boundsLabel.setText(
      `zone=${zoneId} bounds: x=${bounds.minX}..${bounds.maxX}, y=${bounds.minY}..${bounds.maxY}`,
    );

    // Task 057 — Refresh interactables view
    interactablesView.refresh(nextRoom);

    // Task 058 — Refresh enemies view
    const currentEnemies = getTownRoomEnemies(nextRoom.state);
    const projectedEnemies = currentEnemies
      .map((enemy: TownRoomEnemySnapshot) => projectEnemyToArea(enemy, projection))
      .filter((enemy: TownRoomEnemySnapshot | null): enemy is TownRoomEnemySnapshot => enemy !== null);
    const newEnemyIds = new Set(projectedEnemies.map((enemy: TownRoomEnemySnapshot) => enemy.id));

    // Remove old enemies
    for (const [id, view] of enemyPlaceholders.entries()) {
      if (!newEnemyIds.has(id)) {
        view.destroy();
        enemyPlaceholders.delete(id);
        enemyScreenPositions.delete(id);
      }
    }

    // Add or refresh new/existing enemies
    for (const enemy of projectedEnemies) {
      let enemyView = enemyPlaceholders.get(enemy.id);
      if (enemyView === undefined) {
        enemyView = createWorldSessionEnemyPlaceholderView(scene, enemy, (enemyId) => {
          const result = sendAttackIntent(nextRoom, enemyId);
          if (result.dispatched) {
            onAttackFeedback?.(t("world_area.attack_sent"));
          }
          const targetEnemy = getTownRoomEnemies(nextRoom.state).find((enemy) => enemy.id === enemyId);
          if (targetEnemy) {
            lastClickTarget = { x: targetEnemy.x, y: targetEnemy.y };
            onDebugStateChange?.();
          }
        });
        enemyPlaceholders.set(enemy.id, enemyView);
      } else {
        enemyView.refresh(enemy);
      }

      // Task 091 — remember last projected screen position for floating damage numbers
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
      .map((loot: TownRoomWorldLootSnapshot) => projectWorldLootToArea(loot, projection))
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
            const result = sendPickupWorldLootIntent(nextRoom, worldLootId);
            if (result.dispatched) {
              onPickupFeedback?.(t("world_area.pickup_sent"));
            }
            const targetLoot = getTownRoomWorldLoot(nextRoom.state).find((loot) => loot.id === worldLootId);
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

      const screenPoint = screenToWorldActiveProjection(
        pointer.x,
        pointer.y,
        projection.bounds,
        projection.viewport,
        projectionMode,
      );
      const worldX = screenPoint.x;
      const worldY = screenPoint.y;
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
      selfWorldPosition = null;
      return;
    }

    const { x, y } = self.position;
    selfWorldPosition = { x, y };
    const playerScreenPosition = worldToScreenActiveProjection(
      x,
      y,
      projection.bounds,
      projection.viewport,
      projectionMode,
    );
    const pixelX = playerScreenPosition.x;
    const pixelY = playerScreenPosition.y;
    selfScreenPosition = { x: pixelX, y: pixelY };

    // Update placeholder using authoritative synced position only.
    playerPlaceholder.setPosition(pixelX, pixelY);

    // Update target marker and line if a click target exists (debug, non-authoritative)
    if (lastClickTarget) {
      const targetScreenPosition = worldToScreenActiveProjection(
        lastClickTarget.x,
        lastClickTarget.y,
        projection.bounds,
        projection.viewport,
        projectionMode,
      );
      const targetPixelX = targetScreenPosition.x;
      const targetPixelY = targetScreenPosition.y;
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

  // Task 094 - toggle the telegraph warning marker on a specific enemy
  // view. Driven by the server-sent `enemy_attack_telegraph` event;
  // damage outcome is still decided server-side.
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
    }),
    setProjectionMode,
    showEnemyFloatingDamage,
    showPlayerFloatingDamage,
    showEnemyTelegraph,
    getSelfWorldPosition: () => selfWorldPosition,
    getLastClickTarget: () => lastClickTarget,
    destroy: () => {
      playerPlaceholder.destroy();
      interactablesView.destroy();
      // Task 058 — Destroy enemy placeholders
      for (const view of enemyPlaceholders.values()) {
        view.destroy();
      }
      enemyPlaceholders.clear();
      enemyScreenPositions.clear();
      for (const view of lootPlaceholders.values()) {
        view.destroy();
      }
      lootPlaceholders.clear();
      // Task 091 — Destroy floating damage view
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
): AreaProjectionContext {
  return {
    bounds,
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
