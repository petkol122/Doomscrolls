import type { Room } from "@colyseus/sdk";
import { t } from "@doomscrolls/localization";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import Phaser from "phaser";

import { sendMovementIntent } from "../../../net/movementIntentClient";
import { sendInteractIntent } from "../../../net/interactIntentClient";
import { sendAttackIntent } from "../../../net/attackIntentClient";
import { sendPickupWorldLootIntent } from "../../../net/pickupWorldLootClient";
import type { WorldInteractionPointerContext } from "./WorldInteractionIntent";
import {
  BASIC_ATTACK_RANGE,
  checkPendingAttack,
  type PendingAttackState,
} from "./pendingAttackTracker";
import {
  WORLD_LOOT_PICKUP_RANGE,
  checkPendingLootPickup,
  type PendingLootPickupState,
} from "./pendingLootPickupTracker";
import {
  INTERACT_RANGE,
  checkPendingInteract,
  type PendingInteractState,
} from "./pendingInteractTracker";
import { resolveWorldInteraction } from "./resolveWorldInteraction";
import { dispatchWorldInteraction } from "./dispatchWorldInteraction";
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
import type { WorldSessionInteractablesView } from "./worldSessionInteractablesView";
import {
  createWorldSessionLootPlaceholderView,
  getScatterOffset,
  type WorldSessionLootPlaceholderView,
} from "./worldSessionLootPlaceholderView";
import {
  createFloatingDamageNumberView,
  type FloatingDamageNumberView,
} from "./floatingDamageNumberView";
import { shouldIgnoreWorldSessionCombatHotkey } from "./worldSessionCombatHotkeyFocus";
import {
  checkPlayerInRestArea,
} from "./townRestAreaDetection";
import {
  createWorldSessionCursorFeedback,
  type HoverTargetInfo,
  type WorldSessionCursorFeedback,
} from "./worldSessionCursorFeedback";

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
  readonly isVisible: boolean;
}

interface WorldLootScreenPositionSnapshot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly worldX: number;
  readonly worldY: number;
}

interface CorpseScreenPositionSnapshot {
  readonly sessionId: string;
  readonly x: number;
  readonly y: number;
  readonly worldX: number;
  readonly worldY: number;
}

interface ProjectedEnemySnapshot {
  readonly enemy: TownRoomEnemySnapshot;
  readonly screenX: number;
  readonly screenY: number;
  readonly isVisible: boolean;
}

interface AreaProjectionContext {
  readonly bounds: WorldProjectionBounds;
  readonly viewport: WorldProjectionViewport;
  readonly projectionMode: WorldProjectionMode;
}

interface AreaWorldProjectionState {
  readonly projection: AreaProjectionContext;
  readonly offset: WorldContainerOffset;
  readonly focusPosition: { readonly x: number; readonly y: number } | null;
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
  // Task 310 — brief white-flash on the enemy body when a hit lands.
  readonly showEnemyHitFlash: (enemyId: string) => void;
  // Task 311 — brief red-flash on the player body when server-confirmed
  // damage lands. Purely visual; no gameplay state mutation.
  readonly showPlayerHitFlash: () => void;
  readonly getSelfWorldPosition: () => { readonly x: number; readonly y: number } | null;
  readonly getLastClickTarget: () => ClickTargetSnapshot | null;
  readonly getSkillTargetingState: () => WorldSessionSkillTargetingState;
  readonly setPendingPickupTarget: (worldLootId: string | null) => void;
  readonly destroy: () => void;
}

/**
 * Resolve what the pointer is hovering over, matching click priority.
 * Returns null when the pointer is outside the viewport or over nothing
 * actionable (ground only when in debug_top_down mode).
 */
function resolveHoverTarget(
  pointerX: number,
  pointerY: number,
  enemyScreenPositions: ReadonlyMap<string, EnemyScreenPositionSnapshot>,
  lootScreenPositions: ReadonlyMap<string, WorldLootScreenPositionSnapshot>,
  corpseScreenPositions: ReadonlyMap<string, CorpseScreenPositionSnapshot>,
  selfSessionId: string | null,
  selfWorldPosition: { readonly x: number; readonly y: number } | null,
  interactablesView: WorldSessionInteractablesView,
  projectionMode: WorldProjectionMode,
): HoverTargetInfo | null {
  // Priority 1: Enemy (living)
  const hitEnemy = findClickedEnemy(enemyScreenPositions, pointerX, pointerY);
  if (hitEnemy !== null) {
    const pos = enemyScreenPositions.get(hitEnemy.id);
    const label = pos?.label;
    if (label !== undefined) {
      return { type: "enemy", label };
    }
    return { type: "enemy" };
  }

  // Priority 2: Loot
  const hitLoot = findClickedWorldLoot(lootScreenPositions, pointerX, pointerY);
  if (hitLoot !== null) {
    return { type: "loot" };
  }

  // Priority 3: Own corpse
  if (findClickedOwnCorpseInteractive(
    corpseScreenPositions, pointerX, pointerY, selfSessionId, selfWorldPosition,
  )) {
    return { type: "own_corpse" };
  }

  // Priority 4: Interactable object
  const hitInteractable = interactablesView.findClickedInteractable(pointerX, pointerY);
  if (hitInteractable !== null) {
    return { type: "interactable" };
  }

  // Priority 5: Ground (only in debug_top_down mode)
  if (projectionMode === "debug_top_down") {
    return { type: "ground" };
  }

  return null;
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
  // Task 327 — client visibility guardrail:
  // - the server may still know/simulate enemies outside the camera,
  // - but the client only renders/clicks enemies whose CURRENT live
  //   projection lands inside the visible viewport (+ small padding),
  // - and the same projection snapshot must drive render, hover, and click.
  const ENTITY_VIEWPORT_PADDING_PX = 36;
  const MIN_CAMERA_ZOOM = 0.55;
  const MAX_CAMERA_ZOOM = 1.9;
  const DEFAULT_CAMERA_ZOOM = 1.0;
  const CAMERA_ZOOM_STEP = 0.1;
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
  const corpseScreenPositions = new Map<string, CorpseScreenPositionSnapshot>();
  const corpseMarkers = new Map<string, Phaser.GameObjects.Container>();
  const corpseGlowTweens = new Map<string, Phaser.Tweens.Tween>();

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

  // Task 314 — cursor feedback (hover label + highlight rings).
  const cursorFeedback: WorldSessionCursorFeedback = createWorldSessionCursorFeedback(scene, container);

  let previousPosition: PositionSnapshot | null = null;
  let lastClickTarget: ClickTargetSnapshot | null = null;
  let projectionMode: WorldProjectionMode = defaultWorldProjection;
  let selfScreenPosition: { readonly x: number; readonly y: number } | null = null;
  let cameraZoom = DEFAULT_CAMERA_ZOOM;
  let selfWorldPosition: { readonly x: number; readonly y: number } | null = null;
  let latestRoom: Room<DoomscrollsRoomState> = room;
  const previousEnemyHp = new Map<string, number>();
  const previousEnemyDefeated = new Map<string, boolean>();
  const previousEnemyRespawnAtMs = new Map<string, number>();
  const previousLootIds = new Set<string>();
  let pendingPickupWorldLootId: string | null = null;
  let pendingAttackTarget: PendingAttackState | null = null;
  let pendingLootPickup: PendingLootPickupState | null = null;
  let pendingInteractTarget: PendingInteractState | null = null;
  let heldMovementTarget: HeldMovementTargetSnapshot | null = null;
  let lastHeldMovementIntentAtMs = 0;
  let hoveredEnemyId: string | null = null;
  let selectedSkillTargetEnemyId: string | null = null;
  let selfSessionId: string | null = null;
  let wasInRestArea = false;
  const restAreaIndicator = scene.add.text(0, 0, "", {
    color: "#7ad8c0",
    fontFamily: "Arial, sans-serif",
    fontSize: "10px",
    fontStyle: "bold",
    stroke: "#0a1a18",
    strokeThickness: 3,
  }).setOrigin(0.5);
  worldContainer.add(restAreaIndicator);

  // --- Module-scope projection values ---
  // Input handlers are registered ONCE during setup (not per-frame) and read
  // these module-scope variables. refreshFromRoomState() updates them on
  // Colyseus state changes so the next input event sees the latest camera.
  let currentProjectionState: AreaWorldProjectionState = {
    projection: {
      bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
      viewport: { originX: layout.originX, originY: layout.originY, width: layout.width, height: layout.height },
      projectionMode,
    },
    offset: { x: 0, y: 0 },
    focusPosition: null,
  };

  // --- roomStateDirty ---
  // This flag gates the EXPENSIVE refresh path inside refreshFromRoomState().
  // When true, the next refreshFromRoomState() call will:
  //   - redraw viewport frame and grid/boundary graphics
  //   - destroy and recreate all static prop Phaser objects
  //   - destroy and recreate all interactable Phaser objects
  //
  // The flag is set to true when:
  //   - Colyseus room state changes (enemy spawn, loot drop, etc.)
  //   - camera zoom changes (setZoom)
  //   - projection mode changes (setProjectionMode)
  //   - pending pickup target changes (setPendingPickupTarget)
  //
  // The flag is reset to false after the expensive section completes.
  // The per-frame UPDATE loop (handleSceneUpdate) does NOT read this flag;
  // it never performs expensive work regardless of this flag's value.
  let roomStateDirty = true;

  const isPointerInsideViewport = (pointerX: number, pointerY: number): boolean => {
    const localX = pointerX - layout.originX;
    const localY = pointerY - layout.originY;
    return localX >= 0 && localY >= 0 && localX <= layout.width && localY <= layout.height;
  };

  const clearHeldMovementTarget = (): void => {
    heldMovementTarget = null;
  };

  const clearPendingAttack = (): void => {
    pendingAttackTarget = null;
  };

  const clearPendingLootPickup = (): void => {
    pendingLootPickup = null;
  };

  const clearPendingInteract = (): void => {
    pendingInteractTarget = null;
  };

  const clearAllTargeting = (): void => {
    clearHeldMovementTarget();
    clearPendingAttack();
    clearPendingLootPickup();
    clearPendingInteract();
  };

  const resolveWorldTargetFromPointer = (
    pointer: Phaser.Input.Pointer,
    worldOffset: WorldContainerOffset,
    worldProjection: AreaProjectionContext,
  ): ClickTargetSnapshot | null => {
    if (worldProjection.projectionMode !== "debug_top_down" || !isPointerInsideViewport(pointer.x, pointer.y)) {
      return null;
    }

    const screenPoint = screenToWorldActiveProjection(
      pointer.x - worldOffset.x,
      pointer.y - worldOffset.y,
      worldProjection.bounds,
      worldProjection.viewport,
      worldProjection.projectionMode,
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

  const clampZoom = (value: number): number => Math.min(Math.max(value, MIN_CAMERA_ZOOM), MAX_CAMERA_ZOOM);
  const setZoom = (value: number): void => {
    const nextZoom = clampZoom(value);
    if (nextZoom === cameraZoom) {
      return;
    }
    cameraZoom = nextZoom;
    roomStateDirty = true;
    refreshFromRoomState(latestRoom);
    onDebugStateChange?.();
  };

  scene.input.on(Phaser.Input.Events.POINTER_WHEEL, (_pointer: Phaser.Input.Pointer, _currentlyOver: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
    const step = deltaY > 0 ? -CAMERA_ZOOM_STEP : CAMERA_ZOOM_STEP;
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
      key.on("down", () => {
        if (shouldIgnoreWorldSessionCombatHotkey()) return;
        setZoom(cameraZoom + CAMERA_ZOOM_STEP);
      });
    }
    for (const key of zoomOutKeys) {
      key.on("down", () => {
        if (shouldIgnoreWorldSessionCombatHotkey()) return;
        setZoom(cameraZoom - CAMERA_ZOOM_STEP);
      });
    }
  }

  // --- Input handler registration (ONE-TIME setup) ---
  // These handlers are registered ONCE during scene setup. They read
  // currentProjectionState from module scope, which refreshFromRoomState()
  // keeps up to date on Colyseus state changes.
  //
  // GUARD: These must NOT be registered inside refreshFromRoomState() or
  // the UPDATE loop. Re-registering at ~60fps caused the primary lag
  // issue fixed in Task 307. Future changes must preserve this one-time
  // registration pattern.
  inputZone.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
    const localX = pointer.x - layout.originX;
    const localY = pointer.y - layout.originY;
    if (localX < 0 || localY < 0 || localX > layout.width || localY > layout.height) {
      return;
    }

    if (pointerHandledByTarget) {
      pointerHandledByTarget = false;
      return;
    }

    const worldOffset = currentProjectionState.offset;
    const worldProjection = currentProjectionState.projection;

    const hitEnemy = findClickedEnemy(enemyScreenPositions, pointer.x, pointer.y);
    const hitLoot = findClickedWorldLoot(lootScreenPositions, pointer.x, pointer.y);
    const hitCorpse = findClickedOwnCorpse(
      corpseScreenPositions, pointer.x, pointer.y, selfSessionId, selfWorldPosition,
    );
    const hitInteractable = interactablesView.findClickedInteractable(pointer.x, pointer.y);

    let groundTarget: { targetX: number; targetY: number } | null = null;
    if (projectionMode === "debug_top_down") {
      const projected = resolveWorldTargetFromPointer(pointer, worldOffset, worldProjection);
      if (projected !== null) {
        groundTarget = { targetX: projected.x, targetY: projected.y };
      }
    }

    const ctx: WorldInteractionPointerContext = {
      isRightButton: pointer.rightButtonDown(),
      enemy: hitEnemy !== null
        ? { id: hitEnemy.id, worldX: hitEnemy.worldX, worldY: hitEnemy.worldY }
        : null,
      loot: hitLoot !== null
        ? { id: hitLoot.id, worldX: hitLoot.worldX, worldY: hitLoot.worldY }
        : null,
      corpse: hitCorpse !== null
        ? { worldX: hitCorpse.worldX, worldY: hitCorpse.worldY, inRange: hitCorpse.inRange }
        : null,
      interactable: hitInteractable !== null
        ? { objectId: hitInteractable.objectId, worldX: hitInteractable.worldX, worldY: hitInteractable.worldY }
        : null,
      groundTarget,
    };

    const intent = resolveWorldInteraction(ctx);
    if (intent === null) {
      return;
    }

    switch (intent.kind) {
      case "skill_enemy": {
        selectedSkillTargetEnemyId = intent.enemyId;
        hoveredEnemyId = intent.enemyId;
        break;
      }
      case "move": {
        heldMovementTarget = { x: intent.targetX, y: intent.targetY, pointerId: pointer.id };
        lastHeldMovementIntentAtMs = scene.time.now;
        clearPendingAttack();
        clearPendingLootPickup();
        clearPendingInteract();
        break;
      }
      default: {
        clearAllTargeting();
        break;
      }
    }

    const dispatchResult = dispatchWorldInteraction(room, intent);

    switch (intent.kind) {
      case "skill_enemy": {
        if (dispatchResult.dispatched) {
          const selfPosition = selfWorldPosition;
          const skillDistance = selfPosition === null || hitEnemy === null
            ? null
            : Math.hypot(
                hitEnemy.worldX - selfPosition.x,
                hitEnemy.worldY - selfPosition.y,
              );
          onAttackFeedback?.(
            skillDistance !== null && skillDistance > graveSparkRange
              ? t("world_area.skill_moving_closer" as never)
              : t("world_area.skill_sent"),
          );
        } else {
          onPickupFeedback?.(t("world_area.skill_unavailable"));
        }
        const targetEnemy = getTownRoomEnemies(room.state).find(
          (e) => e.id === intent.enemyId,
        );
        if (targetEnemy) {
          lastClickTarget = { x: targetEnemy.x, y: targetEnemy.y };
        }
        break;
      }
      case "attack_enemy": {
        if (dispatchResult.dispatched) {
          const selfPos = selfWorldPosition;
          const isInRange = selfPos !== null && hitEnemy !== null &&
            Math.hypot(hitEnemy.worldX - selfPos.x, hitEnemy.worldY - selfPos.y) <= BASIC_ATTACK_RANGE;

          if (isInRange) {
            onAttackFeedback?.(t("world_area.attack_sent"));
          } else if (hitEnemy !== null) {
            sendMovementIntent(room, hitEnemy.worldX, hitEnemy.worldY);
            pendingAttackTarget = {
              enemyId: intent.enemyId,
              targetWorldX: hitEnemy.worldX,
              targetWorldY: hitEnemy.worldY,
            };
            onAttackFeedback?.(t("world_area.attack_moving_closer"));
          } else {
            onAttackFeedback?.(t("world_area.attack_sent"));
          }
        }
        clearAllTargeting();
        if (hitEnemy !== null) {
          lastClickTarget = { x: hitEnemy.worldX, y: hitEnemy.worldY };
        }
        break;
      }
      case "pickup_loot": {
        if (dispatchResult.dispatched) {
          const selfPos = selfWorldPosition;
          const isInRange = selfPos !== null && hitLoot !== null &&
            Math.hypot(hitLoot.worldX - selfPos.x, hitLoot.worldY - selfPos.y) <= WORLD_LOOT_PICKUP_RANGE;

          if (isInRange) {
            pendingPickupWorldLootId = dispatchResult.pendingPickupLootId;
            const targetLoot = getTownRoomWorldLoot(room.state).find(
              (entry) => entry.id === intent.worldLootId,
            );
            if (targetLoot !== undefined) {
              onPickupFeedback?.(`${t("world_area.pickup_sent")} ${formatPickupFeedbackLabel(targetLoot)}`);
            }
          } else if (hitLoot !== null) {
            sendMovementIntent(room, hitLoot.worldX, hitLoot.worldY);
            pendingLootPickup = {
              worldLootId: intent.worldLootId,
              targetWorldX: hitLoot.worldX,
              targetWorldY: hitLoot.worldY,
            };
            onPickupFeedback?.(t("world_area.pickup_moving_closer"));
          } else {
            pendingPickupWorldLootId = dispatchResult.pendingPickupLootId;
          }
        }
        if (hitLoot !== null) {
          lastClickTarget = { x: hitLoot.worldX, y: hitLoot.worldY };
        }
        break;
      }
      case "corpse_recover": {
        if (intent.inRange) {
          onAttackFeedback?.(t("world_area.corpse_recovered"));
        } else {
          onAttackFeedback?.(t("world_area.corpse_interact_out_of_range"));
        }
        break;
      }
      case "interact_object": {
        const selfPos = selfWorldPosition;
        const isInRange = selfPos !== null && hitInteractable !== null &&
          Math.hypot(hitInteractable.worldX - selfPos.x, hitInteractable.worldY - selfPos.y) <= INTERACT_RANGE;

        if (isInRange) {
          if (hitInteractable !== null) {
            lastClickTarget = { x: hitInteractable.worldX, y: hitInteractable.worldY };
          }
        } else if (hitInteractable !== null) {
          sendMovementIntent(room, hitInteractable.worldX, hitInteractable.worldY);
          pendingInteractTarget = {
            objectId: intent.objectId,
            targetWorldX: hitInteractable.worldX,
            targetWorldY: hitInteractable.worldY,
          };
          onPickupFeedback?.(t("world_area.interact_moving_closer"));
          lastClickTarget = { x: hitInteractable.worldX, y: hitInteractable.worldY };
        }
        break;
      }
      case "move": {
        lastClickTarget = { x: intent.targetX, y: intent.targetY };
        break;
      }
    }
    onDebugStateChange?.();
  });

  // Task 314 — Enhanced POINTER_MOVE handler. Updates hover cursor feedback
  // (label + highlight rings) for all world target types. Uses the same hit
  // logic as the click handlers so hover feedback matches click priority.
  // No per-frame objects created — only text/setStyle calls and visibility
  // toggles on existing Phaser objects.
  inputZone.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
    // Update enemy hover tracking (existing logic for skill targeting)
    const hoveredEnemy = findClickedEnemy(enemyScreenPositions, pointer.x, pointer.y);
    const nextHoveredEnemyId = hoveredEnemy?.id ?? null;
    if (nextHoveredEnemyId !== hoveredEnemyId) {
      // Clear previous enemy hover highlight
      if (hoveredEnemyId !== null) {
        const prevEnemyView = enemyPlaceholders.get(hoveredEnemyId);
        prevEnemyView?.setHovered(false);
      }
      hoveredEnemyId = nextHoveredEnemyId;
      // Apply new enemy hover highlight
      if (hoveredEnemyId !== null) {
        const nextEnemyView = enemyPlaceholders.get(hoveredEnemyId);
        nextEnemyView?.setHovered(true);
      }
      onDebugStateChange?.();
    }

    // Resolve world cursor target for hover label (matches click priority)
    const inViewport = isPointerInsideViewport(pointer.x, pointer.y);
    if (inViewport) {
      const hoverTarget = resolveHoverTarget(
        pointer.x,
        pointer.y,
        enemyScreenPositions,
        lootScreenPositions,
        corpseScreenPositions,
        selfSessionId,
        selfWorldPosition,
        interactablesView,
        projectionMode,
      );

      if (hoverTarget !== null) {
        cursorFeedback.setPosition(pointer.x, pointer.y);
        cursorFeedback.updateHover(hoverTarget);
        cursorFeedback.setVisible(true);
      } else {
        cursorFeedback.updateHover(null);
        cursorFeedback.setVisible(false);
      }
    } else {
      cursorFeedback.updateHover(null);
      cursorFeedback.setVisible(false);
    }

    // Handle held movement
    if (!pointer.leftButtonDown()) {
      clearHeldMovementTarget();
      return;
    }

    if (heldMovementTarget === null || heldMovementTarget.pointerId !== pointer.id) {
      return;
    }

    const target = resolveWorldTargetFromPointer(pointer, currentProjectionState.offset, currentProjectionState.projection);
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

  // --- refreshFromRoomState (EXPENSIVE — called on state changes only) ---
  // This function is the ONLY place where expensive Phaser object
  // creation/destruction happens. It is called:
  //   1. On Colyseus room.onStateChange (via WorldSessionScene)
  //   2. During initial scene setup
  //   3. When setPendingPickupTarget() is called (sets roomStateDirty first)
  //
  // It must NEVER be called from the per-frame UPDATE loop (handleSceneUpdate).
  //
  // Internal structure:
  //   [A] Projection + container offset — always runs (lightweight math)
  //   [B] roomStateDirty section — EXPENSIVE: redraws graphics, rebuilds
  //       static props and interactables (destroy/recreate Phaser objects)
  //   [C] Enemy/loot/corpse processing — runs on every call for entity
  //       tracking, but only destroys/creates individual entities (not all)
  //   [D] Player position + rest area — lightweight: moves existing objects,
  //       updates text labels
  const refreshFromRoomState = (nextRoom: Room<DoomscrollsRoomState>): void => {
    latestRoom = nextRoom;
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
      currentFocusPosition,
    );
    const worldOffset = resolveWorldContainerOffset(layout, worldProjection, currentFocusPosition);

    // [A] Update module-scope projection values for input handlers.
    //     Lightweight — no Phaser object creation or destruction.
    currentProjectionState = {
      projection: worldProjection,
      offset: worldOffset,
      focusPosition: currentFocusPosition,
    };

    worldContainer.setPosition(worldOffset.x, worldOffset.y);
    worldFrame.setPosition(worldOffset.x, worldOffset.y);
    interactablesView.setScreenOffset(worldOffset.x, worldOffset.y);

    // Camera movement / zoom changes must reproject every world object even
    // when no authoritative room state changed. This path is lightweight:
    // it updates positions only and does not rebuild display objects.
    staticPropsView.updateProjection({
      zoneId,
      bounds: worldProjection.bounds,
      viewport: worldProjection.viewport,
      projectionMode: worldProjection.projectionMode,
    });
    interactablesView.updateProjection(nextRoom, worldProjection);

    // [B] EXPENSIVE: Only when roomStateDirty. Destroys and recreates
    //     static props, interactables, and redraws graphics. This is the
    //     main cost guard — when dirty is false this block is skipped
    //     entirely and no Phaser objects are touched.
    if (roomStateDirty) {
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
      roomStateDirty = false;
    }

    // [C] Entity processing — runs on every refreshFromRoomState call for
    //     state tracking (HP changes, defeats, respawns, loot spawn/despawn,
    //     corpse markers). Individual entities are created/destroyed as they
    //     appear/disappear, but this is NOT a full rebuild — only changed
    //     entities are touched.
    //
    // --- Enemy snapshot processing ---
    // Guardrail: keep a strict distinction between:
    //   1) server-known enemies (`currentEnemies` from room state),
    //   2) client-rendered visible enemies (`enemyPlaceholders`), and
    //   3) client-clickable visible enemies (`enemyScreenPositions`).
    // We may keep a placeholder instance alive for perf, but only enemies
    // inside the current live viewport projection are rendered/clickable.
    const currentEnemies = getTownRoomEnemies(nextRoom.state);
    enemyScreenPositions.clear();
    const projectedEnemies = currentEnemies
      .map((enemy: TownRoomEnemySnapshot) => projectEnemyToArea(enemy, worldProjection, ENTITY_VIEWPORT_PADDING_PX))
      .filter((enemy: ProjectedEnemySnapshot | null): enemy is ProjectedEnemySnapshot => enemy !== null);
    const currentEnemyIds = new Set(currentEnemies.map((enemy: TownRoomEnemySnapshot) => enemy.id));

    for (const [id, view] of enemyPlaceholders.entries()) {
      if (!currentEnemyIds.has(id)) {
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

      if (!projectedEnemy.isVisible) {
        enemyView.hide();
      }

      if (projectedEnemy.isVisible) {
        enemyScreenPositions.set(enemy.id, {
          id: enemy.id,
          label: t(enemy.label),
          x: projectedEnemy.screenX + worldOffset.x,
          y: projectedEnemy.screenY + worldOffset.y,
          worldX: enemy.x,
          worldY: enemy.y,
          defeated: enemy.defeated,
          isVisible: true,
        });
      }

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

    // --- World loot processing (continues [C]) ---
    const currentWorldLoot = getTownRoomWorldLoot(nextRoom.state);
    const projectedWorldLoot = currentWorldLoot
      .map((loot: TownRoomWorldLootSnapshot) => projectWorldLootToArea(loot, worldProjection))
      .filter((loot: TownRoomWorldLootSnapshot | null): loot is TownRoomWorldLootSnapshot => loot !== null);
    const newWorldLootIds = new Set(projectedWorldLoot.map((loot: TownRoomWorldLootSnapshot) => loot.id));

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

    // --- Corpse marker processing (continues [C]) ---
    const currentCorpsePlayerIds = new Set<string>();
    corpseScreenPositions.clear();
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
          corpseScreenPositions.set(player.sessionId, {
            sessionId: player.sessionId,
            x: screenPos.x + worldOffset.x,
            y: screenPos.y + worldOffset.y,
            worldX: corpsePos.x,
            worldY: corpsePos.y,
          });
          let marker = corpseMarkers.get(player.sessionId);
          const isOwnCorpse = player.sessionId === selfSessionId;
          if (marker === undefined) {
            marker = scene.add.container(screenPos.x, screenPos.y);
            marker.setDepth(350 + corpsePos.y);
            if (isOwnCorpse) {
              // Task 311 — own corpse marker: larger, brighter, with a
              // pulsing glow tween and a "Click to recover" prompt so
              // the player can immediately distinguish their corpse
              // from defeated enemies and other players' corpses.
              const markerGlow = scene.add.ellipse(0, 0, 36, 36, 0x20aaaa, 0.18);
              const markerBg = scene.add.ellipse(0, 12, 28, 16, 0x003333, 0.5);
              const markerBody = scene.add.rectangle(0, 0, 18, 26, 0x2a6060, 0.92);
              markerBody.setStrokeStyle(2, 0x5ad0d0, 0.95);
              const markerCross = scene.add.circle(0, -14, 6, 0x206060, 0.9);
              markerCross.setStrokeStyle(2, 0x5ad0d0, 0.95);
              const markerLabel = scene.add.text(0, -30, "☠ " + player.displayName, {
                color: "#5aeaea",
                fontFamily: "Arial, sans-serif",
                fontSize: "10px",
                fontStyle: "bold",
                stroke: "#0a2020",
                strokeThickness: 3,
              }).setOrigin(0.5);
              const recoverLabel = scene.add.text(0, 26, "Click to recover", {
                color: "#a0f0f0",
                fontFamily: "Arial, sans-serif",
                fontSize: "9px",
                fontStyle: "bold",
                stroke: "#0a2020",
                strokeThickness: 3,
                backgroundColor: "rgba(10, 40, 40, 0.85)",
                padding: { left: 4, right: 4, top: 2, bottom: 2 },
              }).setOrigin(0.5);
              marker.add([markerGlow, markerBg, markerBody, markerCross, markerLabel, recoverLabel]);
              // Subtle pulsing glow so own corpse draws attention.
              const pulseTween = scene.tweens.add({
                targets: markerGlow,
                alpha: { from: 0.18, to: 0.45 },
                scaleX: { from: 1, to: 1.3 },
                scaleY: { from: 1, to: 1.3 },
                duration: 900,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut",
              });
              corpseGlowTweens.set(player.sessionId, pulseTween);
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
            marker.setDepth(350 + corpsePos.y);
          }
        }
      }
    }
    for (const [sessionId, marker] of corpseMarkers.entries()) {
      if (!currentCorpsePlayerIds.has(sessionId)) {
        const pt = corpseGlowTweens.get(sessionId);
        if (pt !== undefined) {
          pt.stop();
          corpseGlowTweens.delete(sessionId);
        }
        marker.destroy(true);
        corpseMarkers.delete(sessionId);
      }
    }

    // [D] Player position + rest area — lightweight. Moves existing
    //     Phaser objects (playerPlaceholder, targetMarker, restAreaIndicator),
    //     updates text labels and line graphic. No object creation or
    //     destruction.
    // --- Player position and rest area ---
    if (self?.position === undefined) {
      hoveredEnemyId = null;
      corpseScreenPositions.clear();
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

    if (hoveredEnemyId !== null && !enemyScreenPositions.has(hoveredEnemyId)) {
      enemyPlaceholders.get(hoveredEnemyId)?.setHovered(false);
      hoveredEnemyId = null;
    }

    if (selectedSkillTargetEnemyId !== null) {
      const selectedTarget = enemyScreenPositions.get(selectedSkillTargetEnemyId);
      if (selectedTarget === undefined || selectedTarget.defeated || !selectedTarget.isVisible) {
        selectedSkillTargetEnemyId = null;
      }
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
    playerPlaceholder.setInfo(self.displayName, self.hp, self.maxHp);
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

    const isInRestArea = checkPlayerInRestArea(zoneId, x, y);
    if (isInRestArea && !wasInRestArea) {
      wasInRestArea = true;
      onPickupFeedback?.(t("world_session.rest_area_entered"));
    } else if (!isInRestArea && wasInRestArea) {
      wasInRestArea = false;
      onPickupFeedback?.(t("world_session.rest_area_exited"));
    }
    restAreaIndicator.setText(isInRestArea ? "Rest Area" : "");
    restAreaIndicator.setPosition(
      playerScreenPosition.x,
      playerScreenPosition.y - 36,
    );

    statusLabel.setText(
      previousPosition !== null && (previousPosition.x !== x || previousPosition.y !== y)
        ? t("world_area.server_position_updated")
        : "",
    );
    previousPosition = { x, y };
  };

  // --- Per-frame UPDATE handler (LIGHTWEIGHT — ~60fps) ---
  // This runs every frame via Phaser's UPDATE event. It MUST remain
  // lightweight: no Phaser object creation/destruction, no graphics
  // redraw, no full prop/interactable rebuild, no input listener
  // registration.
  //
  // Current responsibilities:
  //   - Held movement throttle (dispatches movement intent at intervals)
  //   - Pending attack range check (fires when player reaches target)
  //   - Pending loot pickup range check (fires when player reaches loot)
  //   - Pending interact range check (fires when player reaches object)
  //
  // GUARD: Do not add refreshFromRoomState(), staticPropsView.refresh(),
  // interactablesView.refresh(), drawViewportFrame(), drawBounds(), or
  // any inputZone.on() calls here. The expensive refresh path lives
  // exclusively in refreshFromRoomState(), triggered by Colyseus state
  // changes.
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

    if (pendingAttackTarget !== null && selfWorldPosition !== null) {
      const result = checkPendingAttack(room, pendingAttackTarget, selfWorldPosition.x, selfWorldPosition.y);
      if (result.attackSent) {
        clearPendingAttack();
        onAttackFeedback?.(t("world_area.attack_sent"));
      }
    }

    if (pendingLootPickup !== null && selfWorldPosition !== null) {
      const result = checkPendingLootPickup(room, pendingLootPickup, selfWorldPosition.x, selfWorldPosition.y);
      if (result.pickupSent) {
        pendingPickupWorldLootId = pendingLootPickup.worldLootId;
        clearPendingLootPickup();
        onPickupFeedback?.(t("world_area.pickup_sent"));
      }
    }

    if (pendingInteractTarget !== null && selfWorldPosition !== null) {
      const result = checkPendingInteract(room, pendingInteractTarget, selfWorldPosition.x, selfWorldPosition.y);
      if (result.interactSent) {
        clearPendingInteract();
        onPickupFeedback?.(t("world_area.interact_moving_closer"));
      }
    }
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
    roomStateDirty = true;
    refreshFromRoomState(latestRoom);
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

  // Task 310 — brief enemy body flash on server-confirmed hit.
  const showEnemyHitFlash = (enemyId: string): void => {
    const view = enemyPlaceholders.get(enemyId);
    if (view !== undefined) {
      view.flashHit();
    }
  };

  // Task 311 — brief red flash on the player body when server-confirmed
  // damage lands. Delegates to the player placeholder's flashDamage()
  // which tweens a red overlay without modifying base torso state.
  const showPlayerHitFlash = (): void => {
    playerPlaceholder.flashDamage();
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
    showEnemyHitFlash,
    showPlayerHitFlash,
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
      roomStateDirty = true;
      refreshFromRoomState(room);
    },
    destroy: () => {
      canvasElement.removeEventListener("contextmenu", handleContextMenu);
      scene.events.off(Phaser.Scenes.Events.UPDATE, handleSceneUpdate);
      scene.input.off(Phaser.Input.Events.POINTER_WHEEL);
      // Task 307 — Remove input zone listeners registered once in setup.
      inputZone.removeAllListeners();
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
      corpseScreenPositions.clear();
      for (const pt of corpseGlowTweens.values()) {
        pt.stop();
      }
      corpseGlowTweens.clear();
      floatingDamageView.destroy();
      cursorFeedback.destroy();
      restAreaIndicator.setText("");
      selfScreenPosition = null;
      container.destroy(true);
    },
  };
}

function findClickedOwnCorpse(
  corpseScreenPositions: ReadonlyMap<string, CorpseScreenPositionSnapshot>,
  pointerX: number,
  pointerY: number,
  selfSessionId: string | null,
  selfWorldPosition: { readonly x: number; readonly y: number } | null,
): { readonly worldX: number; readonly worldY: number; readonly inRange: boolean } | null {
  if (selfSessionId === null || selfWorldPosition === null) {
    return null;
  }
  const corpse = corpseScreenPositions.get(selfSessionId);
  if (corpse === undefined) {
    return null;
  }

  const dx = pointerX - corpse.x;
  const dy = pointerY - corpse.y;
  const hitRadiusPx = 24;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared > hitRadiusPx * hitRadiusPx) {
    return null;
  }

  const worldDx = corpse.worldX - selfWorldPosition.x;
  const worldDy = corpse.worldY - selfWorldPosition.y;
  const worldDist = Math.sqrt(worldDx * worldDx + worldDy * worldDy);
  const inRange = worldDist <= 30;

  return {
    worldX: corpse.worldX,
    worldY: corpse.worldY,
    inRange,
  };
}

/**
 * Task 314 — Non-interactive variant of findClickedOwnCorpse used for
 * hover detection only. Returns a simple boolean when the pointer is
 * over the player's own corpse, without distance/range info.
 */
function findClickedOwnCorpseInteractive(
  corpseScreenPositions: ReadonlyMap<string, CorpseScreenPositionSnapshot>,
  pointerX: number,
  pointerY: number,
  selfSessionId: string | null,
  selfWorldPosition: { readonly x: number; readonly y: number } | null,
): boolean {
  if (selfSessionId === null || selfWorldPosition === null) {
    return false;
  }
  const corpse = corpseScreenPositions.get(selfSessionId);
  if (corpse === undefined) {
    return false;
  }

  const dx = pointerX - corpse.x;
  const dy = pointerY - corpse.y;
  const hitRadiusPx = 24;
  const distanceSquared = dx * dx + dy * dy;
  return distanceSquared <= hitRadiusPx * hitRadiusPx;
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
    if (position.defeated || !position.isVisible) {
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
  viewportPaddingPx: number,
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
    isVisible: isScreenPointInsideViewport(
      projectedPosition.x,
      projectedPosition.y,
      projection.viewport,
      viewportPaddingPx,
    ),
  };
}

function isScreenPointInsideViewport(
  x: number,
  y: number,
  viewport: WorldProjectionViewport,
  paddingPx: number,
): boolean {
  // worldToScreenActiveProjection() returns coordinates in the viewport's
  // local projection space; worldContainer/current screen offsets are applied
  // later. Visibility must therefore use the same pre-offset local space.
  const left = -paddingPx;
  const right = viewport.width + paddingPx;
  const top = -paddingPx;
  const bottom = viewport.height + paddingPx;
  return x >= left && x <= right && y >= top && y <= bottom;
}

/**
 * Create an area projection context centered on the given focus position.
 *
 * The camera bounds are centered on the focus position (typically the player)
 * so that zooming in/out pivots around the player rather than the world
 * top-left corner. This keeps the player as the visual anchor when zooming.
 *
 * When `focusPosition` is null (no player position known yet), the context
 * falls back to the world top-left anchor to keep the projection valid.
 */
function createAreaProjectionContext(
  layout: WorldSessionAreaLayout,
  bounds: WorldProjectionBounds,
  projectionMode: WorldProjectionMode,
  zoom: number,
  focusPosition: { readonly x: number; readonly y: number } | null,
): AreaProjectionContext {
  const clampedZoom = Math.min(Math.max(zoom, 0.55), 1.9);
  const fullWidth = bounds.maxX - bounds.minX;
  const fullHeight = bounds.maxY - bounds.minY;
  const visibleWidth = Math.min(fullWidth, fullWidth / clampedZoom);
  const visibleHeight = Math.min(fullHeight, fullHeight / clampedZoom);

  let minX = bounds.minX;
  let minY = bounds.minY;

  if (focusPosition !== null) {
    minX = focusPosition.x - visibleWidth / 2;
    minY = focusPosition.y - visibleHeight / 2;
    if (minX < bounds.minX) { minX = bounds.minX; }
    if (minY < bounds.minY) { minY = bounds.minY; }
    if (minX + visibleWidth > bounds.maxX) { minX = bounds.maxX - visibleWidth; }
    if (minY + visibleHeight > bounds.maxY) { minY = bounds.maxY - visibleHeight; }
  }

  const cameraBounds: WorldProjectionBounds = {
    minX,
    maxX: minX + visibleWidth,
    minY,
    maxY: minY + visibleHeight,
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