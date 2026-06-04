import type {
  InteractResponseServerMessage,
  RequestAttackAcceptedServerMessage,
  RequestPickupWorldLootAcceptedServerMessage,
} from "@doomscrolls/shared";

import { consumeAttackCooldown } from "./attackCooldown";
import { validateAttackIntent } from "./attackIntentValidation";
import { applyEnemyDamage } from "./applyEnemyDamage";
import { getInteractableResponseMessage, validateInteractIntent } from "./interactValidation";
import type { PlayerPresence } from "./PlayerPresence";
import { clearPendingAction } from "./pendingActionState";
import { validatePickupWorldLootIntent } from "./pickupWorldLootValidation";
import { spawnWorldLootOnEnemyDefeat } from "./spawnWorldLootOnEnemyDefeat";
import type { TownRoomState } from "./TownRoomState";

export interface DeferredActionExecutionContext {
  readonly state: TownRoomState;
  readonly player: PlayerPresence;
  readonly now: number;
  readonly sendToClient: (type: string, payload: unknown) => void;
}

export function tryExecutePendingAction(context: DeferredActionExecutionContext): void {
  const { state, player, now, sendToClient } = context;
  if (!player.hasPendingAction) {
    return;
  }

  const actionType = player.pendingActionType;
  const targetId = player.pendingTargetId;

  if (actionType === "attack") {
    const enemy = state.enemies.get(targetId);
    if (enemy === undefined || enemy.defeated || enemy.hp <= 0) {
      clearPendingAction(player);
      return;
    }
  }

  if (actionType === "interact") {
    const interactable = state.interactables.get(targetId);
    if (interactable === undefined) {
      clearPendingAction(player);
      return;
    }
  }

  if (actionType === "pickup") {
    const worldLoot = state.worldLoot.get(targetId);
    if (worldLoot === undefined) {
      clearPendingAction(player);
      return;
    }
  }

  if (actionType === "attack") {
    const validation = validateAttackIntent(state, player, targetId, now);
    if (!validation.ok) {
      if (validation.reason !== "out_of_range") {
        clearPendingAction(player);
      }
      return;
    }

    consumeAttackCooldown(player, now);
    const damageResult = applyEnemyDamage(validation.enemy, 1);
    if (damageResult.defeated) {
      spawnWorldLootOnEnemyDefeat(state, validation.enemy, now);
    }

    const accepted: RequestAttackAcceptedServerMessage = {
      type: "request_attack_accepted",
      targetEnemyId: validation.enemy.id,
    };
    sendToClient("request_attack_accepted", accepted);
    clearPendingAction(player);
    return;
  }

  if (actionType === "interact") {
    const validation = validateInteractIntent(state, player.x, player.y, targetId);
    if (!validation.ok) {
      if (validation.reason !== "out_of_range") {
        clearPendingAction(player);
      }
      return;
    }

    const response: InteractResponseServerMessage = {
      type: "interact_response",
      objectId: targetId,
      message: getInteractableResponseMessage(targetId),
    };
    sendToClient("interact_response", response);
    clearPendingAction(player);
    return;
  }

  if (actionType === "pickup") {
    const validation = validatePickupWorldLootIntent(state, player, targetId);
    if (!validation.ok) {
      if (validation.reason !== "out_of_range") {
        clearPendingAction(player);
      }
      return;
    }

    state.worldLoot.delete(validation.worldLoot.id);
    const accepted: RequestPickupWorldLootAcceptedServerMessage = {
      type: "request_pickup_world_loot_accepted",
      worldLootId: validation.worldLoot.id,
      message: `Picked up ${validation.worldLoot.label}`,
    };
    sendToClient("request_pickup_world_loot_accepted", accepted);
    clearPendingAction(player);
    return;
  }

  clearPendingAction(player);
}