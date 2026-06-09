import type { Room } from "@colyseus/sdk";
import { t } from "@doomscrolls/localization";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import Phaser from "phaser";

import { sendMovementIntent } from "../../../net/movementIntentClient";
import { sendInteractIntent } from "../../../net/interactIntentClient";
import { sendAttackIntent } from "../../../net/attackIntentClient";
import { sendPickupWorldLootIntent } from "../../../net/pickupWorldLootClient";
import { sendSkillSlotIntent } from "../../../net/skillSlotIntentClient";
import { sendCorpseInteractIntent } from "../../../net/corpseInteractClient";
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
  getScatterOffset,
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

interface HeldMovementTargetSnapshot extends ClickTargetSnapshot {
  readonly pointerId: number;
}

interface EnemyScreenPositionSnapshot {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly worldX: number;
  readonly worldY: number;
  readonly defeated: boolean;
}

interface WorldLootScreenPositionSnapshot {
  readonly id: string;
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

export interface WorldSessionSkillTargetingState {
  readonly hoveredEnemyId: string | null;
  readonly selectedEnemyId: string | null;
  readonly targetEnemyLabel: string | null;
  readonly targetDistance: number | null;
  readonly isTargetInRange: boolean | null;
}

export interface WorldSessionAreaView {
  readonly refreshFromRoomState: (room: Room<DoomscrollsRoomState>) => void;
  readonly getDebugState: () => WorldSessionDebugState;
  readonly setProjectionMode: (mode: WorldProjectionMode) => void;
  readonly showEnemyFloatingDamage: (enemyId: string, text: string) => void;
  readonly showPlayerFloatingDamage: (text: string) => void;
  readonly showEnemyTelegraph: (enemyId: string, attackKind?: "normal" | "heavy") => void;
  readonly resolveEnemyAttackOutcome: (enemyId: string, outcome: "hit" | "miss") => void;
  readonly getSelfWorldPosition: () => { readonly x: number; readonly y: number } | null;
  readonly getLastClickTarget: () => ClickTargetSnapshot | null;
  readonly getSkillTargetingState: () => WorldSessionSkillTargetingState;
  readonly setPendingPickupTarget: (worldLootId: string | null) => void;
  readonly destroy: () => void;
}

export function createWorldSessionAreaView(
  scene: Phaser.Scene,
  room: Room<DoomscrollsRoomState>,
  onAttackFeedback?: (message: string) => void,
  onPickupFeedback?: (message: string) => void,
  onDebugStateChange?: () => void,
  onRareDrop?: (itemLabel: string) => void,
): WorldSessionAreaView {
  const graveSparkRange = 96;
  const movementHoldThrottleMs = 125;
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
    const roomState = room.state as unknown as { interactables?: Map<string, { x: number; y: number }> };
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
  const lootScreenPositions = new Map<string, WorldLootScreenPositionSnapshot>();
  const corpseMarkers = new Map<string, Phaser.GameObjects.Container>();

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
  const previousLootIds = new Set<string>();
  let pendingPickupWorldLootId: string | null = null;
  let heldMovementTarget: HeldMovementTargetSnapshot | null = null;
  let lastHeldMovementIntentAtMs = 0;
  let hoveredEnemyId: string | null = null;
  let selectedSkillTargetEnemyId: string | null = null;
  let selfSessionId: string | null = null;

  const isPointerInsideViewport = (pointerX: number, pointerY: number): boolean => {
    const localX = pointerX - layout.originX;
    const localY = pointerY - layout.originY;
    return localX >= 0 && localY >= 0 && localX <= layout.width && localY <= layout.height;
  };

  const clearHeldMovementTarget = (): void => {
    heldMovementTarget = null;
  };

  const resolveWorldTargetFromPointer = (
    pointer: Phaser.Input.Pointer,
    worldOffset: WorldContainerOffset,
    worldProjection: AreaProjectionContext,
  ): ClickTargetSnapshot | null => {
    if (projectionMode !== "debug_top_down" || !isPointerInsideViewport(pointer.x, pointer.y)) {
      return null;
    }

    const screenPoint = screenToWorldActiveProjection(
      pointer.x - worldOffset.x,
      pointer.y - worldOffset.y,
      worldProjection.bounds,
      worldProjection.viewport,
      projectionMode,
    );

    return {
      x: Math.round(screenPoint.x),
      y: Math.round(screenPoint.y),
    };
  };

  const dispatchMovementIntent = (
    nextRoom: Room<DoomscrollsRoomState>,
    target: ClickTargetSnapshot,
  ): void => {
    lastClickTarget = target;
    onDebugStateChange?.();
    sendMovementIntent(nextRoom, target.x, target.y);
  };

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
    selfSessionId = nextRoom.sessionId;
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
    interactablesView.setScreenOffset(worldOffset.x, worldOffset.y);

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
    const currentEnemyIds = new Set(currentEnemies.map((enemy: TownRoomEnemySnapshot) => enemy.id));

    for (const [id, view] of enemyPlaceholders.entries()) {
      if (!currentEnemyIds.has(id)) {
        // Defensive lifecycle rule (Task 242):
        // An enemy view is only destroyed when the server has actually
        // removed the enemy from authoritative state. A temporary
        // projection miss (off-camera bounds, camera follow re-anchor,
        // zoom change) must NOT destroy the view; the view is allowed
        // to stay at its last known world position until the
        // projection returns and a refresh snaps it back. This stops
        // enemies from disappearing and reappearing elsewhere when
        // the player moves around the zone.
        view.destroy();
        enemyPlaceholders.delete(id);
        enemyScreenPositions.delete(id);
      }
    }

    // Defensive lifecycle rule (Task 242):
    // If a server-authoritative enemy exists but its world position
    // is currently outside the projected viewport (e.g. the player
    // camera has re-anchored or zoomed), the projection helper
    // returns null. The view must NOT be hidden, moved off-screen,
    // or treated as despawned in that case; the server still owns
    // the enemy and will respawn / chase / return / defeat it
    // independently of client-side projection. We only treat the
    // enemy as removed when it disappears from `currentEnemyIds`
    // (the server removed it) or when its `defeated` flag is true
    // (visual represents the corpse / defeated state). The view's
    // last known screen position is preserved by not calling
    // refresh() with a projection and not calling hide().

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
        id: enemy.id,
        label: t(enemy.label),
        x: projectedEnemy.screenX + worldOffset.x,
        y: projectedEnemy.screenY + worldOffset.y,
        worldX: enemy.x,
        worldY: enemy.y,
        defeated: enemy.defeated,
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
        onPickupFeedback?.(
          t("world_area.enemy_defeated_distinct", { enemy: t(enemy.label) }),
        );
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

    // Detect new loot entries and show drop feedback
    for (const loot of projectedWorldLoot) {
      if (!previousLootIds.has(loot.id)) {
        const sourceLoot = currentWorldLoot.find((entry) => entry.id === loot.id);
        if (sourceLoot !== undefined) {
          if (sourceLoot.rarity === "rare") {
            onRareDrop?.(t(sourceLoot.label));
          } else if (sourceLoot.currencyCopper > 0) {
            onPickupFeedback?.(t("world_area.currency_dropped"));
          } else {
            onPickupFeedback?.(t("world_area.loot_dropped"));
          }
        }
      }
    }
    previousLootIds.clear();
    for (const id of newWorldLootIds) {
      previousLootIds.add(id);
    }

    for (const [id, view] of lootPlaceholders.entries()) {
      if (!newWorldLootIds.has(id)) {
        view.destroy();
        lootPlaceholders.delete(id);
        lootScreenPositions.delete(id);
        if (pendingPickupWorldLootId === id) {
          pendingPickupWorldLootId = null;
        }
      }
    }

    for (const loot of projectedWorldLoot) {
      const sourceLoot = currentWorldLoot.find((entry) => entry.id === loot.id);
      if (sourceLoot !== undefined) {
        // Hit-test position must match the rendered position in
        // worldSessionLootPlaceholderView (world x/y + scatter offset + worldOffset).
        const scatter = getScatterOffset(loot.id);
        const scatterLootX = loot.x + scatter.x + worldOffset.x;
        const scatterLootY = loot.y + scatter.y + worldOffset.y;
        lootScreenPositions.set(loot.id, {
          id: loot.id,
          x: scatterLootX,
          y: scatterLootY,
          worldX: sourceLoot.x,
          worldY: sourceLoot.y,
        });
      }
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

    // Sync corpse markers from presence data
    const currentCorpsePlayerIds = new Set<string>();
    if (presence !== null) {
      for (const player of presence.players) {
        if (player.hasCorpse === true && player.corpsePosition !== undefined) {
          currentCorpsePlayerIds.add(player.sessionId);
          const corpsePos = player.corpsePosition;
          const screenPos = worldToScreenActiveProjection(
            corpsePos.x,
            corpsePos.y,
            worldProjection.bounds,
            worldProjection.viewport,
            projectionMode,
          );
          let marker = corpseMarkers.get(player.sessionId);
          const isOwnCorpse = player.sessionId === selfSessionId;
          if (marker === undefined) {
            marker = scene.add.container(screenPos.x, screenPos.y);
            if (isOwnCorpse) {
              // Own corpse marker: teal glow, cross icon, larger, more distinct
              const markerBg = scene.add.ellipse(0, 12, 28, 16, 0x003333, 0.5);
              const markerBody = scene.add.rectangle(0, 0, 16, 24, 0x2a5c5c, 0.9);
              markerBody.setStrokeStyle(2, 0x4ab0b0, 0.95);
              const markerCross = scene.add.circle(0, -14, 6, 0x206060, 0.9);
              markerCross.setStrokeStyle(2, 0x4ab0b0, 0.95);
              const markerLabel = scene.add.text(0, -30, "☠ " + player.displayName, {
                color: "#4ad8d8",
                fontFamily: "Arial, sans-serif",
                fontSize: "10px",
                fontStyle: "bold",
                stroke: "#0a2020",
                strokeThickness: 3,
              }).setOrigin(0.5);
              marker.add([markerBg, markerBody, markerCross, markerLabel]);
            } else {
              const markerBg = scene.add.ellipse(0, 12, 24, 12, 0x330000, 0.3);
              const markerBody = scene.add.rectangle(0, 0, 14, 20, 0x5c2a2a, 0.85);
              markerBody.setStrokeStyle(2, 0x8f3f3f, 0.9);
              const markerHead = scene.add.circle(0, -14, 5, 0x4a2020, 0.85);
              markerHead.setStrokeStyle(2, 0x8f3f3f, 0.9);
              const markerLabel = scene.add.text(0, -28, player.displayName, {
                color: "#b04a4a",
                fontFamily: "Arial, sans-serif",
                fontSize: "9px",
                fontStyle: "bold",
                stroke: "#1a0808",
                strokeThickness: 3,
              }).setOrigin(0.5);
              marker.add([markerBg, markerBody, markerHead, markerLabel]);
            }
            worldContainer.add(marker);
            corpseMarkers.set(player.sessionId, marker);
          } else {
            marker.setPosition(screenPos.x, screenPos.y);
          }
        }
      }
    }
    for (const [sessionId, marker] of corpseMarkers.entries()) {
      if (!currentCorpsePlayerIds.has(sessionId)) {
        marker.destroy(true);
        corpseMarkers.delete(sessionId);
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
        // Task 217 — RMB on enemy sends Grave Spark skill intent.
        const clickedEnemy = findClickedEnemy(enemyScreenPositions, pointer.x, pointer.y);
        if (clickedEnemy !== null) {
          pointerHandledByTarget = true;
          selectedSkillTargetEnemyId = clickedEnemy.id;
          hoveredEnemyId = clickedEnemy.id;
          const result = sendSkillSlotIntent(nextRoom, clickedEnemy.id);
          const selfPosition = selfWorldPosition;
          const skillDistance = selfPosition === null
            ? null
            : Math.hypot(clickedEnemy.worldX - selfPosition.x, clickedEnemy.worldY - selfPosition.y);
          if (result.dispatched) {
            onAttackFeedback?.(
              skillDistance !== null && skillDistance > graveSparkRange
                ? t("world_area.skill_moving_closer" as never)
                : t("world_area.skill_sent"),
            );
          } else if (result.reason === "no_target") {
            onPickupFeedback?.(t("world_area.skill_unavailable"));
          } else {
            onPickupFeedback?.(t("world_area.skill_unavailable"));
          }
          const targetEnemy = getTownRoomEnemies(nextRoom.state).find((e) => e.id === clickedEnemy.id);
          if (targetEnemy) {
            lastClickTarget = { x: targetEnemy.x, y: targetEnemy.y };
            onDebugStateChange?.();
          }
          return;
        }
        // RMB on empty ground: no skill target
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

      const clickedLoot = findClickedWorldLoot(lootScreenPositions, pointer.x, pointer.y);
      if (clickedLoot !== null) {
        pointerHandledByTarget = true;
        const result = sendPickupWorldLootIntent(nextRoom, clickedLoot.id);
        if (result.dispatched) {
          pendingPickupWorldLootId = clickedLoot.id;
          const targetLoot = getTownRoomWorldLoot(nextRoom.state).find((entry) => entry.id === clickedLoot.id);
          if (targetLoot !== undefined) {
            onPickupFeedback?.(`${t("world_area.pickup_sent")} ${formatPickupFeedbackLabel(targetLoot)}`);
          }
        }
        lastClickTarget = {
          x: Math.round(clickedLoot.worldX),
          y: Math.round(clickedLoot.worldY),
        };
        onDebugStateChange?.();
        pointerHandledByTarget = false;
        return;
      }

      // Click on own corpse marker to recover (Task 234)
      const clickedOwnCorpse = findClickedOwnCorpse(
        corpseMarkers,
        pointer.x,
        pointer.y,
        worldOffset,
        selfSessionId,
        selfWorldPosition,
      );
      if (clickedOwnCorpse !== null) {
        pointerHandledByTarget = true;
        clearHeldMovementTarget();
        if (clickedOwnCorpse.inRange) {
          sendCorpseInteractIntent(nextRoom);
          onAttackFeedback?.(t("world_area.corpse_recovered"));
        } else {
          // Move to corpse first
          dispatchMovementIntent(nextRoom, { x: clickedOwnCorpse.worldX, y: clickedOwnCorpse.worldY });
          onAttackFeedback?.(t("world_area.corpse_interact_out_of_range"));
        }
        pointerHandledByTarget = false;
        return;
      }

      const clickedInteractable = interactablesView.findClickedInteractable(pointer.x, pointer.y);
      if (clickedInteractable !== null) {
        pointerHandledByTarget = true;
        clearHeldMovementTarget();
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

      const target = resolveWorldTargetFromPointer(pointer, worldOffset, worldProjection);
      if (target === null) {
        return;
      }

      heldMovementTarget = { ...target, pointerId: pointer.id };
      lastHeldMovementIntentAtMs = scene.time.now;
      dispatchMovementIntent(nextRoom, target);
    });

    inputZone.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      const hoveredEnemy = findClickedEnemy(enemyScreenPositions, pointer.x, pointer.y);
      const nextHoveredEnemyId = hoveredEnemy?.id ?? null;
      if (nextHoveredEnemyId !== hoveredEnemyId) {
        hoveredEnemyId = nextHoveredEnemyId;
        onDebugStateChange?.();
      }

      if (!pointer.leftButtonDown()) {
        clearHeldMovementTarget();
        return;
      }

      if (heldMovementTarget === null || heldMovementTarget.pointerId !== pointer.id) {
        return;
      }

      const target = resolveWorldTargetFromPointer(pointer, worldOffset, worldProjection);
      if (target === null) {
        clearHeldMovementTarget();
        return;
      }

      heldMovementTarget = { ...target, pointerId: pointer.id };
    });

    inputZone.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (heldMovementTarget?.pointerId === pointer.id) {
        clearHeldMovementTarget();
      }
    });

    if (!container.exists(inputZone)) {
      container.add(inputZone);
    }

    if (self?.position === undefined) {
      hoveredEnemyId = null;
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
    // Render and click-space must share the same active projection math.
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
    playerPlaceholder.setInfo(self.displayName, self.hp, self.maxHp);
    // Task 207 -- show a transient "Moving to loot / interact / attack"
    // label above the player placeholder while the server-owned
    // pendingActionType is active. Purely visual; the server still
    // owns the action outcome.
    playerPlaceholder.setApproachLabel(self.pendingActionType ?? null);

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
    if (heldMovementTarget !== null) {
      if (!scene.input.activePointer.leftButtonDown() || !isPointerInsideViewport(scene.input.activePointer.x, scene.input.activePointer.y)) {
        clearHeldMovementTarget();
      } else if (scene.time.now - lastHeldMovementIntentAtMs >= movementHoldThrottleMs) {
        lastHeldMovementIntentAtMs = scene.time.now;
        dispatchMovementIntent(room, {
          x: heldMovementTarget.x,
          y: heldMovementTarget.y,
        });
      }
    }
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

  const showEnemyTelegraph = (enemyId: string, attackKind: "normal" | "heavy" = "normal"): void => {
    const view = enemyPlaceholders.get(enemyId);
    if (view === undefined) {
      return;
    }
    view.setTelegraphing(true, attackKind);
  };

  const resolveEnemyAttackOutcome = (enemyId: string, outcome: "hit" | "miss"): void => {
    const view = enemyPlaceholders.get(enemyId);
    if (view === undefined) {
      return;
    }
    view.setTelegraphing(false);
    if (outcome === "miss") {
      const screenPos = enemyScreenPositions.get(enemyId);
      if (screenPos !== undefined) {
        floatingDamageView.show(screenPos.x, screenPos.y - 18, "MISS");
      }
    }
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
    resolveEnemyAttackOutcome,
    getSelfWorldPosition: () => selfWorldPosition,
    getLastClickTarget: () => lastClickTarget,
    getSkillTargetingState: () => {
      const resolvedTargetEnemyId = hoveredEnemyId ?? selectedSkillTargetEnemyId;
      if (resolvedTargetEnemyId === null) {
        return {
          hoveredEnemyId,
          selectedEnemyId: selectedSkillTargetEnemyId,
          targetEnemyLabel: null,
          targetDistance: null,
          isTargetInRange: null,
        };
      }

      const target = enemyScreenPositions.get(resolvedTargetEnemyId);
      if (target === undefined || selfWorldPosition === null || target.defeated) {
        return {
          hoveredEnemyId,
          selectedEnemyId: selectedSkillTargetEnemyId,
          targetEnemyLabel: target?.label ?? null,
          targetDistance: null,
          isTargetInRange: null,
        };
      }

      const targetDistance = Math.hypot(target.worldX - selfWorldPosition.x, target.worldY - selfWorldPosition.y);
      return {
        hoveredEnemyId,
        selectedEnemyId: selectedSkillTargetEnemyId,
        targetEnemyLabel: target.label,
        targetDistance,
        isTargetInRange: targetDistance <= graveSparkRange,
      };
    },
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
      lootScreenPositions.clear();
      for (const marker of corpseMarkers.values()) {
        marker.destroy(true);
      }
      corpseMarkers.clear();
      floatingDamageView.destroy();
      selfScreenPosition = null;
      container.destroy(true);
    },
  };
}

function findClickedOwnCorpse(
  corpseMarkers: ReadonlyMap<string, Phaser.GameObjects.Container>,
  pointerX: number,
  pointerY: number,
  worldOffset: WorldContainerOffset,
  selfSessionId: string | null,
  selfWorldPosition: { readonly x: number; readonly y: number } | null,
): { readonly worldX: number; readonly worldY: number; readonly inRange: boolean } | null {
  // Only the player's own corpse is interactable; others' corpses are visual-only.
  if (selfSessionId === null || selfWorldPosition === null) {
    return null;
  }
  const marker = corpseMarkers.get(selfSessionId);
  if (marker === undefined) {
    return null;
  }

  // World position of the corpse
  const corpseWorldX = marker.x;
  const corpseWorldY = marker.y;

  // Hit-test on screen position
  const markerScreenX = corpseWorldX + worldOffset.x;
  const markerScreenY = corpseWorldY + worldOffset.y;
  const dx = pointerX - markerScreenX;
  const dy = pointerY - markerScreenY;
  const hitRadiusPx = 24;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared > hitRadiusPx * hitRadiusPx) {
    return null;
  }

  // Check range: distance from player world position to corpse world position
  const worldDx = corpseWorldX - selfWorldPosition.x;
  const worldDy = corpseWorldY - selfWorldPosition.y;
  const worldDist = Math.sqrt(worldDx * worldDx + worldDy * worldDy);
  // CORPSE_INTERACT_RANGE constant from closure (30 world units)
  const inRange = worldDist <= 30;

  return {
    worldX: corpseWorldX,
    worldY: corpseWorldY,
    inRange,
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
    // Skip defeated enemies so loot/interactable clicks underneath are not blocked
    if (position.defeated) {
      continue;
    }

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

function findClickedWorldLoot(
  lootScreenPositions: ReadonlyMap<string, WorldLootScreenPositionSnapshot>,
  pointerX: number,
  pointerY: number,
): { readonly id: string; readonly worldX: number; readonly worldY: number } | null {
  const hitRadiusPx = 30;
  const hitRadiusSquared = hitRadiusPx * hitRadiusPx;
  let closestHit: { readonly id: string; readonly worldX: number; readonly worldY: number; readonly distanceSquared: number } | null = null;

  for (const loot of lootScreenPositions.values()) {
    const dx = pointerX - loot.x;
    const dy = pointerY - loot.y;
    const distanceSquared = (dx * dx) + (dy * dy);
    if (distanceSquared > hitRadiusSquared) {
      continue;
    }

    if (closestHit === null || distanceSquared < closestHit.distanceSquared) {
      closestHit = {
        id: loot.id,
        worldX: loot.worldX,
        worldY: loot.worldY,
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
