import type {
  InteractResponseServerMessage,
  RequestAttackAcceptedServerMessage,
  RequestPickupWorldLootAcceptedServerMessage,
  XpGainedServerMessage,
} from "@doomscrolls/shared";

import { CharacterRepository } from "../../persistence/repositories";

import { consumeAttackCooldown } from "./attackCooldown";
import { validateAttackIntent } from "./attackIntentValidation";
import { applyEnemyDamage } from "./applyEnemyDamage";
import { getInteractableResponseMessage, validateInteractIntent } from "./interactValidation";
import type { PlayerPresence } from "./PlayerPresence";
import { clearPendingAction } from "./pendingActionState";
import { persistPickedUpWorldLootToInventory } from "./pickupWorldLootInventory";
import { validatePickupWorldLootIntent } from "./pickupWorldLootValidation";
import { spawnWorldLootOnEnemyDefeat } from "./spawnWorldLootOnEnemyDefeat";
import type { TownRoomState } from "./TownRoomState";
import { resolveLevelProgression } from "./levelProgression";

export interface DeferredActionExecutionContext {
  readonly state: TownRoomState;
  readonly player: PlayerPresence;
  readonly now: number;
  readonly sendToClient: (type: string, payload: unknown) => void;
}

const TRASHBOAR_RUNT_XP_REWARD = 5;

async function grantEnemyDefeatXp(player: PlayerPresence, enemyId: string, sendToClient: (type: string, payload: unknown) => void): Promise<void> {
  if (enemyId !== "trashboar_runt") {
    return;
  }

  const nextXp = player.xp + TRASHBOAR_RUNT_XP_REWARD;
  const progression = resolveLevelProgression(player.level, nextXp);
  player.xp = progression.xp;
  player.level = progression.level;

  await new CharacterRepository().updateXpAndLevel(player.characterId, progression.xp, progression.level);

  const xpGained: XpGainedServerMessage = {
    type: "xp_gained",
    characterId: player.characterId,
    amount: TRASHBOAR_RUNT_XP_REWARD,
    totalXp: progression.xp,
    level: progression.level,
    leveledUp: progression.leveledUp,
  };
  sendToClient("xp_gained", xpGained);
}

export async function tryExecutePendingAction(context: DeferredActionExecutionContext): Promise<void> {
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
      await grantEnemyDefeatXp(player, validation.enemy.enemyId, sendToClient);
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

    clearPendingAction(player);
    const pickupResult = await persistPickedUpWorldLootToInventory({
      characterId: player.characterId,
      itemDefinitionId: validation.worldLoot.itemId,
      itemLabel: validation.worldLoot.label,
    });

    if (!pickupResult.ok) {
      const message = pickupResult.reason === "inventory_full"
        ? "Inventory full."
        : "Pickup unavailable.";
      sendToClient("request_pickup_world_loot_rejected", {
        type: "request_pickup_world_loot_rejected",
        reason: pickupResult.reason === "inventory_full" ? "inventory_full" : "world_loot_not_found",
        worldLootId: validation.worldLoot.id,
      });
      sendToClient("interact_response", {
        type: "interact_response",
        objectId: validation.worldLoot.id,
        message,
      });
      return;
    }

    state.worldLoot.delete(validation.worldLoot.id);
    const accepted: RequestPickupWorldLootAcceptedServerMessage = {
      type: "request_pickup_world_loot_accepted",
      worldLootId: validation.worldLoot.id,
      message: pickupResult.message,
    };
    sendToClient("request_pickup_world_loot_accepted", accepted);
    return;
  }

  clearPendingAction(player);
}