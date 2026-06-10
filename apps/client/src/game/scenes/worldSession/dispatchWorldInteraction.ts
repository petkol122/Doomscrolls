/**
 * Task 285 — World Interaction Dispatcher
 *
 * Takes a resolved WorldInteractionIntent and executes the appropriate
 * network call. This is the single place where intents become network
 * messages — making it easy to audit, log, or intercept all outbound
 * player actions.
 *
 * The dispatcher also handles compound actions (e.g. corpse recovery
 * out of range → move first, then recover later). This is the only
 * place where multi-step intent logic lives; the resolver stays pure.
 *
 * Task 286: Attack-enemy intent now carries worldX/worldY so the caller
 * can detect out-of-range and queue a pending attack after movement.
 * The dispatcher always sends the attack intent immediately; the caller
 * (worldSessionAreaView) decides whether to also move first and retry
 * later.
 */

import type { Room } from "@colyseus/sdk";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import { sendMovementIntent } from "../../../net/movementIntentClient";
import { sendAttackIntent } from "../../../net/attackIntentClient";
import { sendSkillSlotIntent } from "../../../net/skillSlotIntentClient";
import { sendPickupWorldLootIntent } from "../../../net/pickupWorldLootClient";
import { sendCorpseInteractIntent } from "../../../net/corpseInteractClient";
import { sendInteractIntent } from "../../../net/interactIntentClient";
import type { WorldInteractionIntent } from "./WorldInteractionIntent";

export interface DispatchResult {
  /** Whether the network message was actually sent. */
  readonly dispatched: boolean;
  /** If a loot pickup was dispatched, its world loot ID for visual tracking. */
  readonly pendingPickupLootId: string | null;
  /**
   * If an attack_enemy intent was dispatched but the enemy was out of range,
   * the caller may use this to track a pending attack and fire it once
   * the player reaches range. Null when no pending attack is needed.
   */
  readonly pendingAttackTargetId: string | null;
  /**
   * World position used for the pending attack's range-check target.
   * Only meaningful when pendingAttackTargetId is non-null.
   */
  readonly pendingAttackTargetX: number;
  readonly pendingAttackTargetY: number;
  /**
   * If a pickup_loot intent was dispatched but the loot was out of range,
   * the caller may use this to track a pending pickup and fire it once
   * the player reaches range. Null when no pending pickup is needed.
   */
  readonly pendingPickupTargetId: string | null;
  /**
   * World position used for the pending pickup's range-check target.
   * Only meaningful when pendingPickupTargetId is non-null.
   */
  readonly pendingPickupTargetX: number;
  readonly pendingPickupTargetY: number;
  /**
   * If an interact_object intent was dispatched but the interactable was
   * out of range, the caller may use this to track a pending interact
   * and fire it once the player reaches range. Null when no pending
   * interact is needed.
   */
  readonly pendingInteractTargetId: string | null;
  /**
   * World position used for the pending interact's range-check target.
   * Only meaningful when pendingInteractTargetId is non-null.
   */
  readonly pendingInteractTargetX: number;
  readonly pendingInteractTargetY: number;
}

/**
 * Build a DispatchResult that has no pending attack or pickup tracking.
 */
function noPendingAttack(dispatched: boolean, pendingPickupLootId: string | null): DispatchResult {
  return {
    dispatched,
    pendingPickupLootId,
    pendingAttackTargetId: null,
    pendingAttackTargetX: 0,
    pendingAttackTargetY: 0,
    pendingPickupTargetId: null,
    pendingPickupTargetX: 0,
    pendingPickupTargetY: 0,
    pendingInteractTargetId: null,
    pendingInteractTargetX: 0,
    pendingInteractTargetY: 0,
  };
}

/**
 * Dispatch a resolved world interaction intent to the network layer.
 *
 * Returns a DispatchResult indicating whether the message was sent.
 * The caller (worldSessionAreaView) is responsible for displaying
 * feedback and managing visual state — this function only does
 * network I/O.
 *
 * For compound actions (corpse out of range → move + feedback),
 * the dispatcher sends both the movement intent and the feedback
 * message so the caller doesn't need special-case logic.
 */
export function dispatchWorldInteraction(
  room: Room<DoomscrollsRoomState>,
  intent: WorldInteractionIntent,
): DispatchResult {
  switch (intent.kind) {
    case "move": {
      sendMovementIntent(room, intent.targetX, intent.targetY);
      return noPendingAttack(true, null);
    }

    case "attack_enemy": {
      const result = sendAttackIntent(room, intent.enemyId);
      // The caller will check range via worldX/worldY and decide if a
      // pending attack + movement is needed. We always attempt the
      // network send first; the server will reject out-of-range.
      return {
        dispatched: result.dispatched,
        pendingPickupLootId: null,
        pendingAttackTargetId: result.dispatched ? intent.enemyId : null,
        pendingAttackTargetX: intent.worldX,
        pendingAttackTargetY: intent.worldY,
        pendingPickupTargetId: null,
        pendingPickupTargetX: 0,
        pendingPickupTargetY: 0,
        pendingInteractTargetId: null,
        pendingInteractTargetX: 0,
        pendingInteractTargetY: 0,
      };
    }

    case "skill_enemy": {
      const result = sendSkillSlotIntent(room, intent.enemyId);
      return noPendingAttack(result.dispatched, null);
    }

    case "pickup_loot": {
      const result = sendPickupWorldLootIntent(room, intent.worldLootId);
      // Always attempt the network send first; the server will reject
      // out-of-range. The caller will check range via worldX/worldY
      // and decide if a pending pickup + movement is needed.
      return {
        dispatched: result.dispatched,
        pendingPickupLootId: result.dispatched ? intent.worldLootId : null,
        pendingAttackTargetId: null,
        pendingAttackTargetX: 0,
        pendingAttackTargetY: 0,
        pendingPickupTargetId: result.dispatched ? intent.worldLootId : null,
        pendingPickupTargetX: intent.worldX,
        pendingPickupTargetY: intent.worldY,
        pendingInteractTargetId: null,
        pendingInteractTargetX: 0,
        pendingInteractTargetY: 0,
      };
    }

    case "corpse_recover": {
      if (intent.inRange) {
        sendCorpseInteractIntent(room);
        return noPendingAttack(true, null);
      }
      // Out of range: move toward corpse first. The server will handle
      // the actual recovery when the player gets close enough.
      sendMovementIntent(room, intent.worldX, intent.worldY);
      return noPendingAttack(true, null);
    }

    case "interact_object": {
      sendInteractIntent(room, intent.objectId);
      return noPendingAttack(true, null);
    }
  }
}