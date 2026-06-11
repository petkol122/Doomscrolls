import type {
  InteractResponseServerMessage,
  RequestAttackAcceptedServerMessage,
  RequestUseSkillSlotAcceptedServerMessage,
  RequestUseSkillSlotRejectedServerMessage,
  RequestPickupWorldLootAcceptedServerMessage,
  XpGainedServerMessage,
} from "@doomscrolls/shared";

import { CharacterRepository } from "../../persistence/repositories";
import { ItemRepository } from "../../persistence/repositories/ItemRepository";
import { contentRegistry } from "@doomscrolls/content";
import { CharacterStatsService } from "../../character/CharacterStatsService";

import { consumeAttackCooldown } from "./attackCooldown";
import { validateAttackIntent } from "./attackIntentValidation";
import { applyEnemyDamage } from "./applyEnemyDamage";
import { getInteractableResponseMessage, validateInteractIntent } from "./interactValidation";
import type { PlayerPresence } from "./PlayerPresence";
import { clearPendingAction } from "./pendingActionState";
import { dispatchPickedUpWorldLoot } from "./pickupWorldLootDispatcher";
import { validatePickupWorldLootIntent } from "./pickupWorldLootValidation";
import { spawnWorldLootOnEnemyDefeat } from "./spawnWorldLootOnEnemyDefeat";
import type { TownRoomState } from "./TownRoomState";
import { tryResolveLevelProgression } from "./levelProgression";
import { createRoomLogger } from "./roomLogger";

export interface DeferredActionExecutionContext {
  readonly state: TownRoomState;
  readonly player: PlayerPresence;
  readonly now: number;
  readonly sendToClient: (type: string, payload: unknown) => void;
}

const GRAVE_SPARK_RANGE = 96;
const GRAVE_SPARK_DAMAGE = 3;
const GRAVE_SPARK_COOLDOWN_MS = 1500;

const characterStatsService = new CharacterStatsService();
const log = createRoomLogger(undefined);

type ProgressionUpdateResult =
  | { readonly ok: true; readonly maxHp: number; readonly hp: number; readonly gainedMaxHp: number }
  | { readonly ok: false };

async function applyProgressionUpdate(
  player: PlayerPresence,
  progression: { readonly xp: number; readonly level: number; readonly leveledUp: boolean },
): Promise<ProgressionUpdateResult> {
  const characterRepository = new CharacterRepository();
  const character = await characterRepository.findProgressionContext(player.characterId);
  if (character === null) {
    log.warn?.(
      { event: "enemy_defeat_xp_skipped", reason: "missing_character", characterId: player.characterId },
      "Skipping enemy defeat XP because progression character context was not found.",
    );
    return { ok: false };
  }

  const origin = contentRegistry.origins.get(character.originId as never);
  const characterClass = contentRegistry.classes.get(character.classId as never);
  if (origin === undefined || characterClass === undefined) {
    throw new Error("Character progression content missing");
  }

  const equippedItems = await new ItemRepository().listEquippedItems(player.characterId);
  const modifiers = equippedItems.flatMap((equippedItem) => {
    const definition = contentRegistry.items.get(equippedItem.definitionId as never);
    return definition?.statModifiers ?? [];
  });

  const previousMaxHp = Number.isFinite(player.maxHp) ? Math.max(0, player.maxHp) : 0;
  const recalculated = characterStatsService.calculateEquippedStats(
    characterStatsService.calculateLevelScaledStats(origin.baseStats, characterClass.baseStats, progression.level).primary,
    modifiers,
    progression.level,
  );
  const nextMaxHp = Math.max(1, Math.floor(recalculated.derived.maxHp));
  const gainedMaxHp = Math.max(0, nextMaxHp - previousMaxHp);
  const nextHp = Math.min(nextMaxHp, Math.max(0, player.hp) + gainedMaxHp);

  try {
    await characterRepository.updateProgressionState(player.characterId, {
      xp: progression.xp,
      level: progression.level,
      currentHp: nextHp,
      stats: {
        ...recalculated.primary,
        ...recalculated.derived,
      },
    });
  } catch (error) {
    log.warn?.(
      {
        event: "enemy_defeat_xp_skipped",
        reason: "missing_stats_row",
        characterId: player.characterId,
        err: error,
      },
      "Skipping enemy defeat XP because progression stats could not be updated.",
    );
    return { ok: false };
  }

  player.xp = progression.xp;
  player.level = progression.level;
  player.maxHp = nextMaxHp;
  player.hp = nextHp;

  return { ok: true, maxHp: nextMaxHp, hp: nextHp, gainedMaxHp };
}

async function grantEnemyDefeatXp(player: PlayerPresence, enemyId: string, sendToClient: (type: string, payload: unknown) => void): Promise<void> {
  const enemyDefinition = contentRegistry.enemies.get(enemyId as never);
  if (enemyDefinition === undefined || !Number.isFinite(enemyDefinition.xp) || enemyDefinition.xp <= 0) {
    log.warn?.(
      { event: "enemy_defeat_xp_skipped", reason: "missing_enemy_xp", enemyId, characterId: player.characterId },
      "Skipping enemy defeat XP because enemy XP is missing or invalid.",
    );
    return;
  }

  const xpReward = enemyDefinition.xp;

  if (!Number.isFinite(player.xp) || player.xp < 0 || !Number.isFinite(player.level) || player.level < 1) {
    log.warn?.(
      {
        event: "enemy_defeat_xp_skipped",
        reason: "invalid_current_progression",
        enemyId,
        characterId: player.characterId,
        xp: player.xp,
        level: player.level,
      },
      "Skipping enemy defeat XP because the current player progression state is invalid.",
    );
    return;
  }

  const nextXp = player.xp + xpReward;
  const progressionResult = tryResolveLevelProgression(player.level, nextXp);
  if (!progressionResult.ok) {
    log.warn?.(
      {
        event: "enemy_defeat_xp_skipped",
        reason: progressionResult.reason,
        enemyId,
        characterId: player.characterId,
        nextXp,
        level: player.level,
      },
      "Skipping enemy defeat XP because level progression could not be resolved.",
    );
    return;
  }

  const progression = progressionResult.progression;
  const progressionUpdate = await applyProgressionUpdate(player, progression);
  if (!progressionUpdate.ok) {
    return;
  }

  const xpGained: XpGainedServerMessage = {
    type: "xp_gained",
    characterId: player.characterId,
    amount: xpReward,
    totalXp: progression.xp,
    level: progression.level,
    leveledUp: progression.leveledUp,
    hp: progressionUpdate.hp,
    maxHp: progressionUpdate.maxHp,
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

  if (actionType === "skill_secondary") {
    const enemy = state.enemies.get(targetId);
    if (enemy === undefined) {
      clearPendingAction(player);
      const rejection: RequestUseSkillSlotRejectedServerMessage = {
        type: "request_use_skill_slot_rejected",
        slot: "secondary",
        reason: "enemy_not_found",
      };
      sendToClient(rejection.type, rejection);
      return;
    }
    if (enemy.defeated || enemy.hp <= 0) {
      clearPendingAction(player);
      const rejection: RequestUseSkillSlotRejectedServerMessage = {
        type: "request_use_skill_slot_rejected",
        slot: "secondary",
        reason: "enemy_defeated",
      };
      sendToClient(rejection.type, rejection);
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
    const dispatchResult = await dispatchPickedUpWorldLoot({
      characterId: player.characterId,
      worldLoot: validation.worldLoot,
    });

    if (!dispatchResult.ok) {
      sendToClient("request_pickup_world_loot_rejected", dispatchResult.rejected);
      return;
    }

    state.worldLoot.delete(validation.worldLoot.id);
    if (dispatchResult.currencyMessage !== null) {
      sendToClient("currency_picked_up", dispatchResult.currencyMessage);
    }
    const accepted: RequestPickupWorldLootAcceptedServerMessage = dispatchResult.accepted;
    sendToClient("request_pickup_world_loot_accepted", accepted);
    return;
  }

  if (actionType === "skill_secondary") {
    const enemy = state.enemies.get(targetId);
    if (enemy === undefined) {
      clearPendingAction(player);
      const rejection: RequestUseSkillSlotRejectedServerMessage = {
        type: "request_use_skill_slot_rejected",
        slot: "secondary",
        reason: "enemy_not_found",
      };
      sendToClient(rejection.type, rejection);
      return;
    }
    if (player.lifeState !== "alive" || player.hp <= 0) {
      clearPendingAction(player);
      const rejection: RequestUseSkillSlotRejectedServerMessage = {
        type: "request_use_skill_slot_rejected",
        slot: "secondary",
        reason: "player_downed",
      };
      sendToClient(rejection.type, rejection);
      return;
    }
    const nextSkillSlotAt = Number.isFinite(player.nextSkillSlotAt) ? player.nextSkillSlotAt : 0;
    if (now < nextSkillSlotAt) {
      return;
    }
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distance > GRAVE_SPARK_RANGE) {
      return;
    }

    player.nextSkillSlotAt = now + GRAVE_SPARK_COOLDOWN_MS;
    const damageResult = applyEnemyDamage(enemy, GRAVE_SPARK_DAMAGE);
    if (damageResult.defeated) {
      spawnWorldLootOnEnemyDefeat(state, enemy, now);
      await grantEnemyDefeatXp(player, enemy.enemyId, sendToClient);
    }

    const accepted: RequestUseSkillSlotAcceptedServerMessage = {
      type: "request_use_skill_slot_accepted",
      slot: "secondary",
      targetEnemyId: enemy.id,
      damage: GRAVE_SPARK_DAMAGE,
      remainingHp: damageResult.remainingHp,
      defeated: damageResult.defeated,
      nextReadyAt: player.nextSkillSlotAt,
    };
    sendToClient(accepted.type, accepted);
    clearPendingAction(player);
    return;
  }

  clearPendingAction(player);
}