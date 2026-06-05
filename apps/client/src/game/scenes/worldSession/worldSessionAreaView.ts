import type { Room } from "@colyseus/sdk";
import { t } from "@doomscrolls/localization";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import Phaser from "phaser";

import { sendMovementIntent } from "../../../net/movementIntentClient";
import { sendInteractIntent } from "../../../net/interactIntentClient";
import { sendAttackIntent } from "../../../net/attackIntentClient";
import { sendPickupWorldLootIntent } from "../../../net/pickupWorldLootClient";
import { sendSkillSlotIntent } from "../../../net/skillSlotIntentClient";
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
import { createWorldSessionStaticPropsView } from "./worldSessionStaticPropsView";
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

interface EnemyScreenPositionSnapshot {
  readonly x: number;
  readonly y: number;
  readonly worldX: number;
  readonly worldY: number;
}

interface ProjectedEnemySnapshot {
  readonly enemy: TownRoomEnemySnapshot;
  readonly screenX: number;
  readonly screenY: number;
}

interface AreaProjectionContext {
  readonly bounds: WorldProjectionBounds;
  readonly viewport: WorldProjectionViewport;
  readonly projectionMode: WorldProjectionMode;
}

interface WorldRectScreenBounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

interface CameraFollowPadding {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

interface WorldContainerOffset {
  readonly x: number;
  readonly y: number;
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
  readonly setPendingPickupTarget: (worldLootId: string | null) => void;
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
  const worldContainer = scene.add.container(0, 0);
  const frame = scene.add.graphics();
  const worldFrame = scene.add.graphics();

  const staticPropsView = createWorldSessionStaticPropsView(scene, worldContainer);
  const playerPlaceholder = createWorldSessionPlayerPlaceholderView(scene, worldContainer);
  const interactablesView = createWorldSessionInteractablesView(scene, layout, (objectId: string) => {
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
  }, worldContainer);

  const enemyPlaceholders = new Map<string, WorldSessionEnemyPlaceholderView>();
  const lootPlaceholders = new Map<string, WorldSessionLootPlaceholderView>();
  const floatingDamageView: FloatingDamageNumberView = createFloatingDamageNumberView(scene, worldContainer);
  const enemyScreenPositions = new Map<string, EnemyScreenPositionSnapshot>();

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
    worldFrame,
    worldContainer,
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
  const canvasElement = scene.game.canvas;

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
  let pendingPickupWorldLootId: string | null = null;

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
    const worldProjection = createAreaProjectionContext(
      layout,
      bounds,
      projectionMode,
      cameraZoom,
    );
    const worldOffset = resolveWorldContainerOffset(layout, worldProjection, currentFocusPosition);
    worldContainer.setPosition(worldOffset.x, worldOffset.y);
    worldFrame.setPosition(worldOffset.x, worldOffset.y);

    drawViewportFrame(frame, layout);
    drawBounds(worldFrame, layout, bounds, worldProjection);
    boundsLabel.setText(
      `zone=${zoneId} bounds: x=${bounds.minX}..${bounds.maxX}, y=${bounds.minY}..${bounds.maxY}`,
    );

    staticPropsView.refresh({
      zoneId,
      bounds: worldProjection.bounds,
      viewport: worldProjection.viewport,
      projectionMode: worldProjection.projectionMode,
    });

    interactablesView.refresh(nextRoom, worldProjection);

    const currentEnemies = getTownRoomEnemies(nextRoom.state);
    const projectedEnemies = currentEnemies
      .map((enemy: TownRoomEnemySnapshot) => projectEnemyToArea(enemy, worldProjection))
      .filter((enemy: ProjectedEnemySnapshot | null): enemy is ProjectedEnemySnapshot => enemy !== null);
    const newEnemyIds = new Set(projectedEnemies.map((projectedEnemy: ProjectedEnemySnapshot) => projectedEnemy.enemy.id));

    for (const [id, view] of enemyPlaceholders.entries()) {
      if (!newEnemyIds.has(id)) {
        view.destroy();
        enemyPlaceholders.delete(id);
        enemyScreenPositions.delete(id);
      }
    }

    for (const projectedEnemy of projectedEnemies) {
      const enemy = projectedEnemy.enemy;
      const projectedViewEnemy: TownRoomEnemySnapshot = {
        ...enemy,
        x: projectedEnemy.screenX,
        y: projectedEnemy.screenY,
      };

      let enemyView = enemyPlaceholders.get(enemy.id);
      if (enemyView === undefined) {
        enemyView = createWorldSessionEnemyPlaceholderView(scene, projectedViewEnemy, worldContainer, (enemyId: string) => {
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
        enemyView.refresh(projectedViewEnemy);
      }

      enemyScreenPositions.set(enemy.id, {
        x: projectedEnemy.screenX,
        y: projectedEnemy.screenY,
        worldX: enemy.x,
        worldY: enemy.y,
      });

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
      .map((loot: TownRoomWorldLootSnapshot) => projectWorldLootToArea(loot, worldProjection))
      .filter((loot: TownRoomWorldLootSnapshot | null): loot is TownRoomWorldLootSnapshot => loot !== null);
    const newWorldLootIds = new Set(projectedWorldLoot.map((loot: TownRoomWorldLootSnapshot) => loot.id));

    for (const [id, view] of lootPlaceholders.entries()) {
      if (!newWorldLootIds.has(id)) {
        view.destroy();
        lootPlaceholders.delete(id);
        if (pendingPickupWorldLootId === id) {
          pendingPickupWorldLootId = null;
        }
      }
    }

    for (const loot of projectedWorldLoot) {
      const existing = lootPlaceholders.get(loot.id);
      if (existing === undefined) {
        lootPlaceholders.set(
          loot.id,
          createWorldSessionLootPlaceholderView(scene, loot, worldContainer, (worldLootId: string) => {
            pointerHandledByTarget = true;
            const result = sendPickupWorldLootIntent(nextRoom, worldLootId);
            if (result.dispatched) {
              pendingPickupWorldLootId = worldLootId;
              onPickupFeedback?.(`${t("world_area.pickup_sent")} ${formatPickupFeedbackLabel(loot)}`);
            }
            const targetLoot = getTownRoomWorldLoot(nextRoom.state).find((l) => l.id === worldLootId);
            if (targetLoot) {
              lastClickTarget = { x: targetLoot.x, y: targetLoot.y };
              onDebugStateChange?.();
            }
          }),
        );
        lootPlaceholders.get(loot.id)?.refresh(loot, pendingPickupWorldLootId === loot.id);
      } else {
        existing.refresh(loot, pendingPickupWorldLootId === loot.id);
      }
    }

    inputZone.removeAllListeners();
    inputZone.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        const localX = pointer.x - layout.originX;
        const localY = pointer.y - layout.originY;
        if (localX < 0 || localY < 0 || localX > layout.width || localY > layout.height) {
          return;
        }
        const result = sendSkillSlotIntent(nextRoom);
        if (!result.dispatched) {
          onPickupFeedback?.(t("world_area.skill_unavailable"));
        }
        return;
      }

      // Enemy / loot / interactable click handlers fire before this one
      // (they sit on top of inputZone in the container). If one of them
      // already handled the click we must not also send a movement intent.
      if (pointerHandledByTarget) {
        pointerHandledByTarget = false;
        return;
      }

      const clickedEnemy = findClickedEnemy(enemyScreenPositions, pointer.x, pointer.y);
      if (clickedEnemy !== null) {
        pointerHandledByTarget = true;
        const result = sendAttackIntent(nextRoom, clickedEnemy.id);
        if (result.dispatched) {
          onAttackFeedback?.(t("world_area.attack_sent"));
        }
        lastClickTarget = {
          x: Math.round(clickedEnemy.worldX),
          y: Math.round(clickedEnemy.worldY),
        };
        onDebugStateChange?.();
        pointerHandledByTarget = false;
        return;
      }

      const clickedInteractable = interactablesView.findClickedInteractable(pointer.x, pointer.y);
      if (clickedInteractable !== null) {
        pointerHandledByTarget = true;
        sendInteractIntent(nextRoom, clickedInteractable.objectId);
        lastClickTarget = {
          x: Math.round(clickedInteractable.worldX),
          y: Math.round(clickedInteractable.worldY),
        };
        onDebugStateChange?.();
        pointerHandledByTarget = false;
        return;
      }

      if (projectionMode !== "debug_top_down") {
        return;
      }

      const localX = pointer.x - layout.originX;
      const localY = pointer.y - layout.originY;
      if (localX < 0 || localY < 0 || localX > layout.width || localY > layout.height) {
        return;
      }

      const screenPoint = screenToWorldActiveProjection(
        pointer.x - worldOffset.x,
        pointer.y - worldOffset.y,
        worldProjection.bounds,
        worldProjection.viewport,
        projectionMode,
      );
      const worldX = screenPoint.x;
      const worldY = screenPoint.y;
      lastClickTarget = { x: Math.round(worldX), y: Math.round(worldY) };
      onDebugStateChange?.();
      sendMovementIntent(nextRoom, lastClickTarget.x, lastClickTarget.y);
    });

    if (!container.exists(inputZone)) {
      container.add(inputZone);
    }

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
      worldProjection.bounds,
      worldProjection.viewport,
      projectionMode,
    );
    const pixelX = playerScreenPosition.x + worldOffset.x;
    const pixelY = playerScreenPosition.y + worldOffset.y;
    selfScreenPosition = { x: pixelX, y: pixelY };

    playerPlaceholder.setPosition(playerScreenPosition.x, playerScreenPosition.y);

    if (lastClickTarget) {
      const targetScreenPosition = worldToScreenActiveProjection(
        lastClickTarget.x,
        lastClickTarget.y,
        worldProjection.bounds,
        worldProjection.viewport,
        projectionMode,
      );
      const targetPixelX = targetScreenPosition.x + worldOffset.x;
      const targetPixelY = targetScreenPosition.y + worldOffset.y;
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

  const handleSceneUpdate = (): void => {
    refreshFromRoomState(room);
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, handleSceneUpdate);

  const handleContextMenu = (event: MouseEvent): void => {
    const rect = canvasElement.getBoundingClientRect();
    const insideViewport = event.clientX >= rect.left + layout.originX
      && event.clientX <= rect.left + layout.originX + layout.width
      && event.clientY >= rect.top + layout.originY
      && event.clientY <= rect.top + layout.originY + layout.height;
    if (insideViewport) {
      event.preventDefault();
    }
  };

  canvasElement.addEventListener("contextmenu", handleContextMenu);

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
    setPendingPickupTarget: (worldLootId: string | null) => {
      pendingPickupWorldLootId = worldLootId;
      refreshFromRoomState(room);
    },
    destroy: () => {
      canvasElement.removeEventListener("contextmenu", handleContextMenu);
      scene.events.off(Phaser.Scenes.Events.UPDATE, handleSceneUpdate);
      scene.input.off(Phaser.Input.Events.POINTER_WHEEL);
      staticPropsView.destroy();
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

function findClickedEnemy(
  enemyScreenPositions: ReadonlyMap<string, EnemyScreenPositionSnapshot>,
  pointerX: number,
  pointerY: number,
): { readonly id: string; readonly worldX: number; readonly worldY: number } | null {
  const hitRadiusPx = 24;
  const hitRadiusSquared = hitRadiusPx * hitRadiusPx;
  let closestHit: { readonly id: string; readonly worldX: number; readonly worldY: number; readonly distanceSquared: number } | null = null;

  for (const [id, position] of enemyScreenPositions.entries()) {
    const dx = pointerX - position.x;
    const dy = pointerY - position.y;
    const distanceSquared = (dx * dx) + (dy * dy);
    if (distanceSquared > hitRadiusSquared) {
      continue;
    }

    if (closestHit === null || distanceSquared < closestHit.distanceSquared) {
      closestHit = {
        id,
        worldX: position.worldX,
        worldY: position.worldY,
        distanceSquared,
      };
    }
  }

  if (closestHit === null) {
    return null;
  }

  return {
    id: closestHit.id,
    worldX: closestHit.worldX,
    worldY: closestHit.worldY,
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

function formatPickupFeedbackLabel(loot: TownRoomWorldLootSnapshot): string {
  const label = t(loot.label);
  if (loot.rarity === undefined || loot.rarity.length === 0) {
    return label;
  }

  return `${label} [${formatItemRarityLabel(loot.rarity)}]`;
}

function formatItemRarityLabel(rarity: string): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

function projectEnemyToArea(
  enemy: TownRoomEnemySnapshot,
  projection: AreaProjectionContext,
): ProjectedEnemySnapshot | null {
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

  const projectedPosition = worldToScreenActiveProjection(
    enemy.x,
    enemy.y,
    projection.bounds,
    projection.viewport,
    projection.projectionMode,
  );

  return {
    enemy,
    screenX: projectedPosition.x,
    screenY: projectedPosition.y,
  };
}

function createAreaProjectionContext(
  layout: WorldSessionAreaLayout,
  bounds: WorldProjectionBounds,
  projectionMode: WorldProjectionMode,
  zoom: number,
): AreaProjectionContext {
  const clampedZoom = Math.min(Math.max(zoom, 0.75), 1.6);
  const fullWidth = bounds.maxX - bounds.minX;
  const fullHeight = bounds.maxY - bounds.minY;
  const visibleWidth = Math.min(fullWidth, fullWidth / clampedZoom);
  const visibleHeight = Math.min(fullHeight, fullHeight / clampedZoom);
  const cameraBounds: WorldProjectionBounds = {
    minX: bounds.minX,
    maxX: bounds.minX + visibleWidth,
    minY: bounds.minY,
    maxY: bounds.minY + visibleHeight,
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

function drawViewportFrame(graphics: Phaser.GameObjects.Graphics, layout: WorldSessionAreaLayout): void {
  graphics.clear();
  graphics.fillStyle(0x1a1510, 1);
  graphics.fillRect(layout.originX, layout.originY, layout.width, layout.height);

  graphics.lineStyle(2, 0x5f4a2f, 1);
  graphics.strokeRect(layout.originX, layout.originY, layout.width, layout.height);
}

function drawBounds(
  graphics: Phaser.GameObjects.Graphics,
  layout: WorldSessionAreaLayout,
  zoneBounds: WorldProjectionBounds,
  projection: AreaProjectionContext,
): void {
  graphics.clear();

  graphics.fillStyle(0x1a1510, 0.001);
  graphics.fillRect(layout.originX, layout.originY, layout.width, layout.height);

  const cellSize = 50;
  graphics.lineStyle(1, 0x6b5436, 0.18);
  const right = layout.originX + layout.width;
  const bottom = layout.originY + layout.height;
  for (let x = layout.originX + cellSize; x < right; x += cellSize) {
    graphics.lineBetween(x, layout.originY, x, bottom);
  }
  for (let y = layout.originY + cellSize; y < bottom; y += cellSize) {
    graphics.lineBetween(layout.originX, y, right, y);
  }

  const worldRect = projectWorldRectToScreen(zoneBounds, projection);
  drawWorldBoundary(graphics, worldRect);

  graphics.lineStyle(2, 0x5f4a2f, 1);
  graphics.strokeRect(layout.originX, layout.originY, layout.width, layout.height);
}

function resolveWorldContainerOffset(
  layout: WorldSessionAreaLayout,
  projection: AreaProjectionContext,
  focusPosition: { readonly x: number; readonly y: number } | null,
): WorldContainerOffset {
  if (focusPosition === null) {
    return { x: 0, y: 0 };
  }

  const projectedFocus = worldToScreenActiveProjection(
    focusPosition.x,
    focusPosition.y,
    projection.bounds,
    projection.viewport,
    projection.projectionMode,
  );

  return {
    x: (layout.originX + (layout.width / 2)) - projectedFocus.x,
    y: (layout.originY + (layout.height / 2)) - projectedFocus.y,
  };
}

function projectWorldRectToScreen(
  zoneBounds: WorldProjectionBounds,
  projection: AreaProjectionContext,
): WorldRectScreenBounds {
  const topLeft = worldToScreenActiveProjection(
    zoneBounds.minX,
    zoneBounds.minY,
    projection.bounds,
    projection.viewport,
    projection.projectionMode,
  );
  const topRight = worldToScreenActiveProjection(
    zoneBounds.maxX,
    zoneBounds.minY,
    projection.bounds,
    projection.viewport,
    projection.projectionMode,
  );
  const bottomLeft = worldToScreenActiveProjection(
    zoneBounds.minX,
    zoneBounds.maxY,
    projection.bounds,
    projection.viewport,
    projection.projectionMode,
  );
  const bottomRight = worldToScreenActiveProjection(
    zoneBounds.maxX,
    zoneBounds.maxY,
    projection.bounds,
    projection.viewport,
    projection.projectionMode,
  );

  return {
    left: Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x),
    right: Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x),
    top: Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y),
    bottom: Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y),
  };
}

function drawWorldBoundary(
  graphics: Phaser.GameObjects.Graphics,
  worldRect: WorldRectScreenBounds,
): void {
  const markerSpacing = 32;
  const markerLength = 12;
  const markerThickness = 4;
  const width = worldRect.right - worldRect.left;
  const height = worldRect.bottom - worldRect.top;

  graphics.lineStyle(6, 0x23180f, 0.9);
  graphics.strokeRect(worldRect.left, worldRect.top, width, height);

  graphics.lineStyle(3, 0x8f6a3d, 0.95);
  graphics.strokeRect(worldRect.left, worldRect.top, width, height);

  graphics.fillStyle(0xb88952, 0.95);
  for (let x = worldRect.left + markerSpacing / 2; x < worldRect.right; x += markerSpacing) {
    graphics.fillRect(x - markerThickness / 2, worldRect.top - 1, markerThickness, markerLength);
    graphics.fillRect(
      x - markerThickness / 2,
      worldRect.bottom - markerLength + 1,
      markerThickness,
      markerLength,
    );
  }
  for (let y = worldRect.top + markerSpacing / 2; y < worldRect.bottom; y += markerSpacing) {
    graphics.fillRect(worldRect.left - 1, y - markerThickness / 2, markerLength, markerThickness);
    graphics.fillRect(
      worldRect.right - markerLength + 1,
      y - markerThickness / 2,
      markerLength,
      markerThickness,
    );
  }
}
