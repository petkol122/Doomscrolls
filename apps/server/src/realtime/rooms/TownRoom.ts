import { Room, Client } from "colyseus";
import type {
  CharacterId,
  DamageAppliedServerMessage,
  EnemyAttackResolvedServerMessage,
  EntityId,
  RequestAttackAcceptedServerMessage,
  RequestAttackRejectedServerMessage,
  DeferredActionQueuedServerMessage,
  PlayerRespawnedServerMessage,
  RequestPickupWorldLootAcceptedServerMessage,
  RequestPickupWorldLootClientMessage,
  RequestPickupWorldLootRejectedServerMessage,
  RequestMoveRejectedServerMessage,
  RequestAttackClientMessage,
  RequestUseSkillSlotAcceptedServerMessage,
  RequestUseSkillSlotClientMessage,
  RequestUseSkillSlotRejectedServerMessage,
  UserId,
  ZoneId,
  RequestInteractClientMessage,
  InteractResponseServerMessage,
  EnemyAttackTelegraphServerMessage,
  RequestDodgeAcceptedServerMessage,
  RequestDodgeRejectedServerMessage,
  ObjectiveUpdatedServerMessage,
  RequestResetObjectiveClientMessage,
  XpGainedServerMessage,
} from "@doomscrolls/shared";
import { t } from "@doomscrolls/localization";
import { RoomJoinValidationService } from "../RoomJoinValidationService";
import { CharacterService } from "../../character/CharacterService";
import type { TownRoomJoinOptions } from "./townRoomTypes";
import { TownRoomState } from "./TownRoomState";
import { buildTownPlayerPresence } from "./buildPlayerPresence";
import { createRoomLogger } from "./roomLogger";
import { validateMovementIntent } from "./movementIntentValidation";
import { applyMovementIntent } from "./applyMovementIntent";
import { resolveZoneBounds } from "./resolveZoneBounds";
import { resolvePlayerMovementSpeed } from "./resolvePlayerMovementSpeed";
import {
  stepTownRoomMovement,
  TOWN_MOVEMENT_TICK_RATE_MS,
} from "./stepTownRoomMovement";
import { initializeTownInteractables } from "./initializeTownInteractables";
import { initializeTownEnemies } from "./initializeTownEnemies";
import { validateInteractIntent, getInteractableResponseMessage, handleLootContainerInteraction } from "./interactValidation";
import { validateAttackIntent } from "./attackIntentValidation";
import { consumeAttackCooldown, resolveAttackCooldownMs } from "./attackCooldown";
import { applyEnemyDamage } from "./applyEnemyDamage";
import { validateDodgeIntent } from "./dodgeIntentValidation";
import { applyDodgeIntent } from "./applyDodgeIntent";
import { consumeDodgeCooldown, isDodgeReady } from "./dodgeCooldown";
import { validateHealingFlaskIntent } from "./healingFlaskValidation";
import { applyHealingFlaskIntent } from "./applyHealingFlaskIntent";
import { restoreFlaskToFull } from "./healingFlaskConfig";
import { applyTownRestRefill } from "./townRestRefill";
import { applyTownRestAreaRefillForAll } from "./townRestAreaTrigger";
import type {
  RequestUseHealingFlaskAcceptedServerMessage,
  RequestUseHealingFlaskRejectedServerMessage,
} from "@doomscrolls/shared";
import { advanceObjectiveProgress } from "./advanceObjectiveProgress";
import { respawnTownEnemies } from "./respawnTownEnemies";
import { spawnWorldLootOnEnemyDefeat } from "./spawnWorldLootOnEnemyDefeat";
import { applyWanderMovement } from "./wanderEnemies";
import { dispatchPickedUpWorldLoot } from "./pickupWorldLootDispatcher";
import { validatePickupWorldLootIntent } from "./pickupWorldLootValidation";
import { clearPendingAction, setPendingAction } from "./pendingActionState";
import { resolvePlayerInitialPosition } from "./validateCharacterLocation";
import { contentRegistry, NOTICE_BOARD_OBJECTIVE_SEQUENCE } from "@doomscrolls/content";
import type { SpawnPointContentId, ObjectiveId } from "@doomscrolls/content";
import { NIGHTMARKET_DEFAULT_SPAWN_POINT_ID } from "./resolveTownSpawnPoint";
import { resolveTownZoneId } from "./resolveTownZoneId";
import { CharacterRepository, ObjectiveRepository } from "../../persistence/repositories";
import { ItemRepository } from "../../persistence/repositories/ItemRepository";
import { toItemInstanceDto } from "../../persistence/mappers/itemMapper";
import { tryResolveLevelProgression } from "./levelProgression";
import { CharacterStatsService } from "../../character/CharacterStatsService";
import { executeVendorBuyItem } from "./vendorBuyItem";
import { executeVendorSellItem } from "./vendorSellItem";
import { executeStoreInventoryItemInStash, executeTakeStashItemToInventory } from "./stashTransferItem";
// Task 206 -- server-owned approach stop point for deferred queues
// (attack / pickup / interact). The server still applies the
// resolved target through applyMovementIntent; the client never
// decides the stop point.
import { resolveApproachTarget } from "./resolveApproachTarget";
import {
  activateAndBuildWaypointPanel,
  getRouteRejectedMessage,
  getWaypointRejectedMessage,
  resolveRouteTravel,
  resolveWaypointTravel,
} from "./waypointService";

// Task 227 -- enemy movement speed is authored in the same
// per-second stat space as the player's derived `moveSpeed` (see
// resolvePlayerMovementSpeed). The runtime world-units-per-second
// value must be scaled by this constant the same way the player
// speed is, otherwise the enemy moves at <1 wu/sec and can never
// catch a player running at 200+ wu/sec.
const ENEMY_MOVEMENT_SPEED_UNITS_PER_SECOND_MULTIPLIER = 220;

const ENEMY_ATTACK_RANGE = 44;
// Task 207 -- server-owned engagement / pickup / interact ranges used
// by resolveApproachTarget when queuing deferred move-closer actions.
// BASIC_ATTACK_RANGE is the engagement radius from
// attackIntentValidation; the approach stop sits inside that radius
// (with a snap-to-stop buffer) so the player never overshoots into
// the enemy center.
const BASIC_ATTACK_RANGE = 64;
const GRAVE_SPARK_RANGE = 96;
// PICKUP_APPROACH_DISTANCE is a close-in radius well under the
// WORLD_LOOT_PICKUP_RANGE (48) validator boundary, with a snap-to-stop
// buffer so the queued pickup reliably executes once the player
// arrives. Player stops just outside the loot pickable instead of
// standing on top of it.
const PICKUP_APPROACH_DISTANCE = 24;
// INTERACT_APPROACH_DISTANCE sits inside the interact validator's
// INTERACT_DISTANCE (50) with a snap-to-stop buffer so the queued
// interact reliably executes once the player arrives (notice board,
// vendor, stash keeper, etc.).
const INTERACT_APPROACH_DISTANCE = 38;
const GRAVE_SPARK_COOLDOWN_MS = 1500;
const GRAVE_SPARK_DAMAGE = 3;
// Task 094 -- server-owned enemy attack windup. The server sends
// `enemy_attack_telegraph` to the target client when the windup starts;
// damage is applied after this many ms only if the target is still alive
// and in attack range.
// Task 306: reduced from 350 ms to 300 ms for snappier enemy
// telegraph → damage cadence
const ENEMY_ATTACK_WINDUP_MS = 300;
const ENEMY_RETURN_ARRIVAL_DISTANCE = 1;
const ENEMY_RETURN_REACQUIRE_BUFFER = 8;
const characterStatsService = new CharacterStatsService();
const progressionLog = createRoomLogger(undefined);
type ContentEnemyId = Parameters<typeof contentRegistry.enemies.get>[0];

/**
 * Find the next available objective in the Notice Board sequence.
 * Returns the content definition for the first objective whose reward has
 * not yet been granted, or `undefined` if the player has completed the
 * entire sequence.
 */
function _findNextNoticeBoardObjective(player: {
  objectiveRewardGranted: boolean;
  objectiveCompleted: boolean;
  objectiveId: string;
}): { readonly objective: import("@doomscrolls/content").ObjectiveContentDefinition; readonly index: number } | undefined {
  const currentSeqIndex = NOTICE_BOARD_OBJECTIVE_SEQUENCE.indexOf(player.objectiveId);
  for (const candidateId of NOTICE_BOARD_OBJECTIVE_SEQUENCE) {
    const candidate = contentRegistry.objectives.get(candidateId as ObjectiveId);
    if (candidate === undefined) {
      continue;
    }
    const candidateIndex = NOTICE_BOARD_OBJECTIVE_SEQUENCE.indexOf(candidateId);
    // Skip objectives that come before the current one in the sequence,
    // since they must have been completed to have advanced past them.
    // This correctly handles the case where the player's current objectiveId
    // is the last one and rewardGranted is true — earlier candidates are
    // skipped so the function returns undefined (chain complete).
    if (currentSeqIndex >= 0 && candidateIndex < currentSeqIndex) {
      continue;
    }
    // If the player's current objective is this one and reward is not yet
    // granted, it's the one they're working on — keep it.
    if (player.objectiveId === candidateId && !player.objectiveRewardGranted) {
      return { objective: candidate, index: candidateIndex };
    }
    // If the player's current objective is this one and reward IS granted,
    // skip it (completed). Look for the next one.
    if (player.objectiveId === candidateId && player.objectiveRewardGranted) {
      continue;
    }
    // First uncompleted candidate in sequence: offer it.
    return { objective: candidate, index: candidateIndex };
  }
  return undefined;
}

function parseCompletedObjectiveIds(player: {
  completedObjectiveIds?: string;
}): readonly string[] {
  if (typeof player.completedObjectiveIds !== "string" || player.completedObjectiveIds.length === 0) {
    return [];
  }
  return player.completedObjectiveIds.split(",").filter((value) => value.length > 0);
}

function isObjectiveRepeatable(
  objective: import("@doomscrolls/content").ObjectiveContentDefinition,
): boolean {
  return objective.repeatable === true;
}

function isObjectiveStartBlockedByCompletion(
  player: { completedObjectiveIds?: string },
  objective: import("@doomscrolls/content").ObjectiveContentDefinition,
): boolean {
  if (isObjectiveRepeatable(objective)) {
    return false;
  }
  return parseCompletedObjectiveIds(player).includes(objective.id);
}

function buildAvailableNoticeBoardObjectives(player: {
  completedObjectiveIds?: string;
}): readonly {
  readonly objectiveId: string;
  readonly titleKey: string;
  readonly descriptionKey: string;
}[] {
  const availableEntries: { objectiveId: string; titleKey: string; descriptionKey: string }[] = [];
  for (const candidateId of NOTICE_BOARD_OBJECTIVE_SEQUENCE) {
    const candidate = contentRegistry.objectives.get(candidateId as ObjectiveId);
    if (candidate === undefined) {
      continue;
    }
    if (isObjectiveStartBlockedByCompletion(player, candidate)) {
      continue;
    }
    availableEntries.push({
      objectiveId: candidate.id,
      titleKey: candidate.titleKey,
      descriptionKey: candidate.descriptionKey,
    });
  }
  return availableEntries;
}

function buildObjectiveUpdatedMessage(
  player: {
    objectiveId: string;
    objectiveLabel: string;
    objectiveDescriptionKey?: string;
    objectiveCurrent: number;
    objectiveTarget: number;
    objectiveCompleted: boolean;
  },
  objectiveId: string,
  reward?: { readonly xpReward: number; readonly copperReward: number },
): ObjectiveUpdatedServerMessage {
  return {
    type: "objective_updated",
    objectiveId,
    label: player.objectiveLabel,
    ...(player.objectiveDescriptionKey !== undefined && player.objectiveDescriptionKey.length > 0
      ? { descriptionKey: player.objectiveDescriptionKey }
      : {}),
    current: player.objectiveCurrent,
    target: player.objectiveTarget,
    completed: player.objectiveCompleted,
    ...(player.objectiveCompleted ? { readyToTurnIn: true } : {}),
    ...(reward !== undefined ? { xpReward: reward.xpReward, copperReward: reward.copperReward } : {}),
  };
}

function startNoticeBoardObjective(
  player: {
    hasObjective: boolean;
    objectiveId: string;
    objectiveLabel: string;
    objectiveDescriptionKey: string;
    objectiveCurrent: number;
    objectiveTarget: number;
    objectiveCompleted: boolean;
    objectiveRewardGranted: boolean;
  },
  objectiveDef: import("@doomscrolls/content").ObjectiveContentDefinition,
): ObjectiveUpdatedServerMessage {
  player.hasObjective = true;
  player.objectiveId = objectiveDef.id;
  player.objectiveLabel = t(objectiveDef.titleKey);
  player.objectiveDescriptionKey = objectiveDef.descriptionKey;
  player.objectiveCurrent = 0;
  player.objectiveTarget = objectiveDef.requiredKills;
  player.objectiveCompleted = false;
  player.objectiveRewardGranted = false;
  return buildObjectiveUpdatedMessage(player, objectiveDef.id);
}

function resetNoticeBoardObjective(player: {
  hasObjective: boolean;
  objectiveId: string;
  objectiveLabel: string;
  objectiveCurrent: number;
  objectiveTarget: number;
  objectiveCompleted: boolean;
  objectiveRewardGranted: boolean;
}): void {
  player.hasObjective = false;
  player.objectiveId = "";
  player.objectiveLabel = "";
  player.objectiveCurrent = 0;
  player.objectiveTarget = 0;
  player.objectiveCompleted = false;
  player.objectiveRewardGranted = false;
}

function getActiveObjectiveContent(
  player: { objectiveId: string },
): import("@doomscrolls/content").ObjectiveContentDefinition | undefined {
  if (player.objectiveId.length === 0) {
    return undefined;
  }
  return contentRegistry.objectives.get(player.objectiveId as ObjectiveId);
}

async function grantFlatXpReward(
  player: { characterId: CharacterId; xp: number; level: number; maxHp?: number; hp?: number },
  xpReward: number,
  sendToClient: (type: string, payload: unknown) => void,
): Promise<void> {
  if (!Number.isFinite(xpReward) || xpReward <= 0) {
    return;
  }

  if (!Number.isFinite(player.xp) || player.xp < 0 || !Number.isFinite(player.level) || player.level < 1) {
    return;
  }

  const nextXp = player.xp + xpReward;
  const progressionResult = tryResolveLevelProgression(player.level, nextXp);
  if (!progressionResult.ok) {
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
    gainedMaxHp: progressionUpdate.gainedMaxHp,
  };
  sendToClient("xp_gained", xpGained);
}

type ProgressionUpdateResult =
  | { readonly ok: true; readonly maxHp: number; readonly hp: number; readonly gainedMaxHp: number }
  | { readonly ok: false };

async function applyProgressionUpdate(
  player: { characterId: CharacterId; xp: number; level: number; maxHp?: number; hp?: number },
  progression: { readonly xp: number; readonly level: number; readonly leveledUp: boolean },
): Promise<ProgressionUpdateResult> {
  const characterRepository = new CharacterRepository();
  const character = await characterRepository.findProgressionContext(player.characterId);
  if (character === null) {
    progressionLog.warn?.(
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

  const previousMaxHp = Number.isFinite(player.maxHp) ? Math.max(0, player.maxHp ?? 0) : 0;
  const previousHp = Number.isFinite(player.hp) ? Math.max(0, player.hp ?? 0) : character.currentHp;
  const recalculated = characterStatsService.calculateEquippedStats(
    characterStatsService.calculateLevelScaledStats(origin.baseStats, characterClass.baseStats, progression.level).primary,
    modifiers,
    progression.level,
  );
  const nextMaxHp = Math.max(1, Math.floor(recalculated.derived.maxHp));
  const gainedMaxHp = Math.max(0, nextMaxHp - previousMaxHp);
  const nextHp = Math.min(nextMaxHp, previousHp + gainedMaxHp);

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
    progressionLog.warn?.(
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
  if ("maxHp" in player) {
    player.maxHp = nextMaxHp;
  }
  if ("hp" in player) {
    player.hp = nextHp;
  }

  return { ok: true, maxHp: nextMaxHp, hp: nextHp, gainedMaxHp };
}

async function grantEnemyDefeatXp(
  player: { characterId: CharacterId; xp: number; level: number },
  enemyId: string,
  sendToClient: (type: string, payload: unknown) => void,
): Promise<void> {
  const enemyDefinition = contentRegistry.enemies.get(enemyId as ContentEnemyId);
  if (enemyDefinition === undefined || !Number.isFinite(enemyDefinition.xp) || enemyDefinition.xp <= 0) {
    progressionLog.warn?.(
      { event: "enemy_defeat_xp_skipped", reason: "missing_enemy_xp", enemyId, characterId: player.characterId },
      "Skipping enemy defeat XP because enemy XP is missing or invalid.",
    );
    return;
  }

  const xpReward = enemyDefinition.xp;
  await grantFlatXpReward(player, xpReward, sendToClient);
}

/**
 * Task 094 -- Send the `enemy_attack_telegraph` warning to the
 * target client. The client only uses this for transient visual
 * warning markers; damage outcome is decided by the server.
 *
 * Task 264 -- accepts an optional `attackKind` so the client can
 * render a distinct heavy-attack telegraph (e.g. Brute charged
 * strike) versus a normal one. The server still decides the
 * outcome; this field is purely visual.
 */
function sendEnemyAttackTelegraph(
  targetClient: Client,
  enemyId: string,
  targetCharacterId: string,
  windupMs: number,
  attackKind: "normal" | "heavy" = "normal",
): void {
  const telegraph: EnemyAttackTelegraphServerMessage = {
    type: "enemy_attack_telegraph",
    enemyId,
    targetEntityId: targetCharacterId as unknown as EntityId,
    windupMs,
    attackKind,
  };
  try {
    targetClient.send("enemy_attack_telegraph", telegraph);
  } catch {
    // keep room state authoritative even if send fails
  }
}

function sendEnemyAttackResolved(
  targetClient: Client,
  message: EnemyAttackResolvedServerMessage,
): void {
  try {
    targetClient.send("enemy_attack_resolved", message);
  } catch {
    // keep room state authoritative even if send fails
  }
}

function moveEnemyTowardTarget(
  enemy: { x: number; y: number },
  target: { x: number; y: number },
  moveSpeedUnitsPerSecond: number,
  deltaMs: number,
): void {
  if (
    !Number.isFinite(moveSpeedUnitsPerSecond) ||
    moveSpeedUnitsPerSecond <= 0 ||
    !Number.isFinite(deltaMs) ||
    deltaMs <= 0
  ) {
    return;
  }

  const deltaX = target.x - enemy.x;
  const deltaY = target.y - enemy.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance <= ENEMY_ATTACK_RANGE) {
    return;
  }

  const maxDistance = moveSpeedUnitsPerSecond * (deltaMs / 1000);
  const distanceToTravel = Math.min(maxDistance, distance - ENEMY_ATTACK_RANGE);
  if (distanceToTravel <= 0) {
    return;
  }

  const scale = distanceToTravel / distance;
  enemy.x += deltaX * scale;
  enemy.y += deltaY * scale;
}

function toWorldUnits(contentUnits: number, fallback: number): number {
  if (!Number.isFinite(contentUnits) || contentUnits <= 0) {
    return fallback;
  }

  return contentUnits * 24;
}

function clearEnemyTargetAndReturn(enemy: {
  state: "idle" | "chasing" | "returning" | "defeated";
  targetPlayerSessionId: string;
  nextAttackAtMs: number;
  attackLandingAtMs: number;
}): void {
  enemy.targetPlayerSessionId = "";
  enemy.state = "returning";
  enemy.nextAttackAtMs = 0;
  enemy.attackLandingAtMs = 0;
}

function resetEnemyCombatState(enemy: {
  state: "idle" | "chasing" | "returning" | "defeated";
  targetPlayerSessionId: string;
  nextAttackAtMs: number;
  attackLandingAtMs: number;
}): void {
  enemy.targetPlayerSessionId = "";
  enemy.state = "idle";
  enemy.nextAttackAtMs = 0;
  enemy.attackLandingAtMs = 0;
}

function moveEnemyTowardPoint(
  enemy: { x: number; y: number },
  target: { x: number; y: number },
  moveSpeedUnitsPerSecond: number,
  deltaMs: number,
): void {
  if (
    !Number.isFinite(moveSpeedUnitsPerSecond) ||
    moveSpeedUnitsPerSecond <= 0 ||
    !Number.isFinite(deltaMs) ||
    deltaMs <= 0
  ) {
    return;
  }

  const deltaX = target.x - enemy.x;
  const deltaY = target.y - enemy.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance <= ENEMY_RETURN_ARRIVAL_DISTANCE) {
    enemy.x = target.x;
    enemy.y = target.y;
    return;
  }

  const maxDistance = moveSpeedUnitsPerSecond * (deltaMs / 1000);
  const distanceToTravel = Math.min(maxDistance, distance);
  if (distanceToTravel <= 0) {
    return;
  }

  const scale = distanceToTravel / distance;
  enemy.x += deltaX * scale;
  enemy.y += deltaY * scale;
}

/**
 * TownRoom with minimal Colyseus schema state.
 *
 * Task 021.1 / 022.1 / 023.2 / 025 / 026 / 029 scope:
 *  - Creates and sets a TownRoomState schema containing:
 *      roomKind = "town"
 *      zoneId
 *      playerPresence (MapSchema<PlayerPresence>)
 *      connectedPlayerCount
 *  - On valid join, validates the session, validates character
 *    ownership, resolves the spawn point, builds a PlayerPresence
 *    entry with the initial world position copied from the spawn
 *    point, and inserts it into the presence map.
 *  - On leave, removes the presence entry.
 *  - Task 026: registers a `request_move` message handler that
 *    validates the intent shape + range and (on rejection) sends a
 *    safe `request_move_rejected` message back to the originating
 *    client.
 *  - Task 042: on accepted request_move, stores a server-owned movement
 *    target for that player. A room simulation tick advances x/y toward
 *    the target over time at a constant speed. No client authority,
 *    no interpolation, no pathfinding, no collision, no combat,
 *    no persistence.
 *
 * Player presence building is delegated to
 * {@link buildTownPlayerPresence} so this room stays a thin Colyseus
 * shell. Movement intent validation is delegated to
 * {@link validateMovementIntent} for the same reason. See
 * `docs/CODING_RULES.md` "Realtime Room File-Size Guard".
 *
 * Explicitly out of scope:
 *  - pathfinding
 *  - collision
 *  - map rendering
 *  - combat
 *  - player sprite / entity placement
 *  - gameplay loop
 *  - persistence
 *  - chat
 */
export class TownRoom extends Room {
  public static readonly ROOM_NAME = "town";

/**
 * Per-room flag: the `request_move` handler is registered once on
 * `onCreate` rather than per-client. Colyseus delivers untrusted,
 * schema-typed messages of the registered `type` to the handler
 * with the originating client and raw payload.
 *
 * Task 042 extends the handler to store the validated movement target,
 * while the room simulation tick advances the player's authoritative
 * position through Colyseus schema synchronization.
 */
  private movementIntentHandlerRegistered = false;
  private interactHandlerRegistered = false;
  private attackHandlerRegistered = false;
  private resetObjectiveHandlerRegistered = false;
  private startBoardObjectiveHandlerRegistered = false;
  private pickupWorldLootHandlerRegistered = false;
  private respawnHandlerRegistered = false;
  private corpseInteractHandlerRegistered = false;
  private dodgeHandlerRegistered = false;
  private healingFlaskHandlerRegistered = false;
  private skillSlotHandlerRegistered = false;
  private vendorBuyHandlerRegistered = false;
  private vendorSellHandlerRegistered = false;
  private stashTransferHandlerRegistered = false;

  public override async onCreate(options: TownRoomJoinOptions): Promise<void> {
    const log = createRoomLogger(
      (this as unknown as { logger?: unknown }).logger,
    );

    const zoneId = resolveTownZoneId(options.requestedZoneId);

    this.setState(new TownRoomState(zoneId));

    // Task 057 — Initialize interactable objects
    initializeTownInteractables(this.state as TownRoomState, zoneId);

    // Task 058 — Initialize synced static enemy placeholders.
    initializeTownEnemies(this.state as TownRoomState, zoneId);

    this.registerMovementIntentHandler(log);
    this.registerInteractHandler(log);
    this.registerResetObjectiveHandler(log);
    this.registerAttackHandler(log);
    this.registerPickupWorldLootHandler(log);
    this.registerRespawnHandler(log);
    this.registerCorpseInteractHandler(log);
    this.registerDodgeHandler(log);
    this.registerHealingFlaskHandler(log);
    this.registerSkillSlotHandler(log);
    this.registerVendorBuyHandler(log);
    this.registerVendorSellHandler(log);
    this.registerStashTransferHandler(log);
    this.registerStartBoardObjectiveHandler(log);
    this.setSimulationInterval((deltaMs: number) => {
      const state = this.state as TownRoomState;
      stepTownRoomMovement(state, deltaMs, {
        now: Date.now(),
        onPendingActionReady: (sessionId, payload) => {
          const targetClient = this.clients.find((client) => client.sessionId === sessionId);
          if (targetClient === undefined) {
            return;
          }
          try {
            targetClient.send(payload.type, payload.message);
          } catch {
            // swallow client send failures; room state remains authoritative
          }
        },
      });
      this.applyEnemyAggroDamage(Date.now(), deltaMs);
      respawnTownEnemies(state, zoneId, Date.now());

      // Task 303 — Physical town rest area refill trigger. Runs on
      // each tick and sends the localized notification only when
      // the player's values actually changed (avoiding spam while
      // standing in the area already full).
      const restAreaResults = applyTownRestAreaRefillForAll(
        zoneId,
        state.playerPresence,
      );
      if (restAreaResults.size > 0) {
        restAreaResults.forEach((_changed, sessionId) => {
          const targetClient = this.clients.find((client) => client.sessionId === sessionId);
          if (targetClient === undefined) {
            return;
          }
          try {
            targetClient.send("town_rest_refill", {
              type: "town_rest_refill",
              restoredHp: state.playerPresence.get(sessionId)?.hp ?? 0,
              restoredFlaskCharges: Math.floor(state.playerPresence.get(sessionId)?.flaskCharges ?? 0),
            });
          } catch {
            // swallow client send failures; room state remains authoritative
          }
        });
      }
    }, TOWN_MOVEMENT_TICK_RATE_MS);

    log.info(
      { roomId: this.roomId, roomName: this.roomName, zoneId, roomKind: "town" },
      "TownRoom created with minimal state schema.",
    );
  }

  public override async onJoin(
    _client: Client,
    options?: TownRoomJoinOptions,
  ): Promise<void> {
    const safeLog = createRoomLogger(
      (this as unknown as { logger?: unknown }).logger,
    );

    if (!options) {
      safeLog.warn?.(
        { roomId: this.roomId, roomName: this.roomName },
        "TownRoom join rejected: missing join options.",
      );
      throw new Error("missing_join_options");
    }

    // Resolve the join auth into a discriminated shape. Either:
    //   - a raw session token (and we resolve userId via AuthService), or
    //   - an already-resolved userId supplied by the caller.
    // characterId is required in both cases. Anything else is rejected.
    const auth = this.normalizeJoinOptions(options);
    if (auth === null) {
      safeLog.warn?.(
        { roomId: this.roomId, roomName: this.roomName },
        "TownRoom join rejected: invalid join options shape.",
      );
      throw new Error("invalid_join_options");
    }

    const validationService = new RoomJoinValidationService();

    let resolvedUserId: UserId;
    if (auth.sessionToken !== undefined) {
      try {
        const { AuthService } = await import("../../auth");
        const authService = new AuthService();
        const accountState = await authService.getAccountStateFromToken(auth.sessionToken);
        resolvedUserId = accountState.user.id;
      } catch {
        safeLog.warn?.(
          { roomId: this.roomId, roomName: this.roomName },
          "TownRoom join rejected: session validation failed.",
        );
        throw new Error("not_authenticated");
      }
    } else {
      // auth.sessionToken !== undefined and userId is required when no
      // session token is supplied. The guard in normalizeJoinOptions
      // guarantees this branch only runs with a real userId.
      resolvedUserId = auth.userId as UserId;
    }

    // Step 2: validate kind/zone/character ownership through the
    // shared validation service.
    const validateInput: {
      userId: UserId;
      characterId: CharacterId;
      requestedRoomKind: "town";
      requestedZoneId?: ZoneId;
    } = {
      userId: resolvedUserId,
      characterId: auth.characterId,
      requestedRoomKind: "town",
    };
    if (auth.requestedZoneId !== undefined) {
      validateInput.requestedZoneId = auth.requestedZoneId;
    }
    const result = await validationService.validateJoin(validateInput);

    if (!result.success) {
      safeLog.warn?.(
        {
          roomId: this.roomId,
          roomName: this.roomName,
          reason: result.reason,
        },
        "TownRoom join rejected by validation service.",
      );
      throw new Error(`room_join_rejected:${result.reason}`);
    }

    const state = this.state as TownRoomState;
    const sessionId = _client.sessionId;
    const characterId = result.character.id;
    const characterName = result.character.characterName;
    const resolvedZoneId = result.resolvedZoneId;
    const movementSpeed = resolvePlayerMovementSpeed(result.character);
    const attackCooldownMs = resolveAttackCooldownMs(
      result.character.stats?.derived.attackCooldownMs,
    );
    const maxHp = Math.max(0, result.character.stats?.derived.maxHp ?? 0);
    const currentHp = Math.min(maxHp, Math.max(0, result.character.stats?.currentHp ?? maxHp));
    const persistedFlaskState = await new CharacterRepository().findCurrentFlaskChargesForUser(
      characterId,
      resolvedUserId,
    );

    // Task 333D — Load persisted objective state for this character
    // so progress, completion and reward-granted status survive
    // reconnects. Only the first objective in the notice board
    // sequence that is not yet reward-granted is relevant; this is
    // a single-objective foundation, not a full quest journal.
    const objectiveRepo = new ObjectiveRepository();
    let persistedObjective: {
      objectiveId: string;
      currentProgress: number;
      requiredProgress: number;
      completed: boolean;
      rewardGranted: boolean;
    } | undefined;
    const completedObjectives = await objectiveRepo.findCompletedByCharacter(characterId.toString());
    for (const candidateId of NOTICE_BOARD_OBJECTIVE_SEQUENCE) {
      const objectiveRow = await objectiveRepo.findByCharacterAndObjective(characterId.toString(), candidateId);
      if (objectiveRow !== null && !objectiveRow.rewardGranted) {
        persistedObjective = {
          objectiveId: objectiveRow.objectiveId,
          currentProgress: objectiveRow.currentProgress,
          requiredProgress: objectiveRow.requiredProgress,
          completed: objectiveRow.completed,
          rewardGranted: objectiveRow.rewardGranted,
        };
        break;
      }
      // If reward is granted but the character has this objective,
      // keep scanning for the next uncompleted one.
      if (objectiveRow !== null && objectiveRow.rewardGranted) {
        continue;
      }
      break; // No state at all means the character hasn't started this one.
    }

    // Delegate presence building (spawn point resolution + initial
    // world position copy) to a dedicated helper so this room file
    // stays a thin Colyseus shell.
    const presence = buildTownPlayerPresence({
      sessionId,
      characterId,
      displayName: characterName,
      level: result.character.level,
      xp: result.character.xp,
      resolvedZoneId,
      hp: currentHp,
      maxHp,
      restoredFlaskCharges: persistedFlaskState?.currentFlaskCharges,
      movementSpeed,
      attackCooldownMs,
      restoredLocationZoneId: result.character.lastLocationZoneId ?? undefined,
      restoredLocationX: result.character.lastLocationX ?? undefined,
      restoredLocationY: result.character.lastLocationY ?? undefined,
      objectiveState: persistedObjective,
      completedObjectives,
    });

    // Task 299 — Town Rest Refill: restore HP and flask charges to
    // full on entering a valid town zone. This must happen after the
    // presence is created (which may load persisted partial values)
    // and before the message is sent so the Colyseus schema state
    // already reflects the restored values when the client receives
    // the feedback message.
    const refillResult = applyTownRestRefill(presence);

    state.playerPresence.set(sessionId, presence);
    state.connectedPlayerCount = state.playerPresence.size;

    // Send a town rest refill feedback message to the joining client.
    // The synced schema state is the source of truth for display; this
    // message provides a localized notification only.
    if (refillResult.changed) {
      try {
        _client.send("town_rest_refill", {
          type: "town_rest_refill",
          restoredHp: refillResult.restoredHp,
          restoredFlaskCharges: refillResult.restoredFlaskCharges,
        });
      } catch {
        // swallow send failures; room state remains authoritative
      }
    }

    safeLog.info?.(
      {
        roomId: this.roomId,
        roomName: this.roomName,
        sessionId,
        userId: result.character.ownerUserId,
        characterId,
        zoneId: resolvedZoneId,
        spawnPointId: presence.spawnPointId,
        movementSpeed: presence.movementSpeed,
        attackCooldownMs: presence.attackCooldownMs,
        x: presence.x,
        y: presence.y,
        connectedPlayerCount: state.connectedPlayerCount,
      },
      "TownRoom join accepted, player presence added with resolved spawn point and initial world position.",
    );

    try {
      await new CharacterService().updateCharacterCurrentZone(characterId, resolvedZoneId);
    } catch {
      // Keep join successful; reconnect recovery may repair zone intent later.
    }
  }

  public override async onLeave(_client: Client): Promise<void> {
    const safeLog = createRoomLogger(
      (this as unknown as { logger?: unknown }).logger,
    );
    const state = this.state as TownRoomState;
    const presence = state.playerPresence.get(_client.sessionId);

    if (presence !== undefined) {
      const characterService = new CharacterService();
      try {
        // Leave/disconnect must persist the latest room-owned HP/location so a
        // later join can restore valid runtime state instead of stale `/me` data.
        await characterService.updateCharacterLocation(
          presence.characterId,
          state.zoneId,
          presence.x,
          presence.y,
          Math.max(0, Math.min(presence.maxHp, presence.hp)),
          Math.max(0, Math.min(presence.maxFlaskCharges, Math.floor(presence.flaskCharges))),
        );
      } catch (error: unknown) {
        safeLog.error?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: _client.sessionId,
            characterId: presence.characterId,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to persist character location on leave.",
        );
      }
    }

    state.playerPresence.delete(_client.sessionId);
    state.connectedPlayerCount = state.playerPresence.size;

    // Clear any enemy that was targeting this player so a stale
    // target is not re-acquired after the player leaves.
    state.enemies.forEach((enemy) => {
      if (enemy.targetPlayerSessionId === _client.sessionId) {
        clearEnemyTargetAndReturn(enemy);
      }
    });
  }

  /**
   * Register the `request_move` message handler on the room.
   *
   * Scope (Task 026 foundation + Task 042 server-authoritative click movement):
   *   - validates the intent shape and range
   *   - on rejection, sends a `request_move_rejected` message back
   *     to the originating client with a safe reason code
   *   - on acceptance, stores the player's authoritative movement
   *     target via {@link applyMovementIntent}
   *   - actual position changes happen later on the room simulation tick
   *
   * The handler is registered once per room. Colyseus forwards every
   * untrusted, schema-typed message of the registered `type` to this
   * callback together with the originating client. The handler is
   * intentionally tolerant and never throws into Colyseus.
   */
  private registerMovementIntentHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.movementIntentHandlerRegistered) {
      return;
    }
    this.movementIntentHandlerRegistered = true;

    this.onMessage("request_move", (client: Client, raw: unknown) => {
      const state = this.state as TownRoomState;
      const player = state.playerPresence.get(client.sessionId);
      if (player !== undefined && player.lifeState !== "alive") {
        clearPendingAction(player);
        player.hasMovementTarget = false;
        const rejection: RequestMoveRejectedServerMessage = {
          type: "request_move_rejected",
          reason: "player_downed",
        };
        try {
          client.send("request_move_rejected", rejection);
        } catch {}
        return;
      }
      const zoneBounds = resolveZoneBounds(state.zoneId);
      const result = validateMovementIntent({ message: raw, bounds: zoneBounds });

      if (!result.ok) {
        const candidate = raw as { clientTime?: unknown } | null;
        const echoClientTime =
          result.reason === "invalid_shape" &&
          candidate !== null &&
          typeof candidate.clientTime === "number"
            ? candidate.clientTime
            : undefined;

        const rejection: RequestMoveRejectedServerMessage = {
          type: "request_move_rejected",
          reason: result.reason,
          ...(echoClientTime !== undefined ? { clientTime: echoClientTime } : {}),
        };

        try {
          client.send("request_move_rejected", rejection);
        } catch {
          // Swallow send errors; the room must never crash on a
          // rejected intent. The client connection state will be
          // handled by Colyseus itself.
        }
        log.warn?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            reason: result.reason,
          },
          "TownRoom request_move rejected: invalid intent shape/range.",
        );
        return;
      }

      // Store the validated movement target. The room simulation tick
      // advances position later; Colyseus schema synchronization handles
      // the broadcast automatically.
      const applied = applyMovementIntent(
        state,
        client.sessionId,
        result.targetX,
        result.targetY,
      );

      if (applied !== null) {
        log.debug?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            targetX: result.targetX,
            targetY: result.targetY,
            storedTargetX: applied.x,
            storedTargetY: applied.y,
            clientTime: result.clientTime,
          },
          "TownRoom request_move accepted and stored as server-authoritative movement target.",
        );
      } else {
        log.warn?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            targetX: result.targetX,
            targetY: result.targetY,
          },
          "TownRoom request_move accepted but player presence not found.",
        );
      }
    });
  }

  /**
   * Normalize the join-options object into the internal auth shape the
   * room needs. Returns `null` when the shape is not one of the
   * supported variants.
   */
  private normalizeJoinOptions(
    options: TownRoomJoinOptions,
  ): {
    readonly sessionToken?: string;
    readonly userId?: UserId;
    readonly characterId: CharacterId;
    readonly requestedZoneId?: ZoneId;
  } | null {
    const characterId = options.characterId;
    if (typeof characterId !== "string" || characterId.length === 0) {
      return null;
    }

    if (
      options.sessionToken !== undefined &&
      typeof options.sessionToken === "string" &&
      options.sessionToken.length > 0
    ) {
      const result: {
        readonly sessionToken: string;
        readonly characterId: CharacterId;
        readonly requestedZoneId?: ZoneId;
      } = {
        sessionToken: options.sessionToken,
        characterId: characterId as CharacterId,
      };
      if (options.requestedZoneId !== undefined) {
        return { ...result, requestedZoneId: options.requestedZoneId };
      }
      return result;
    }

    if (
      options.userId !== undefined &&
      typeof options.userId === "string" &&
      options.userId.length > 0
    ) {
      const result: {
        readonly userId: UserId;
        readonly characterId: CharacterId;
        readonly requestedZoneId?: ZoneId;
      } = {
        userId: options.userId as UserId,
        characterId: characterId as CharacterId,
      };
      if (options.requestedZoneId !== undefined) {
        return { ...result, requestedZoneId: options.requestedZoneId };
      }
      return result;
    }

    return null;
  }

  private registerInteractHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.interactHandlerRegistered) {
      return;
    }
    this.interactHandlerRegistered = true;

    this.onMessage("request_interact", async (client: Client, raw: unknown) => {
      const state = this.state as TownRoomState;
      const message = raw as Partial<RequestInteractClientMessage> | null;

      if (!message || typeof message.objectId !== "string") {
        log.warn?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
          },
          "TownRoom request_interact rejected: invalid shape.",
        );
        return;
      }

      // Find player presence to get their position
      const player = state.playerPresence.get(client.sessionId);
      if (!player) {
        log.warn?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
          },
          "TownRoom request_interact rejected: player not found.",
        );
        return;
      }

      // Validate interact request (distance check, object exists, etc.)
      const validation = validateInteractIntent(
        state,
        player.x,
        player.y,
        message.objectId,
        player.lifeState,
      );

      if (!validation.ok) {
        if (validation.reason === "out_of_range") {
          const interactable = state.interactables.get(message.objectId);
          if (interactable !== undefined) {
            setPendingAction(player, {
              type: "interact",
              targetId: interactable.id,
              targetX: interactable.x,
              targetY: interactable.y,
            });
            // Task 206 -- walk to interact range, not on top of the object.
            const approach = resolveApproachTarget(
              player,
              { x: interactable.x, y: interactable.y },
              INTERACT_APPROACH_DISTANCE,
            );
            applyMovementIntent(state, client.sessionId, approach.x, approach.y);
            const queued: DeferredActionQueuedServerMessage = {
              type: "deferred_action_queued",
              actionType: "interact",
              targetId: interactable.id,
              message: "Moving closer.",
            };
            try {
              client.send("deferred_action_queued", queued);
            } catch {}
          } else {
            clearPendingAction(player);
          }
        } else {
          clearPendingAction(player);
        }
        log.debug?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            objectId: message.objectId,
            reason: validation.reason,
          },
          "TownRoom request_interact rejected by validation.",
        );
        return;
      }

      // Send response message to the requesting client
      const responseMessage = getInteractableResponseMessage(message.objectId);
      if (message.objectId === "nightmarket_notice_board_01") {
        // Task 333C — Turn-in flow for the completed notice board
        // objective. The flow is:
        //  1. Objective is completed AND reward not yet granted → turn
        //     it in, grant copper reward, mark rewardGranted, clear
        //     the HUD objective state, send interact_response with
        //     localized turn-in feedback.
        //  2. Objective is completed AND reward already granted → show
        //     safe "already completed" message.
        //  3. Objective is active but not completed → re-send current
        //     state (no duplicate, no reset).
        //  4. No active objective → start next available one in the
        //     sequence, or show "no more notices" if done.
        // Task 333E — Reward granting persists rewardGranted = true
        // BEFORE granting copper to prevent duplicate reward on
        // reconnect/crash. HUD display fields are cleared but
        // objectiveId and objectiveRewardGranted are kept so
        // findNextNoticeBoardObjective can skip completed objectives.
        if (player.hasObjective && player.objectiveId.length > 0 && player.objectiveCompleted && !player.objectiveRewardGranted) {
          // Turn in: persist rewardGranted, grant copper, clear HUD.
          const activeObjective = getActiveObjectiveContent(player);
          if (activeObjective !== undefined) {
            const turnInCharId = player.characterId;
            const turnInObjId = player.objectiveId;
            const turnInLabel = player.objectiveLabel;
            const copperReward = activeObjective.copperReward;

            // Persist rewardGranted = true to DB FIRST. This
            // prevents duplicate copper on reconnect/crash.
            try {
              await new ObjectiveRepository().markRewardGranted(
                turnInCharId.toString(),
                turnInObjId,
              );
            } catch {
              // Persistence failed — do not grant reward.
              return;
            }

            const xpReward = activeObjective.xpReward;

            const completedIds = player.completedObjectiveIds.length > 0
              ? player.completedObjectiveIds.split(",").filter((value) => value.length > 0)
              : [];
            const completedTitles = player.completedObjectiveTitles.length > 0
              ? player.completedObjectiveTitles.split(",")
              : [];
            if (!completedIds.includes(turnInObjId)) {
              completedIds.push(turnInObjId);
              completedTitles.push(turnInLabel);
              player.completedObjectiveIds = completedIds.join(",");
              player.completedObjectiveTitles = completedTitles.join(",");
            }

            // Grant copper reward (awaited, not fire-and-forget).
            if (Number.isFinite(copperReward) && copperReward > 0) {
              const rep = new CharacterRepository();
              const total = await rep.incrementMoneyCopper(turnInCharId.toString(), copperReward);
              if (total !== null) {
                const currencyMsg: import("@doomscrolls/shared").CurrencyPickedUpServerMessage = {
                  type: "currency_picked_up",
                  characterId: turnInCharId,
                  gainedCopper: copperReward,
                  totalMoneyCopper: total,
                };
                try { client.send("currency_picked_up", currencyMsg); } catch {}
              }
            }

            // Task 349 — Grant XP reward through server-authoritative
            // progression path. rewardGranted is already persisted
            // above, so a crash/reconnect between here and persistence
            // cannot double-award XP.
            await grantFlatXpReward(
              { characterId: turnInCharId, xp: player.xp, level: player.level, maxHp: player.maxHp, hp: player.hp },
              xpReward,
              (type, payload) => { try { client.send(type, payload); } catch {} },
            );

            // Clear HUD display fields but keep objectiveId and
            // objectiveRewardGranted so findNextNoticeBoardObjective
            // can properly skip completed objectives on re-interact.
            player.hasObjective = false;
            player.objectiveLabel = "";
            player.objectiveCurrent = 0;
            player.objectiveTarget = 0;
            player.objectiveCompleted = false;

            // Send interact_response with localized turn-in feedback.
            const hasXp = Number.isFinite(xpReward) && xpReward > 0;
            const hasCopper = Number.isFinite(copperReward) && copperReward > 0;
            const turnInText = hasXp && hasCopper
              ? t("objective.turn_in_complete_reward" as never, { xpReward, copperReward } as never)
              : hasXp
                ? t("objective.turn_in_complete_reward_xp_only" as never, { xpReward } as never)
                : hasCopper
                  ? t("objective.turn_in_complete_reward_copper_only" as never, { copperReward } as never)
                  : t("objective.ready_to_turn_in" as never, { title: turnInLabel } as never);
            const turnInMessage: import("@doomscrolls/shared").InteractResponseServerMessage = {
              type: "interact_response",
              objectId: message.objectId,
              message: turnInText,
            };
            try { client.send("interact_response", turnInMessage); } catch {}
            log.debug?.(
              { roomId: this.roomId, roomName: this.roomName, sessionId: client.sessionId, characterId: turnInCharId, objectiveId: turnInObjId, copperReward },
              "TownRoom notice board turn-in accepted: reward granted.",
            );
          }
        } else if (player.hasObjective && player.objectiveId.length > 0 && player.objectiveCompleted && player.objectiveRewardGranted) {
          // Already completed and rewarded — show safe message.
          // The HUD objective tracker was already cleared on turn-in;
          // this is the re-interact case for the same completed objective.
          const doneMessage: import("@doomscrolls/shared").InteractResponseServerMessage = {
            type: "interact_response",
            objectId: message.objectId,
            message: t("objective.already_completed" as never),
          };
          try { client.send("interact_response", doneMessage); } catch {}
        } else if (player.hasObjective && player.objectiveId.length > 0 && !player.objectiveCompleted && !player.objectiveRewardGranted) {
          // Active objective that is not yet complete — re-send current
          // state without resetting or duplicating.
          const reSend = buildObjectiveUpdatedMessage(player, player.objectiveId);
          try { client.send("objective_updated", reSend); } catch {}
        } else {
          // No active objective — show available objectives the player
          // can choose from. This replaces the old auto-start-next
          // behavior with a selectable catalog. Only one objective may
          // be active at a time.
          const availableEntries = buildAvailableNoticeBoardObjectives(player);
          const catalogMessage: import("@doomscrolls/shared").InteractResponseServerMessage = {
            type: "interact_response",
            objectId: message.objectId,
            message: availableEntries.length > 0
              ? t("objective.choose_objective" as never)
              : t("objective.no_more_notices" as never),
            ...(availableEntries.length > 0 ? { availableObjectives: availableEntries } : {}),
          };
          try { client.send("interact_response", catalogMessage); } catch {}
        }
      }

      // Task 180 — Handle loot container interaction
      if (message.objectId === "nightmarket_loot_container_01") {
        const containerResult = handleLootContainerInteraction(state, message.objectId);
        const containerResponse: InteractResponseServerMessage = {
          type: "interact_response",
          objectId: message.objectId,
          message: containerResult.message,
        };
        try {
          client.send("interact_response", containerResponse);
        } catch {
          log.warn?.(
            { roomId: this.roomId, roomName: this.roomName, sessionId: client.sessionId },
            "TownRoom loot container interact_response send failed.",
          );
        }
        log.debug?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            objectId: message.objectId,
            ok: containerResult.ok,
          },
          "TownRoom loot container interaction handled.",
        );
        return;
      }

      if (message.objectId === "nightmarket_stash_keeper_01") {
        try {
          const stashItems = await new ItemRepository().listStashItems(player.characterId.toString());
          const stashListed: import("@doomscrolls/shared").StashItemsListedServerMessage = {
            type: "stash_items_listed",
            objectId: message.objectId,
            serviceId: "nightmarket_stash_keeper",
            items: stashItems.map((item) => toItemInstanceDto(item)),
          };
          try {
            client.send("stash_items_listed", stashListed);
          } catch {}
        } catch {
          const rejected: import("@doomscrolls/shared").StashItemsListRejectedServerMessage = {
            type: "stash_items_list_rejected",
            objectId: message.objectId,
            serviceId: "nightmarket_stash_keeper",
            reason: "list_failed",
          };
          try {
            client.send("stash_items_list_rejected", rejected);
          } catch {}
        }
      }

      if (message.objectId === "nightmarket_waypoint_01" || message.objectId === "nightmarket_waypoint_blackwire_combat_edge") {
        try {
          const waypointOpened = await activateAndBuildWaypointPanel(player.characterId, message.objectId);
          if (waypointOpened !== null) {
            try {
              client.send("waypoint_opened", waypointOpened);
            } catch {}
          }
        } catch {
          const response: InteractResponseServerMessage = {
            type: "interact_response",
            objectId: message.objectId,
            message: getWaypointRejectedMessage("travel_failed"),
          };
          try {
            client.send("interact_response", response);
          } catch {}
        }
        return;
      }

      if (
        message.objectId === "nightmarket_blackwire_gate_01"
        || message.objectId === "nightmarket_blackwire_return_01"
      ) {
        try {
          if (message.objectId === "nightmarket_blackwire_gate_01" && (player as { pendingRoomHandoff?: boolean }).pendingRoomHandoff === true) {
            const rejected: import("@doomscrolls/shared").TownCombatHandoffRejectedServerMessage = {
              type: "town_combat_handoff_rejected",
              objectId: message.objectId,
              reason: "duplicate_request",
            };
            try { client.send("town_combat_handoff_rejected", rejected); } catch {}
            return;
          }

          const result = await resolveRouteTravel(state.zoneId, message.objectId);
          if (!result.ok) {
            if (message.objectId === "nightmarket_blackwire_gate_01") {
              const rejected: import("@doomscrolls/shared").TownCombatHandoffRejectedServerMessage = {
                type: "town_combat_handoff_rejected",
                objectId: message.objectId,
                reason: result.reason === "invalid_destination" ? "invalid_destination" : "transition_unavailable",
              };
              try { client.send("town_combat_handoff_rejected", rejected); } catch {}
              return;
            }
            const rejected: import("@doomscrolls/shared").RequestRouteTravelRejectedServerMessage = {
              type: "request_route_travel_rejected",
              objectId: message.objectId,
              reason: result.reason,
            };
            try { client.send("request_route_travel_rejected", rejected); } catch {}
            return;
          }

          player.hasMovementTarget = false;
          clearPendingAction(player);

          if (result.handoffRoomKind === "combat") {
            try {
              await new CharacterService().updateCharacterRoomIntent(
                player.characterId,
                result.zoneId,
                result.x,
                result.y,
                Math.max(0, Math.min(player.maxHp, player.hp)),
                Math.max(0, Math.min(player.maxFlaskCharges, Math.floor(player.flaskCharges))),
              );
            } catch {
              const rejected: import("@doomscrolls/shared").TownCombatHandoffRejectedServerMessage = {
                type: "town_combat_handoff_rejected",
                objectId: message.objectId,
                reason: "transition_failed",
              };
              try { client.send("town_combat_handoff_rejected", rejected); } catch {}
              return;
            }

            (player as { pendingRoomHandoff?: boolean }).pendingRoomHandoff = true;
            const approved: import("@doomscrolls/shared").TownCombatHandoffApprovedServerMessage = {
              type: "town_combat_handoff_approved",
              characterId: player.characterId,
              fromRoomKind: "town",
              toRoomKind: "combat",
              targetZoneId: result.zoneId,
              targetSpawnKey: result.targetSpawnKey ?? "blackwire_entry",
              message: `${t(result.messageKey as never)} ${t(result.areaKey as never)}`,
            };
            try { client.send("town_combat_handoff_approved", approved); } catch {}
            return;
          }

          player.x = result.x;
          player.y = result.y;
          player.targetX = result.x;
          player.targetY = result.y;

          try {
            await new CharacterService().updateCharacterLocation(
              player.characterId,
              result.zoneId,
              result.x,
              result.y,
              Math.max(0, Math.min(player.maxHp, player.hp)),
              Math.max(0, Math.min(player.maxFlaskCharges, Math.floor(player.flaskCharges))),
            );
          } catch {
            const rejected: import("@doomscrolls/shared").RequestRouteTravelRejectedServerMessage = {
              type: "request_route_travel_rejected",
              objectId: message.objectId,
              reason: "travel_failed",
            };
            try { client.send("request_route_travel_rejected", rejected); } catch {}
            return;
          }

          // Client receives new player position via Colyseus schema
          // sync; no client-side fake transition is sent.
          const accepted: import("@doomscrolls/shared").RequestRouteTravelAcceptedServerMessage = {
            type: "request_route_travel_accepted",
            objectId: result.objectId,
            zoneId: result.zoneId,
            x: result.x,
            y: result.y,
            message: `${t(result.messageKey as never)} ${t(result.areaKey as never)}`,
            areaLabel: t(result.areaKey as never),
          };
          try { client.send("request_route_travel_accepted", accepted); } catch {}
        } catch {
          if (message.objectId === "nightmarket_blackwire_gate_01") {
            const rejected: import("@doomscrolls/shared").TownCombatHandoffRejectedServerMessage = {
              type: "town_combat_handoff_rejected",
              objectId: message.objectId,
              reason: "transition_failed",
            };
            try { client.send("town_combat_handoff_rejected", rejected); } catch {}
            return;
          }
          const response: InteractResponseServerMessage = {
            type: "interact_response",
            objectId: message.objectId,
            message: getRouteRejectedMessage("travel_failed"),
          };
          try { client.send("interact_response", response); } catch {}
        }
        return;
      }

      const response: InteractResponseServerMessage = {
        type: "interact_response",
        objectId: message.objectId,
        message: responseMessage,
      };

      try {
        client.send("interact_response", response);
      } catch {
        log.warn?.(
          { roomId: this.roomId, roomName: this.roomName, sessionId: client.sessionId },
          "TownRoom interact_response send failed.",
        );
      }

      log.debug?.(
        {
          roomId: this.roomId,
          roomName: this.roomName,
          sessionId: client.sessionId,
          objectId: message.objectId,
        },
        "TownRoom request_interact accepted and response sent.",
      );
    });

    this.onMessage("request_waypoint_travel", async (client: Client, raw: unknown) => {
      const state = this.state as TownRoomState;
      const player = state.playerPresence.get(client.sessionId);
      const message = raw as { waypointId?: unknown } | null;

      if (player === undefined || player.lifeState !== "alive") {
        const rejected: import("@doomscrolls/shared").RequestWaypointTravelRejectedServerMessage = {
          type: "request_waypoint_travel_rejected",
          reason: "travel_failed",
          ...(typeof message?.waypointId === "string" ? { waypointId: message.waypointId } : {}),
        };
        try { client.send("request_waypoint_travel_rejected", rejected); } catch {}
        return;
      }

      if (typeof message?.waypointId !== "string" || message.waypointId.length === 0) {
        const rejected: import("@doomscrolls/shared").RequestWaypointTravelRejectedServerMessage = {
          type: "request_waypoint_travel_rejected",
          reason: "invalid_destination",
        };
        try { client.send("request_waypoint_travel_rejected", rejected); } catch {}
        return;
      }

      try {
        const result = await resolveWaypointTravel(player.characterId, state.zoneId, message.waypointId);
        if (!result.ok) {
          const rejected: import("@doomscrolls/shared").RequestWaypointTravelRejectedServerMessage = {
            type: "request_waypoint_travel_rejected",
            waypointId: message.waypointId,
            reason: result.reason,
          };
          try { client.send("request_waypoint_travel_rejected", rejected); } catch {}
          return;
        }

        player.x = result.x;
        player.y = result.y;
        player.targetX = result.x;
        player.targetY = result.y;
        // Task 334 — Immediately clear movement target and pending
        // action so stale move-to-interact/attack/pickup state cannot
        // fire after the player has teleported to a new position.
        player.hasMovementTarget = false;
        clearPendingAction(player);

        try {
          await new CharacterService().updateCharacterLocation(
            player.characterId,
            result.zoneId,
            result.x,
            result.y,
            Math.max(0, Math.min(player.maxHp, player.hp)),
            Math.max(0, Math.min(player.maxFlaskCharges, Math.floor(player.flaskCharges))),
          );
        } catch {
          const rejected: import("@doomscrolls/shared").RequestWaypointTravelRejectedServerMessage = {
            type: "request_waypoint_travel_rejected",
            waypointId: message.waypointId,
            reason: "travel_failed",
          };
          try { client.send("request_waypoint_travel_rejected", rejected); } catch {}
          return;
        }

        // Client receives new player position via Colyseus schema
        // sync; no client-side fake transition is sent.
        const accepted: import("@doomscrolls/shared").RequestWaypointTravelAcceptedServerMessage = {
          type: "request_waypoint_travel_accepted",
          waypointId: result.waypointId,
          zoneId: result.zoneId,
          x: result.x,
          y: result.y,
          message: t("town_service.waypoint.travel_success" as never),
        };
        try { client.send("request_waypoint_travel_accepted", accepted); } catch {}
      } catch {
        const rejected: import("@doomscrolls/shared").RequestWaypointTravelRejectedServerMessage = {
          type: "request_waypoint_travel_rejected",
          waypointId: message.waypointId,
          reason: "travel_failed",
        };
        try { client.send("request_waypoint_travel_rejected", rejected); } catch {}
      }
    });
  }

  private registerResetObjectiveHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.resetObjectiveHandlerRegistered) {
      return;
    }
    this.resetObjectiveHandlerRegistered = true;

    this.onMessage("request_reset_objective", (client: Client, raw: unknown) => {
      const message = raw as Partial<RequestResetObjectiveClientMessage> | null;
      if (message?.type !== "request_reset_objective") {
        log.warn?.(
          { roomId: this.roomId, roomName: this.roomName, sessionId: client.sessionId },
          "TownRoom request_reset_objective rejected: invalid shape.",
        );
        return;
      }

      const state = this.state as TownRoomState;
      const player = state.playerPresence.get(client.sessionId);
      if (player === undefined) {
        log.warn?.(
          { roomId: this.roomId, roomName: this.roomName, sessionId: client.sessionId },
          "TownRoom request_reset_objective rejected: player not found.",
        );
        return;
      }

      if (!player.hasObjective && player.objectiveId.length === 0) {
        return;
      }

      resetNoticeBoardObjective(player);
      log.info?.(
        { roomId: this.roomId, roomName: this.roomName, sessionId: client.sessionId, characterId: player.characterId },
        "TownRoom objective reset accepted.",
      );
    });
  }

  private registerAttackHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.attackHandlerRegistered) {
      return;
    }
    this.attackHandlerRegistered = true;

    this.onMessage("request_attack", (client: Client, raw: unknown) => {
      const state = this.state as TownRoomState;
      const message = raw as Partial<RequestAttackClientMessage> | null;
      const targetEnemyId = typeof message?.targetEnemyId === "string"
        ? message.targetEnemyId
        : undefined;
      const player = state.playerPresence.get(client.sessionId);
      const now = Date.now();
      const validation = validateAttackIntent(state, player, targetEnemyId ?? "", now);

      if (!validation.ok) {
        if (validation.reason === "out_of_range" && player !== undefined && targetEnemyId !== undefined) {
          const enemy = state.enemies.get(targetEnemyId);
          if (enemy !== undefined && !enemy.defeated && enemy.hp > 0) {
            setPendingAction(player, {
              type: "attack",
              targetId: enemy.id,
              targetX: enemy.x,
              targetY: enemy.y,
            });
            // Task 206 -- walk to engagement range, not on top of the enemy.
            const approach = resolveApproachTarget(
              player,
              { x: enemy.x, y: enemy.y },
              BASIC_ATTACK_RANGE,
            );
            applyMovementIntent(state, client.sessionId, approach.x, approach.y);
            const queued: DeferredActionQueuedServerMessage = {
              type: "deferred_action_queued",
              actionType: "attack",
              targetId: enemy.id,
              message: "Moving closer.",
            };
            try {
              client.send("deferred_action_queued", queued);
            } catch {}
            log.debug?.(
              {
                roomId: this.roomId,
                roomName: this.roomName,
                sessionId: client.sessionId,
                targetEnemyId,
              },
              "TownRoom request_attack queued as deferred move-closer action.",
            );
            return;
          }

          clearPendingAction(player);
          const rejection: RequestAttackRejectedServerMessage = {
            type: "request_attack_rejected",
            reason: "enemy_not_found",
            ...(targetEnemyId !== undefined ? { targetEnemyId } : {}),
          };

          try {
            client.send("request_attack_rejected", rejection);
          } catch {
            // swallow send failures; never crash room on rejected attack intent
          }

          log.debug?.(
            {
              roomId: this.roomId,
              roomName: this.roomName,
              sessionId: client.sessionId,
              targetEnemyId,
              reason: rejection.reason,
            },
            "TownRoom request_attack could not queue because target is no longer valid.",
          );
          return;
        } else if (player !== undefined) {
          clearPendingAction(player);
        }

        const rejection: RequestAttackRejectedServerMessage = {
          type: "request_attack_rejected",
          reason: validation.reason,
          ...(targetEnemyId !== undefined ? { targetEnemyId } : {}),
        };

        try {
          client.send("request_attack_rejected", rejection);
        } catch {
          // swallow send failures; never crash room on rejected attack intent
        }

        log.debug?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            targetEnemyId,
            reason: validation.reason,
          },
          "TownRoom request_attack rejected.",
        );
        return;
      }

      if (player === undefined) {
        log.warn?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            targetEnemyId,
          },
          "TownRoom request_attack validated without player presence; ignoring as safety guard.",
        );
        return;
      }

      clearPendingAction(player);
      consumeAttackCooldown(player, now);
      const damageResult = applyEnemyDamage(validation.enemy, 1);
      const spawnedLootList = damageResult.defeated
        ? spawnWorldLootOnEnemyDefeat(state, validation.enemy, now)
        : [];
      if (damageResult.defeated) {
        // Task 333B — Objective progress increment (single-objective
        // foundation only). The new helper only tracks progress and
        // sets the completed flag when the required kill count is
        // reached; it does NOT grant rewards or mark rewardGranted.
        // Completion/turn-in and reward logic is handled by the
        // notice board interaction handler (explicit turn-in path);
        // kill progress is reward-free.
        const progressResult = advanceObjectiveProgress(player, validation.enemy.enemyId, (updated) => {
          void new ObjectiveRepository().updateProgress(
            updated.characterId.toString(),
            updated.objectiveId,
            updated.currentProgress,
          ).catch(() => {});
        });
        if (progressResult !== undefined) {
          const progressUpdate: ObjectiveUpdatedServerMessage = {
            type: "objective_updated",
            objectiveId: progressResult.objectiveId,
            label: progressResult.label,
            descriptionKey: progressResult.descriptionKey,
            current: progressResult.current,
            target: progressResult.target,
            completed: progressResult.completed,
          };
          try {
            client.send("objective_updated", progressUpdate);
          } catch {
            // ignore send failures; authoritative state persists
          }
        }
        void grantEnemyDefeatXp(player, validation.enemy.enemyId, (type, payload) => {
          try {
            client.send(type, payload);
          } catch {
            // ignore send failures; authoritative state persists
          }
        }).catch((error: unknown) => {
          log.warn?.(
            {
              roomId: this.roomId,
              roomName: this.roomName,
              sessionId: client.sessionId,
              characterId: player.characterId,
              enemyId: validation.enemy.enemyId,
              enemyInstanceId: validation.enemy.id,
              enemyLabel: validation.enemy.label,
              errorMessage: error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack : undefined,
              errorName: error instanceof Error ? error.name : undefined,
            },
            "TownRoom enemy defeat XP grant failed after kill.",
          );
        });
      }
      const accepted: RequestAttackAcceptedServerMessage = {
        type: "request_attack_accepted",
        targetEnemyId: validation.enemy.id,
      };

      try {
        client.send("request_attack_accepted", accepted);
      } catch {
        // swallow send failures; state sync remains authoritative
      }

      log.debug?.(
        {
          roomId: this.roomId,
          roomName: this.roomName,
          sessionId: client.sessionId,
          targetEnemyId: validation.enemy.id,
          remainingHp: damageResult.remainingHp,
          appliedDamage: damageResult.appliedDamage,
          defeated: damageResult.defeated,
          respawnAtMs: damageResult.respawnAtMs,
          worldLootCount: spawnedLootList.length,
          worldLootFirstId: spawnedLootList[0]?.id,
          nextAttackAt: player.nextAttackAt,
        },
        "TownRoom request_attack accepted and synced enemy defeat/placeholder loot state updated.",
      );
    });
  }

  private registerPickupWorldLootHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.pickupWorldLootHandlerRegistered) {
      return;
    }
    this.pickupWorldLootHandlerRegistered = true;

    this.onMessage("request_pickup_world_loot", async (client: Client, raw: unknown) => {
      const state = this.state as TownRoomState;
      const message = raw as Partial<RequestPickupWorldLootClientMessage> | null;
      const worldLootId = typeof message?.worldLootId === "string"
        ? message.worldLootId
        : undefined;
      const player = state.playerPresence.get(client.sessionId);
      const validation = validatePickupWorldLootIntent(state, player, worldLootId ?? "");

      if (!validation.ok) {
        if (validation.reason === "out_of_range" && player !== undefined && worldLootId !== undefined) {
          const worldLoot = state.worldLoot.get(worldLootId);
          if (worldLoot !== undefined) {
            setPendingAction(player, {
              type: "pickup",
              targetId: worldLoot.id,
              targetX: worldLoot.x,
              targetY: worldLoot.y,
            });
            // Task 206 -- walk to a close pickup distance, not on top of the loot.
            const approach = resolveApproachTarget(
              player,
              { x: worldLoot.x, y: worldLoot.y },
              PICKUP_APPROACH_DISTANCE,
            );
            applyMovementIntent(state, client.sessionId, approach.x, approach.y);
            const queued: DeferredActionQueuedServerMessage = {
              type: "deferred_action_queued",
              actionType: "pickup",
              targetId: worldLoot.id,
              message: "Moving closer.",
            };
            try {
              client.send("deferred_action_queued", queued);
            } catch {}
            log.debug?.(
              {
                roomId: this.roomId,
                roomName: this.roomName,
                sessionId: client.sessionId,
                worldLootId,
              },
              "TownRoom request_pickup_world_loot queued as deferred move-closer action.",
            );
            return;
          }

          clearPendingAction(player);
          const rejection: RequestPickupWorldLootRejectedServerMessage = {
            type: "request_pickup_world_loot_rejected",
            reason: "world_loot_not_found",
            ...(worldLootId !== undefined ? { worldLootId } : {}),
          };

          try {
            client.send("request_pickup_world_loot_rejected", rejection);
          } catch {
            // swallow send failures; never crash room on rejected pickup intent
          }

          log.debug?.(
            {
              roomId: this.roomId,
              roomName: this.roomName,
              sessionId: client.sessionId,
              worldLootId,
              reason: rejection.reason,
            },
            "TownRoom request_pickup_world_loot could not queue because target is no longer valid.",
          );
          return;
        } else if (player !== undefined) {
          clearPendingAction(player);
        }

        const rejection: RequestPickupWorldLootRejectedServerMessage = {
          type: "request_pickup_world_loot_rejected",
          reason: validation.reason,
          ...(worldLootId !== undefined ? { worldLootId } : {}),
        };

        try {
          client.send("request_pickup_world_loot_rejected", rejection);
        } catch {
          // swallow send failures; never crash room on rejected pickup intent
        }

        log.debug?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            worldLootId,
            reason: validation.reason,
          },
          "TownRoom request_pickup_world_loot rejected.",
        );
        return;
      }

      if (player === undefined) {
        log.warn?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            worldLootId,
          },
          "TownRoom request_pickup_world_loot validated without player presence; ignoring as safety guard.",
        );
        return;
      }

      clearPendingAction(player);
      const dispatchResult = await dispatchPickedUpWorldLoot({
        characterId: player.characterId,
        worldLoot: validation.worldLoot,
      });

      if (!dispatchResult.ok) {
        try {
          client.send("request_pickup_world_loot_rejected", dispatchResult.rejected);
        } catch {
          // swallow send failures; never crash room on rejected pickup intent
        }

        log.debug?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            worldLootId: validation.worldLoot.id,
            worldLootItemId: validation.worldLoot.itemId,
            reason: dispatchResult.rejected.reason,
          },
          "TownRoom request_pickup_world_loot rejected during persistence.",
        );
        return;
      }

      state.worldLoot.delete(validation.worldLoot.id);

      if (dispatchResult.currencyMessage !== null) {
        try {
          client.send("currency_picked_up", dispatchResult.currencyMessage);
        } catch {
          // swallow send failures; state sync remains authoritative
        }
      }

      const accepted: RequestPickupWorldLootAcceptedServerMessage = dispatchResult.accepted;

      try {
        client.send("request_pickup_world_loot_accepted", accepted);
      } catch {
        // swallow send failures; state sync remains authoritative
      }

      log.debug?.(
        {
          roomId: this.roomId,
          roomName: this.roomName,
          sessionId: client.sessionId,
          worldLootId: validation.worldLoot.id,
          worldLootItemId: validation.worldLoot.itemId,
          distance: validation.distance,
        },
        "TownRoom request_pickup_world_loot accepted and synced loot removed from room state.",
      );
    });
  }

  private registerRespawnHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.respawnHandlerRegistered) {
      return;
    }
    this.respawnHandlerRegistered = true;

    this.onMessage("request_respawn", (client: Client) => {
      const state = this.state as TownRoomState;
      const player = state.playerPresence.get(client.sessionId);
      if (player === undefined || player.lifeState === "alive") {
        return;
      }

      const spawnPoint = contentRegistry.spawnPoints.get(
        NIGHTMARKET_DEFAULT_SPAWN_POINT_ID as SpawnPointContentId,
      );
      if (spawnPoint === undefined) {
        return;
      }

      const respawnPosition = resolvePlayerInitialPosition({
        resolvedZoneId: state.zoneId,
        spawnPointX: spawnPoint.x,
        spawnPointY: spawnPoint.y,
        restoredLocationZoneId: state.zoneId,
        restoredLocationX: player.x,
        restoredLocationY: player.y,
      });

      player.hp = player.maxHp;
      player.lifeState = "alive";
      // Keep the corpse marker so the player can walk back and
      // recover it after respawn. The corpse is cleared on
      // successful `request_corpse_interact` instead.
      player.x = respawnPosition.x;
      player.y = respawnPosition.y;
      player.targetX = respawnPosition.x;
      player.targetY = respawnPosition.y;
      player.hasMovementTarget = false;
      // Task 096 -- respawn restores a full set of basic healing
      // flask charges and resets the flask cooldown to "ready".
      restoreFlaskToFull(player);
      clearPendingAction(player);
      state.enemies.forEach((enemy) => {
        if (enemy.targetPlayerSessionId === client.sessionId) {
          clearEnemyTargetAndReturn(enemy);
        }
      });

      const message: PlayerRespawnedServerMessage = {
        type: "player_respawned",
        characterId: player.characterId,
        zoneId: state.zoneId,
        hp: player.hp,
      };

      try {
        client.send("player_respawned", message);
      } catch {}

      log.debug?.({ roomId: this.roomId, roomName: this.roomName, sessionId: client.sessionId, characterId: player.characterId }, "TownRoom player respawned.");
    });
  }

  /**
   * Task 235 -- Register the `request_corpse_interact` message handler.
   *
   * Validates that the player is alive with an active corpse marker,
   * owns the corpse (only own corpse is tracked), is within interact
   * range (~30 world units), and on acceptance clears the corpse marker.
   * Rejects if player is still downed. Corpse recovery must happen
   * after respawn, not while downed.
   */
  private registerCorpseInteractHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.corpseInteractHandlerRegistered) {
      return;
    }
    this.corpseInteractHandlerRegistered = true;

    this.onMessage("request_corpse_interact", (client: Client) => {
      const state = this.state as TownRoomState;
      const player = state.playerPresence.get(client.sessionId);
      if (player === undefined) {
        log.warn?.(
          { roomId: this.roomId, roomName: this.roomName, sessionId: client.sessionId },
          "TownRoom request_corpse_interact rejected: player not found.",
        );
        return;
      }

      // Must be alive (after respawn) to interact with a corpse marker
      if (player.lifeState !== "alive") {
        const rejection: import("@doomscrolls/shared").CorpseInteractRejectedServerMessage = {
          type: "corpse_interact_rejected",
          reason: "player_downed",
        };
        try { client.send("corpse_interact_rejected", rejection); } catch {}
        return;
      }

      // Must have an active corpse marker
      if (!player.hasCorpse) {
        const rejection: import("@doomscrolls/shared").CorpseInteractRejectedServerMessage = {
          type: "corpse_interact_rejected",
          reason: "no_corpse",
        };
        try { client.send("corpse_interact_rejected", rejection); } catch {}
        return;
      }

      // Range check
      const dx = player.corpseX - player.x;
      const dy = player.corpseY - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 30) {
        const rejection: import("@doomscrolls/shared").CorpseInteractRejectedServerMessage = {
          type: "corpse_interact_rejected",
          reason: "out_of_range",
        };
        try { client.send("corpse_interact_rejected", rejection); } catch {}
        return;
      }

      // Accept and clear corpse
      player.hasCorpse = false;
      player.corpseX = 0;
      player.corpseY = 0;

      const accepted: import("@doomscrolls/shared").CorpseInteractAcceptedServerMessage = {
        type: "corpse_interact_accepted",
        message: "Corpse recovered.",
      };
      try { client.send("corpse_interact_accepted", accepted); } catch {}

      log.debug?.(
        { roomId: this.roomId, roomName: this.roomName, sessionId: client.sessionId, characterId: player.characterId },
        "TownRoom corpse interact accepted. Corpse marker cleared.",
      );
    });
  }

  /**
   * Task 095 -- Register the `request_dodge` message handler on the
   * room.
   *
   * Scope:
   *   - validate the intent shape + direction finiteness via
   *     {@link validateDodgeIntent}
   *   - reject with safe `request_dodge_rejected` reason on
   *     shape/finite/zero failures
   *   - reject with `player_downed` if the player is downed
   *   - reject with `dodge_on_cooldown` if the player cannot yet
   *     dodge again
   *   - on acceptance, apply the dodge via {@link applyDodgeIntent}
   *     (which both moves the player and cancels any enemy
   *     telegraph targeting the player) and consume the dodge
   *     cooldown
   *   - send `request_dodge_accepted` back to the originating
   *     client so the UI can show safe "dodge sent" feedback
   *
   * The handler is registered once per room, never throws into
   * Colyseus, and never trusts client-supplied damage, kills, XP,
   * loot, inventory changes, equipment changes, level-up or quest
   * completion.
   */
  private registerDodgeHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.dodgeHandlerRegistered) {
      return;
    }
    this.dodgeHandlerRegistered = true;

    this.onMessage("request_dodge", (client: Client, raw: unknown) => {
      const state = this.state as TownRoomState;
      const player = state.playerPresence.get(client.sessionId);

      if (player === undefined) {
        log.warn?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
          },
          "TownRoom request_dodge rejected: player not found.",
        );
        return;
      }

      if (player.lifeState !== "alive") {
        const rejection: RequestDodgeRejectedServerMessage = {
          type: "request_dodge_rejected",
          reason: "player_downed",
        };
        try {
          client.send("request_dodge_rejected", rejection);
        } catch {
          // swallow send failures
        }
        return;
      }

      const validation = validateDodgeIntent({ message: raw });
      if (!validation.ok) {
        const rejection: RequestDodgeRejectedServerMessage = {
          type: "request_dodge_rejected",
          reason: validation.reason,
        };
        try {
          client.send("request_dodge_rejected", rejection);
        } catch {
          // swallow send failures
        }
        log.warn?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            reason: validation.reason,
          },
          "TownRoom request_dodge rejected: invalid intent shape/direction.",
        );
        return;
      }

      const now = Date.now();
      if (!isDodgeReady(player, now)) {
        const rejection: RequestDodgeRejectedServerMessage = {
          type: "request_dodge_rejected",
          reason: "dodge_on_cooldown",
        };
        try {
          client.send("request_dodge_rejected", rejection);
        } catch {
          // swallow send failures
        }
        log.debug?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            nextDodgeAt: player.nextDodgeAt,
          },
          "TownRoom request_dodge rejected: dodge on cooldown.",
        );
        return;
      }

      const applied = applyDodgeIntent({
        state,
        player,
        dirX: validation.dirX,
        dirY: validation.dirY,
        now,
      });
      consumeDodgeCooldown(player, now);

      const accepted: RequestDodgeAcceptedServerMessage = {
        type: "request_dodge_accepted",
      };
      try {
        client.send("request_dodge_accepted", accepted);
      } catch {
        // swallow send failures; state sync remains authoritative
      }

      log.debug?.(
        {
          roomId: this.roomId,
          roomName: this.roomName,
          sessionId: client.sessionId,
          dirX: validation.dirX,
          dirY: validation.dirY,
          newX: applied.newX,
          newY: applied.newY,
          nextDodgeAt: player.nextDodgeAt,
        },
        "TownRoom request_dodge accepted and player position updated.",
      );
    });
  }

  /**
   * Task 096 — Register the `request_use_healing_flask` message
   * handler on the room.
   *
   * Scope:
   *   - validate the intent shape via {@link validateHealingFlaskIntent}
   *   - apply the flask use through {@link applyHealingFlaskIntent}
   *     which decides alive / charges / cooldown / full-HP outcomes
   *   - on acceptance, send `request_use_healing_flask_accepted`
   *     with safe healed / remainingHp / charges / nextFlaskAt values
   *   - on rejection, send `request_use_healing_flask_rejected`
   *     with a safe reason code so the UI can show "full HP" /
   *     "no charges" / "cooldown" / "downed" feedback
   *
   * The handler is registered once per room, never throws into
   * Colyseus, and never trusts client-supplied heal amount,
   * charges, cooldown or HP.
   */
  private registerHealingFlaskHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.healingFlaskHandlerRegistered) {
      return;
    }
    this.healingFlaskHandlerRegistered = true;

    this.onMessage("request_use_healing_flask", (client: Client, raw: unknown) => {
      const state = this.state as TownRoomState;
      const player = state.playerPresence.get(client.sessionId);

      if (player === undefined) {
        log.warn?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
          },
          "TownRoom request_use_healing_flask rejected: player not found.",
        );
        return;
      }

      const validation = validateHealingFlaskIntent({ message: raw });
      if (!validation.ok) {
        const rejection: RequestUseHealingFlaskRejectedServerMessage = {
          type: "request_use_healing_flask_rejected",
          reason: validation.reason,
        };
        try {
          client.send("request_use_healing_flask_rejected", rejection);
        } catch {
          // swallow send failures
        }
        log.warn?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            reason: validation.reason,
          },
          "TownRoom request_use_healing_flask rejected: invalid intent shape.",
        );
        return;
      }

      const now = Date.now();
      const result = applyHealingFlaskIntent({ player, now });
      if (!result.ok) {
        const rejection: RequestUseHealingFlaskRejectedServerMessage = {
          type: "request_use_healing_flask_rejected",
          reason: result.reason,
        };
        try {
          client.send("request_use_healing_flask_rejected", rejection);
        } catch {
          // swallow send failures
        }
        log.debug?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            reason: result.reason,
            flaskCharges: player.flaskCharges,
            nextFlaskAt: player.nextFlaskAt,
            hp: player.hp,
            maxHp: player.maxHp,
          },
          "TownRoom request_use_healing_flask rejected by application.",
        );
        return;
      }

      const accepted: RequestUseHealingFlaskAcceptedServerMessage = {
        type: "request_use_healing_flask_accepted",
        healedAmount: result.healedAmount,
        remainingHp: result.remainingHp,
        flaskCharges: result.flaskCharges,
        nextFlaskAt: result.nextFlaskAt,
      };
      try {
        client.send("request_use_healing_flask_accepted", accepted);
      } catch {
        // swallow send failures; state sync remains authoritative
      }

      log.debug?.(
        {
          roomId: this.roomId,
          roomName: this.roomName,
          sessionId: client.sessionId,
          healedAmount: result.healedAmount,
          remainingHp: result.remainingHp,
          flaskCharges: result.flaskCharges,
          nextFlaskAt: result.nextFlaskAt,
        },
        "TownRoom request_use_healing_flask accepted and HP / charges synced.",
      );
    });
  }

  private registerSkillSlotHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.skillSlotHandlerRegistered) {
      return;
    }
    this.skillSlotHandlerRegistered = true;

    this.onMessage("request_use_skill_slot", (client: Client, raw: unknown) => {
      const state = this.state as TownRoomState;
      const message = raw as Partial<RequestUseSkillSlotClientMessage> | null;
      const player = state.playerPresence.get(client.sessionId);
      const rejectionBase = {
        type: "request_use_skill_slot_rejected" as const,
        slot: "secondary" as const,
      };

      if (message?.slot !== "secondary") {
        const rejection: RequestUseSkillSlotRejectedServerMessage = {
          ...rejectionBase,
          reason: "skill_unavailable",
        };
        try { client.send(rejection.type, rejection); } catch {}
        return;
      }

      if (player === undefined || player.lifeState !== "alive" || player.hp <= 0) {
        const rejection: RequestUseSkillSlotRejectedServerMessage = {
          ...rejectionBase,
          reason: "player_downed",
        };
        try { client.send(rejection.type, rejection); } catch {}
        return;
      }

      const now = Date.now();
      const nextSkillSlotAt = Number.isFinite(player.nextSkillSlotAt) ? player.nextSkillSlotAt : 0;
      if (now < nextSkillSlotAt) {
        const rejection: RequestUseSkillSlotRejectedServerMessage = {
          ...rejectionBase,
          reason: "skill_on_cooldown",
        };
        try { client.send(rejection.type, rejection); } catch {}
        return;
      }

      // Task 217/219 — Grave Spark target validation.
      const targetEnemyId = typeof message?.targetEnemyId === "string" && message.targetEnemyId.length > 0
        ? message.targetEnemyId
        : undefined;

      if (targetEnemyId === undefined) {
        const rejection: RequestUseSkillSlotRejectedServerMessage = {
          ...rejectionBase,
          reason: "skill_unavailable",
        };
        try { client.send(rejection.type, rejection); } catch {}
        return;
      }

      const enemy = state.enemies.get(targetEnemyId);
      if (enemy === undefined) {
        const rejection: RequestUseSkillSlotRejectedServerMessage = {
          ...rejectionBase,
          reason: "enemy_not_found",
        };
        try { client.send(rejection.type, rejection); } catch {}
        return;
      }

      if (enemy.defeated || enemy.hp <= 0) {
        const rejection: RequestUseSkillSlotRejectedServerMessage = {
          ...rejectionBase,
          reason: "enemy_defeated",
        };
        try { client.send(rejection.type, rejection); } catch {}
        return;
      }

      const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (distance > GRAVE_SPARK_RANGE) {
        setPendingAction(player, {
          type: "skill_secondary",
          targetId: enemy.id,
          targetX: enemy.x,
          targetY: enemy.y,
        });
        const approach = resolveApproachTarget(
          player,
          { x: enemy.x, y: enemy.y },
          GRAVE_SPARK_RANGE,
        );
        applyMovementIntent(state, client.sessionId, approach.x, approach.y);
        const queued: DeferredActionQueuedServerMessage = {
          type: "deferred_action_queued",
          actionType: "attack",
          targetId: enemy.id,
          message: "Moving closer.",
        };
        try { client.send("deferred_action_queued", queued); } catch {}
        log.debug?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            targetEnemyId: enemy.id,
          },
          "TownRoom request_use_skill_slot queued as deferred move-to-cast action.",
        );
        return;
      }

      clearPendingAction(player);
      player.nextSkillSlotAt = now + GRAVE_SPARK_COOLDOWN_MS;

      const damageResult = applyEnemyDamage(enemy, GRAVE_SPARK_DAMAGE);

      if (damageResult.defeated) {
        spawnWorldLootOnEnemyDefeat(state, enemy, now);
        // Task 333B — Objective progress increment (single-objective
        // foundation only). Same approach as the basic attack handler.
        const progressResult = advanceObjectiveProgress(player, enemy.enemyId, (updated) => {
          void new ObjectiveRepository().updateProgress(
            updated.characterId.toString(),
            updated.objectiveId,
            updated.currentProgress,
          ).catch(() => {});
        });
        if (progressResult !== undefined) {
          const progressUpdate: ObjectiveUpdatedServerMessage = {
            type: "objective_updated",
            objectiveId: progressResult.objectiveId,
            label: progressResult.label,
            descriptionKey: progressResult.descriptionKey,
            current: progressResult.current,
            target: progressResult.target,
            completed: progressResult.completed,
          };
          try { client.send("objective_updated", progressUpdate); } catch {}
        }
        void grantEnemyDefeatXp(player, enemy.enemyId, (type, payload) => {
          try { client.send(type, payload); } catch {}
        }).catch(() => {});
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
      try { client.send(accepted.type, accepted); } catch {}

      log.debug?.(
        {
          roomId: this.roomId,
          roomName: this.roomName,
          sessionId: client.sessionId,
          targetEnemyId: enemy.id,
          remainingHp: damageResult.remainingHp,
          appliedDamage: damageResult.appliedDamage,
          defeated: damageResult.defeated,
          respawnAtMs: damageResult.respawnAtMs,
          nextSkillSlotAt: player.nextSkillSlotAt,
        },
        "TownRoom request_use_skill_slot accepted: Grave Spark hit target.",
      );
    });
  }

  /**
   * Task 319 — Register the `request_buy_vendor_item` message handler.
   *
   * Validates vendor existence, stock membership, price, player
   * currency and inventory space, then atomically deducts copper
   * and creates the inventory item. Sends accepted/rejected
   * feedback to the originating client.
   */
  private registerVendorBuyHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.vendorBuyHandlerRegistered) {
      return;
    }
    this.vendorBuyHandlerRegistered = true;

    this.onMessage("request_buy_vendor_item", async (client: Client, raw: unknown) => {
      const state = this.state as TownRoomState;
      const message = raw as { vendorId?: string; stockEntryId?: string } | null;

      if (
        !message ||
        typeof message.vendorId !== "string" ||
        typeof message.stockEntryId !== "string"
      ) {
        log.warn?.(
          { roomId: this.roomId, roomName: this.roomName, sessionId: client.sessionId },
          "TownRoom request_buy_vendor_item rejected: invalid shape.",
        );
        return;
      }

      const player = state.playerPresence.get(client.sessionId);
      if (player === undefined || player.lifeState !== "alive") {
        try {
          client.send("request_buy_vendor_item_rejected", {
            type: "request_buy_vendor_item_rejected",
            reason: "vendor_unavailable",
          });
        } catch {}
        log.warn?.(
          { roomId: this.roomId, roomName: this.roomName, sessionId: client.sessionId },
          "TownRoom request_buy_vendor_item rejected: player not found or downed.",
        );
        return;
      }

      const result = await executeVendorBuyItem({
        characterId: player.characterId,
        vendorId: message.vendorId,
        stockEntryId: message.stockEntryId,
      });

      if (result.ok) {
        const accepted: import("@doomscrolls/shared").RequestBuyVendorItemAcceptedServerMessage = {
          type: "request_buy_vendor_item_accepted",
          stockEntryId: result.stockEntryId,
          itemId: result.itemId,
          priceCopper: result.priceCopper,
          remainingCopper: result.remainingCopper,
        };
        try { client.send("request_buy_vendor_item_accepted", accepted); } catch {}

        // Also send a currency_picked_up message so the client can
        // update the HUD money display without waiting for /me.
        try {
          client.send("currency_picked_up", {
            type: "currency_picked_up",
            characterId: player.characterId,
            gainedCopper: 0,
            totalMoneyCopper: result.remainingCopper,
          });
        } catch {}

        log.debug?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            stockEntryId: result.stockEntryId,
            itemId: result.itemId,
            priceCopper: result.priceCopper,
            remainingCopper: result.remainingCopper,
          },
          "TownRoom request_buy_vendor_item accepted: item purchased.",
        );
      } else {
        try {
          client.send("request_buy_vendor_item_rejected", {
            type: "request_buy_vendor_item_rejected",
            reason: result.reason,
            stockEntryId: message.stockEntryId,
          });
        } catch {}

        log.debug?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            reason: result.reason,
          },
          "TownRoom request_buy_vendor_item rejected.",
        );
      }
    });
  }

  /**
   * Task 320 — Register the `request_sell_item` message handler.
   *
   * Validates vendor existence, item ownership, equipment state,
   * sellability and price, then atomically deletes the item and
   * awards copper. Sends accepted/rejected feedback to the
   * originating client.
   */
  private registerVendorSellHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.vendorSellHandlerRegistered) {
      return;
    }
    this.vendorSellHandlerRegistered = true;

    this.onMessage("request_sell_item", async (client: Client, raw: unknown) => {
      const state = this.state as TownRoomState;
      const message = raw as { vendorId?: string; itemInstanceId?: string } | null;

      if (
        !message ||
        typeof message.vendorId !== "string" ||
        typeof message.itemInstanceId !== "string"
      ) {
        log.warn?.(
          { roomId: this.roomId, roomName: this.roomName, sessionId: client.sessionId },
          "TownRoom request_sell_item rejected: invalid shape.",
        );
        return;
      }

      const player = state.playerPresence.get(client.sessionId);
      if (player === undefined || player.lifeState !== "alive") {
        try {
          client.send("request_sell_item_rejected", {
            type: "request_sell_item_rejected",
            reason: "vendor_unavailable",
          });
        } catch {}
        log.warn?.(
          { roomId: this.roomId, roomName: this.roomName, sessionId: client.sessionId },
          "TownRoom request_sell_item rejected: player not found or downed.",
        );
        return;
      }

      const result = await executeVendorSellItem({
        characterId: player.characterId,
        vendorId: message.vendorId,
        itemInstanceId: message.itemInstanceId,
      });

      if (result.ok) {
        const accepted: import("@doomscrolls/shared").RequestSellItemAcceptedServerMessage = {
          type: "request_sell_item_accepted",
          itemInstanceId: result.itemInstanceId,
          definitionId: result.definitionId,
          sellPriceCopper: result.sellPriceCopper,
          remainingCopper: result.remainingCopper,
        };
        try { client.send("request_sell_item_accepted", accepted); } catch {}

        // Also send a currency_picked_up message so the client can
        // update the HUD money display without waiting for /me.
        try {
          client.send("currency_picked_up", {
            type: "currency_picked_up",
            characterId: player.characterId,
            gainedCopper: result.sellPriceCopper,
            totalMoneyCopper: result.remainingCopper,
          });
        } catch {}

        log.debug?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            itemInstanceId: result.itemInstanceId,
            definitionId: result.definitionId,
            sellPriceCopper: result.sellPriceCopper,
            remainingCopper: result.remainingCopper,
          },
          "TownRoom request_sell_item accepted: item sold.",
        );
      } else {
        try {
          client.send("request_sell_item_rejected", {
            type: "request_sell_item_rejected",
            reason: result.reason,
            itemInstanceId: message.itemInstanceId,
          });
        } catch {}

        log.debug?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            reason: result.reason,
          },
          "TownRoom request_sell_item rejected.",
        );
      }
    });
  }

  private registerStashTransferHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.stashTransferHandlerRegistered) {
      return;
    }
    this.stashTransferHandlerRegistered = true;

    this.onMessage("request_store_inventory_item_in_stash", async (client: Client, raw: unknown) => {
      const state = this.state as TownRoomState;
      const player = state.playerPresence.get(client.sessionId);
      const message = raw as {
        serviceId?: unknown;
        itemInstanceId?: unknown;
        pageIndex?: unknown;
        x?: unknown;
        y?: unknown;
      } | null;

      if (
        message === null ||
        typeof message !== "object" ||
        typeof message.serviceId !== "string" ||
        typeof message.itemInstanceId !== "string"
      ) {
        try {
          client.send("request_store_inventory_item_in_stash_rejected", {
            type: "request_store_inventory_item_in_stash_rejected",
            serviceId: "nightmarket_stash_keeper",
            reason: "stash_unavailable",
          });
        } catch {}
        return;
      }

      if (player === undefined || player.lifeState !== "alive") {
        try {
          client.send("request_store_inventory_item_in_stash_rejected", {
            type: "request_store_inventory_item_in_stash_rejected",
            serviceId: message.serviceId,
            itemInstanceId: message.itemInstanceId,
            reason: "stash_unavailable",
          });
        } catch {}
        return;
      }

      const result = await executeStoreInventoryItemInStash({
        characterId: player.characterId.toString(),
        serviceId: message.serviceId,
        itemInstanceId: message.itemInstanceId,
        ...(typeof message.pageIndex === "number" ? { pageIndex: message.pageIndex } : {}),
        ...(typeof message.x === "number" ? { x: message.x } : {}),
        ...(typeof message.y === "number" ? { y: message.y } : {}),
      });

      if (result.ok) {
        try {
          client.send("request_store_inventory_item_in_stash_accepted", {
            type: "request_store_inventory_item_in_stash_accepted",
            serviceId: message.serviceId,
            itemInstanceId: result.itemInstanceId,
            stashItems: result.stashItems,
          });
        } catch {}
        return;
      }

      log.debug?.({ roomId: this.roomId, roomName: this.roomName, sessionId: client.sessionId, reason: result.reason }, "TownRoom request_store_inventory_item_in_stash rejected.");
      try {
        client.send("request_store_inventory_item_in_stash_rejected", {
          type: "request_store_inventory_item_in_stash_rejected",
          serviceId: message.serviceId,
          itemInstanceId: message.itemInstanceId,
          reason: result.reason,
        });
      } catch {}
    });

    this.onMessage("request_take_stash_item_to_inventory", async (client: Client, raw: unknown) => {
      const state = this.state as TownRoomState;
      const player = state.playerPresence.get(client.sessionId);
      const message = raw as { serviceId?: unknown; itemInstanceId?: unknown } | null;

      if (
        message === null ||
        typeof message !== "object" ||
        typeof message.serviceId !== "string" ||
        typeof message.itemInstanceId !== "string"
      ) {
        try {
          client.send("request_take_stash_item_to_inventory_rejected", {
            type: "request_take_stash_item_to_inventory_rejected",
            serviceId: "nightmarket_stash_keeper",
            reason: "stash_unavailable",
          });
        } catch {}
        return;
      }

      if (player === undefined || player.lifeState !== "alive") {
        try {
          client.send("request_take_stash_item_to_inventory_rejected", {
            type: "request_take_stash_item_to_inventory_rejected",
            serviceId: message.serviceId,
            itemInstanceId: message.itemInstanceId,
            reason: "stash_unavailable",
          });
        } catch {}
        return;
      }

      const result = await executeTakeStashItemToInventory({
        characterId: player.characterId.toString(),
        serviceId: message.serviceId,
        itemInstanceId: message.itemInstanceId,
      });

      if (result.ok) {
        try {
          client.send("request_take_stash_item_to_inventory_accepted", {
            type: "request_take_stash_item_to_inventory_accepted",
            serviceId: message.serviceId,
            itemInstanceId: result.itemInstanceId,
            stashItems: result.stashItems,
          });
        } catch {}
        return;
      }

      log.debug?.({ roomId: this.roomId, roomName: this.roomName, sessionId: client.sessionId, reason: result.reason }, "TownRoom request_take_stash_item_to_inventory rejected.");
      try {
        client.send("request_take_stash_item_to_inventory_rejected", {
          type: "request_take_stash_item_to_inventory_rejected",
          serviceId: message.serviceId,
          itemInstanceId: message.itemInstanceId,
          reason: result.reason,
        });
      } catch {}
    });
  }

  /**
   * Task 348 — Register the `request_start_board_objective` message handler.
   *
   * Validates the requested objective ID, checks the player has no
   * active objective, and starts the selected objective including
   * DB persistence. Sends the objective_updated confirmation or a
   * safe rejection reason.
   */
  private registerStartBoardObjectiveHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.startBoardObjectiveHandlerRegistered) {
      return;
    }
    this.startBoardObjectiveHandlerRegistered = true;

    this.onMessage("request_start_board_objective", async (client: Client, raw: unknown) => {
      const state = this.state as TownRoomState;
      const player = state.playerPresence.get(client.sessionId);
      if (player === undefined) {
        return;
      }

      const message = raw as { objectiveId?: unknown } | null;
      if (!message || typeof message.objectiveId !== "string" || message.objectiveId.length === 0) {
        try {
          client.send("request_start_board_objective_rejected", {
            type: "request_start_board_objective_rejected",
            reason: "invalid_request",
          });
        } catch {}
        return;
      }

      // Already has an active objective
      if (player.hasObjective) {
        try {
          client.send("request_start_board_objective_rejected", {
            type: "request_start_board_objective_rejected",
            reason: "already_has_active_objective",
          });
        } catch {}
        return;
      }

      // Objective must exist in content registry
      const objectiveDef = contentRegistry.objectives.get(message.objectiveId as ObjectiveId);
      if (objectiveDef === undefined) {
        try {
          client.send("request_start_board_objective_rejected", {
            type: "request_start_board_objective_rejected",
            reason: "objective_not_found",
          });
        } catch {}
        return;
      }

      // Objective must be in the notice board sequence
      if (!NOTICE_BOARD_OBJECTIVE_SEQUENCE.includes(message.objectiveId)) {
        try {
          client.send("request_start_board_objective_rejected", {
            type: "request_start_board_objective_rejected",
            reason: "objective_not_available",
          });
        } catch {}
        return;
      }

      if (isObjectiveStartBlockedByCompletion(player, objectiveDef)) {
        try {
          client.send("request_start_board_objective_rejected", {
            type: "request_start_board_objective_rejected",
            reason: "objective_already_completed",
          });
        } catch {}
        return;
      }

      const availableObjectiveIds = buildAvailableNoticeBoardObjectives(player).map((entry) => entry.objectiveId);
      if (!availableObjectiveIds.includes(objectiveDef.id)) {
        try {
          client.send("request_start_board_objective_rejected", {
            type: "request_start_board_objective_rejected",
            reason: "objective_not_available",
          });
        } catch {}
        return;
      }

      // Start the objective in server state
      const updated = startNoticeBoardObjective(player, objectiveDef);

      // Persist to DB
      try {
        await new ObjectiveRepository().create(player.characterId.toString(), objectiveDef.id, objectiveDef.requiredKills);
      } catch {
        // Persistence failed — revert server state
        resetNoticeBoardObjective(player);
        try {
          client.send("request_start_board_objective_rejected", {
            type: "request_start_board_objective_rejected",
            reason: "invalid_request",
          });
        } catch {}
        return;
      }

      // Send objective confirmation to client
      try {
        client.send("objective_updated", updated);
      } catch {}

      log.debug?.(
        { roomId: this.roomId, roomName: this.roomName, sessionId: client.sessionId, characterId: player.characterId, objectiveId: objectiveDef.id },
        "TownRoom request_start_board_objective accepted: objective started.",
      );
    });
  }

  private applyEnemyAggroDamage(now: number, deltaMs: number): void {
    const state = this.state as TownRoomState;

    state.enemies.forEach((enemy) => {
      const enemyDefinition = contentRegistry.enemies.get(enemy.enemyId as ContentEnemyId);
      // Task 227 -- enemy `moveSpeed` is authored in the same per-second
      // stat space as the player's derived `moveSpeed` (see
      // resolvePlayerMovementSpeed). The runtime world-units-per-second
      // value must be scaled by ENEMY_MOVEMENT_SPEED_UNITS_PER_SECOND_MULTIPLIER
      // the same way the player speed is, otherwise the enemy moves at
      // <1 wu/sec and can never catch a player running at 200+ wu/sec.
      const enemyMoveSpeed = (enemyDefinition?.moveSpeed ?? 0) * ENEMY_MOVEMENT_SPEED_UNITS_PER_SECOND_MULTIPLIER;
      const enemyAggroRange = toWorldUnits(enemyDefinition?.aggroRange ?? 0, 120);
      const enemyLeashRange = toWorldUnits(enemyDefinition?.leashRange ?? 0, 180);
      const enemyAttackCooldownMs = enemyDefinition?.attackCooldownMs ?? 1200;
      const enemyAttackDamage = enemyDefinition?.damage ?? 2;
      // Task 264 -- Brute heavy attack config. Read once per enemy tick
      // so the heavy windup, damage, chance and cooldown come from the
      // existing content fields, not from any hardcoded values. Heavy
      // attack is only eligible when *all* of the fields are present
      // and finite; otherwise the enemy is treated as a normal-only
      // attacker (preserves the existing Runt / Skitter behaviour).
      const heavyWindupMs = enemyDefinition?.heavyAttackWindupMs ?? 0;
      const heavyDamage = enemyDefinition?.heavyAttackDamage ?? 0;
      const heavyCooldownMs = enemyDefinition?.heavyAttackCooldownMs ?? 0;
      const heavyChance = enemyDefinition?.heavyAttackChance ?? 0;
      const heavyAttackEligible =
        Number.isFinite(heavyWindupMs) && heavyWindupMs > 0 &&
        Number.isFinite(heavyDamage) && heavyDamage > 0 &&
        Number.isFinite(heavyCooldownMs) && heavyCooldownMs > 0 &&
        Number.isFinite(heavyChance) && heavyChance > 0;
      const distanceFromSpawn = Math.hypot(enemy.x - enemy.spawnX, enemy.y - enemy.spawnY);

      if (enemy.defeated || enemy.hp <= 0) {
        enemy.state = "defeated";
        enemy.targetPlayerSessionId = "";
        enemy.nextAttackAtMs = 0;
        return;
      }

      const currentTargetSessionId =
        typeof enemy.targetPlayerSessionId === "string" ? enemy.targetPlayerSessionId : "";

      if (currentTargetSessionId.length > 0) {
        const currentTarget = state.playerPresence.get(currentTargetSessionId);
        if (currentTarget === undefined || currentTarget.hp <= 0) {
          clearEnemyTargetAndReturn(enemy);
        } else {
          const targetDistance = Math.hypot(enemy.x - currentTarget.x, enemy.y - currentTarget.y);
          if (targetDistance > enemyAggroRange || distanceFromSpawn > enemyLeashRange) {
            clearEnemyTargetAndReturn(enemy);
          }
        }
      }

      if (enemy.targetPlayerSessionId.length === 0 && enemy.state === "returning") {
        moveEnemyTowardPoint(
          enemy,
          { x: enemy.spawnX, y: enemy.spawnY },
          enemyMoveSpeed,
          deltaMs,
        );

        const remainingDistanceToSpawn = Math.hypot(enemy.x - enemy.spawnX, enemy.y - enemy.spawnY);
        if (remainingDistanceToSpawn <= ENEMY_RETURN_ARRIVAL_DISTANCE) {
          resetEnemyCombatState(enemy);
          enemy.x = enemy.spawnX;
          enemy.y = enemy.spawnY;
        }
        return;
      }

      let closestPlayerSessionId: string | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;

      state.playerPresence.forEach((player, sessionId) => {
        if (player.hp <= 0) {
          return;
        }

        const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPlayerSessionId = sessionId;
        }
      });

      if (enemy.targetPlayerSessionId.length === 0) {
        const canReacquireWhileReturning = enemy.state !== "returning"
          || distanceFromSpawn <= ENEMY_RETURN_REACQUIRE_BUFFER;
        if (
          closestPlayerSessionId === null
          || closestDistance > enemyAggroRange
          || !canReacquireWhileReturning
        ) {
          enemy.state = "idle";
          // Task 107 — idle enemies wander near their spawn point
          applyWanderMovement(enemy, enemyMoveSpeed, deltaMs, now);
          return;
        }

        enemy.targetPlayerSessionId = closestPlayerSessionId;
      }

      const targetPlayer = state.playerPresence.get(enemy.targetPlayerSessionId);
      if (targetPlayer === undefined || targetPlayer.hp <= 0) {
        clearEnemyTargetAndReturn(enemy);
        return;
      }

      const targetDistance = Math.hypot(enemy.x - targetPlayer.x, enemy.y - targetPlayer.y);
      if (targetDistance > enemyAggroRange || distanceFromSpawn > enemyLeashRange) {
        clearEnemyTargetAndReturn(enemy);
        return;
      }

      enemy.state = "chasing";
      moveEnemyTowardTarget(
        enemy,
        targetPlayer,
        enemyMoveSpeed,
        deltaMs,
      );

      const distanceAfterMovement = Math.hypot(enemy.x - targetPlayer.x, enemy.y - targetPlayer.y);

      if (distanceAfterMovement > ENEMY_ATTACK_RANGE) {
        return;
      }

      // Task 094 -- Server-owned attack telegraph. Two phases:
      // (1) telegraph + windup: when the enemy is in attack range,
      // the cooldown has elapsed and no attack is currently
      // mid-windup, the server sends `enemy_attack_telegraph` to the
      // target client and stores the landing time on the enemy.
      // (2) landing: once the windup elapses and the target is still
      // alive and in attack range, the actual damage is applied and
      // the existing `damage_applied` message is sent. The client
      // never decides when damage lands.

      if (enemy.attackLandingAtMs > 0) {
        if (now < enemy.attackLandingAtMs) {
          // Windup not yet elapsed; nothing to do this tick.
          return;
        }
        // Windup elapsed. Validate that the target is still alive
        // and still in attack range; only then apply damage.
        const landingTarget = state.playerPresence.get(enemy.targetPlayerSessionId);
        const landingClient = landingTarget === undefined
          ? undefined
          : this.clients.find((client) => client.sessionId === landingTarget.sessionId);
        if (
          landingTarget === undefined ||
          landingTarget.hp <= 0 ||
          Math.hypot(enemy.x - landingTarget.x, enemy.y - landingTarget.y) > ENEMY_ATTACK_RANGE
        ) {
          // Target moved out of range or died during the windup:
          // Target left range before windup completion, so the
          // telegraphed hit resolves to a server-authoritative miss.
          // Task 264 -- the miss outcome respects the original attack
          // kind: a heavy attack that misses still consumes the heavy
          // cooldown (heavier swing, longer recovery) so the enemy
          // cannot immediately chain another heavy swing into a
          // re-acquired target.
          const missedKind = enemy.attackKind === "heavy" && heavyAttackEligible
            ? "heavy"
            : "normal";
          enemy.attackLandingAtMs = 0;
          enemy.nextAttackAtMs = now + (missedKind === "heavy" ? heavyCooldownMs : enemyAttackCooldownMs);
          if (missedKind === "heavy") {
            enemy.nextHeavyAttackAtMs = now + heavyCooldownMs;
          }
          if (landingClient !== undefined) {
            sendEnemyAttackResolved(landingClient, {
              type: "enemy_attack_resolved",
              enemyId: enemy.id,
              targetEntityId: (landingTarget?.characterId ?? "") as unknown as EntityId,
              outcome: "miss",
              attackKind: missedKind,
            });
          }
          return;
        }

        enemy.attackLandingAtMs = 0;
        // Task 264 -- resolve damage by attack kind. The telegraph kind
        // was decided at windup start and stored on the enemy; we
        // re-validate that the enemy is still heavy-eligible so a
        // respawned enemy without heavy fields cannot inherit a stale
        // "heavy" flag from a previous life.
        const landingKind = enemy.attackKind === "heavy" && heavyAttackEligible
          ? "heavy"
          : "normal";
        const landingDamage = landingKind === "heavy" ? heavyDamage : enemyAttackDamage;
        const landingCooldownMs = landingKind === "heavy" ? heavyCooldownMs : enemyAttackCooldownMs;
        const nextHp = Math.max(0, landingTarget.hp - landingDamage);
        landingTarget.hp = nextHp;
        if (nextHp <= 0) {
          landingTarget.lifeState = "downed";
          landingTarget.hasMovementTarget = false;
          landingTarget.targetX = landingTarget.x;
          landingTarget.targetY = landingTarget.y;
          landingTarget.hasCorpse = true;
          landingTarget.corpseX = landingTarget.x;
          landingTarget.corpseY = landingTarget.y;
          clearPendingAction(landingTarget);
          clearEnemyTargetAndReturn(enemy);
        } else {
          // Task 264 -- heavy hits still consume the heavy cooldown
          // (a successful Brute smash is a long-recovery swing).
          enemy.nextAttackAtMs = now + landingCooldownMs;
          if (landingKind === "heavy") {
            enemy.nextHeavyAttackAtMs = now + heavyCooldownMs;
          }
        }

        if (landingClient !== undefined) {
          const damageMessage: DamageAppliedServerMessage = {
            type: "damage_applied",
            targetEntityId: landingTarget.characterId as unknown as EntityId,
            sourceEntityId: enemy.id as unknown as EntityId,
            damage: landingDamage,
            remainingHp: nextHp,
          };

          try {
            landingClient.send("damage_applied", damageMessage);
          } catch {
            // keep room state authoritative even if send fails
          }
          sendEnemyAttackResolved(landingClient, {
            type: "enemy_attack_resolved",
            enemyId: enemy.id,
            targetEntityId: landingTarget.characterId as unknown as EntityId,
            outcome: "hit",
            attackKind: landingKind,
            damage: landingDamage,
            remainingHp: nextHp,
          });
        }
        return;
      }

      if (now < enemy.nextAttackAtMs) {
        return;
      }

      // Task 264 -- pick the attack kind for this telegraph. The
      // choice is server-authoritative: normal is always allowed; a
      // heavy attack requires all four heavy content fields to be
      // present, the heavy cooldown to have elapsed, and a successful
      // chance roll. If heavy is not picked, the enemy falls back to
      // its regular normal swing using the existing windup / cooldown.
      let attackKind: "normal" | "heavy" = "normal";
      let chosenWindupMs = ENEMY_ATTACK_WINDUP_MS;
      let chosenCooldownMs = enemyAttackCooldownMs;
      if (
        heavyAttackEligible
        && (enemy.nextHeavyAttackAtMs === 0 || now >= enemy.nextHeavyAttackAtMs)
        && Math.random() < heavyChance
      ) {
        attackKind = "heavy";
        chosenWindupMs = heavyWindupMs;
        chosenCooldownMs = heavyCooldownMs;
      }

      // Start a new telegraph + windup. Damage will only be applied
      // after `chosenWindupMs` on a future tick.
      enemy.attackKind = attackKind;
      enemy.attackLandingAtMs = now + chosenWindupMs;
      enemy.nextAttackAtMs = enemy.attackLandingAtMs + chosenCooldownMs;
      if (attackKind === "heavy") {
        enemy.nextHeavyAttackAtMs = now + heavyCooldownMs;
      }

      const telegraphClient = this.clients.find(
        (client) => client.sessionId === targetPlayer.sessionId,
      );
      if (telegraphClient !== undefined) {
        sendEnemyAttackTelegraph(
          telegraphClient,
          enemy.id,
          targetPlayer.characterId,
          chosenWindupMs,
          attackKind,
        );
      }
    });
  }
}














