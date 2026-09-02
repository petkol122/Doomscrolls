import { Room, Client } from "colyseus";
import {
  type CharacterId,
  type EnemyAttackResolvedServerMessage,
  type EntityId,
  type EnemyAttackTelegraphServerMessage,
  type RequestAttackAcceptedServerMessage,
  type RequestAttackClientMessage,
  type RequestAttackRejectedServerMessage,
  type RequestMoveRejectedServerMessage,
  type RequestPickupWorldLootAcceptedServerMessage,
  type RequestPickupWorldLootClientMessage,
  type RequestPickupWorldLootRejectedServerMessage,
  type RequestDodgeAcceptedServerMessage,
  type RequestDodgeRejectedServerMessage,
  type RequestUseHealingFlaskAcceptedServerMessage,
  type RequestUseHealingFlaskRejectedServerMessage,
  type XpGainedServerMessage,
  type UserId,
  type ZoneId,
} from "@doomscrolls/shared";
import { RoomJoinValidationService } from "../RoomJoinValidationService";
import type { CombatRoomJoinOptions } from "./combatRoomTypes";
import { CombatRoomState } from "./CombatRoomState";
import { createRoomLogger } from "./roomLogger";
import { buildCombatPlayerPresence } from "./buildCombatPlayerPresence";
import { initializeCombatEnemies } from "./initializeCombatEnemies";
import { validateMovementIntent } from "./movementIntentValidation";
import { applyMovementIntent } from "./applyMovementIntent";
import { resolvePlayerMovementSpeed } from "./resolvePlayerMovementSpeed";
import { resolvePlayerDamage } from "./resolvePlayerDamage";
import { resolvePlayerArmor } from "./resolvePlayerArmor";
import { mitigateIncomingDamage } from "./incomingDamageMitigation";
import { resolveAttackCooldownMs } from "./attackCooldown";
import { stepTownRoomMovement, TOWN_MOVEMENT_TICK_RATE_MS } from "./stepTownRoomMovement";
import { validateAttackIntent } from "./attackIntentValidation";
import { consumeAttackCooldown } from "./attackCooldown";
import { applyEnemyDamage } from "./applyEnemyDamage";
import { restoreFlaskToFull } from "./healingFlaskConfig";
import { validateDodgeIntent } from "./dodgeIntentValidation";
import { applyDodgeIntent } from "./applyDodgeIntent";
import { consumeDodgeCooldown, isDodgeReady } from "./dodgeCooldown";
import { validateHealingFlaskIntent } from "./healingFlaskValidation";
import { applyHealingFlaskIntent } from "./applyHealingFlaskIntent";
import type { TownRoomState } from "./TownRoomState";
import { clearPendingAction, setPendingAction } from "./pendingActionState";
import {
  ENEMY_ATTACK_RANGE,
  clearEnemyTargetAndReturn,
  moveEnemyTowardTarget,
} from "./enemyAiHelpers";
import { contentRegistry } from "@doomscrolls/content";
import { CharacterService } from "../../character/CharacterService";
import { contentRegistry as roomContentRegistry } from "@doomscrolls/content";
import { isPositionInsideZoneBounds } from "./validateCharacterLocation";
import { initializeCombatInteractables } from "./initializeCombatInteractables";
import { CharacterRepository, ItemRepository, ObjectiveRepository } from "../../persistence/repositories";
import { NOTICE_BOARD_OBJECTIVE_SEQUENCE } from "@doomscrolls/content";
import { spawnWorldLootOnEnemyDefeat } from "./spawnWorldLootOnEnemyDefeat";
import { dispatchPickedUpWorldLoot } from "./pickupWorldLootDispatcher";
import { validatePickupWorldLootIntent } from "./pickupWorldLootValidation";
import { tryResolveLevelProgression } from "./levelProgression";
import { CharacterStatsService } from "../../character/CharacterStatsService";
import { advanceObjectiveProgressAllSlots } from "./advanceObjectiveProgress";
import { resolveCombatZoneReturnSpawnId } from "./waypointService";
import {
  getSkillSlotCooldownAt,
  resolveSkillCastDamage,
  resolveSkillSlotDefinition,
  setSkillSlotCooldownAt,
} from "./skillSlotContent";
import type {
  RequestUseSkillSlotAcceptedServerMessage,
  RequestUseSkillSlotClientMessage,
  RequestUseSkillSlotRejectedServerMessage,
} from "@doomscrolls/shared";

const characterStatsService = new CharacterStatsService();

// Task 227 -- enemy movement speed is authored in the same per-second
// stat space as the player's derived `moveSpeed`. The runtime
// world-units-per-second value must be scaled by this constant the
// same way the player speed is, otherwise the enemy moves at
// <1 wu/sec and can never catch a player running at 200+ wu/sec.
const ENEMY_MOVEMENT_SPEED_UNITS_PER_SECOND_MULTIPLIER = 220;
// Task 306: reduced from 350 ms to 300 ms to match TownRoom tuning
const ENEMY_ATTACK_WINDUP_MS = 300;

type ContentEnemyId = Parameters<typeof contentRegistry.enemies.get>[0];

type ProgressionUpdateResult =
  | { readonly ok: true; readonly maxHp: number; readonly hp: number; readonly gainedMaxHp: number }
  | { readonly ok: false };

async function applyProgressionUpdate(
  player: { characterId: CharacterId; xp: number; level: number; maxHp?: number; hp?: number; damage?: number; armor?: number },
  progression: { readonly xp: number; readonly level: number; readonly leveledUp: boolean },
): Promise<ProgressionUpdateResult> {
  const characterRepository = new CharacterRepository();
  const character = await characterRepository.findProgressionContext(player.characterId);
  if (character === null) {
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
  } catch {
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
  if ("damage" in player) {
    player.damage = recalculated.derived.damage;
  }
  if ("armor" in player) {
    player.armor = recalculated.derived.armor;
  }

  return { ok: true, maxHp: nextMaxHp, hp: nextHp, gainedMaxHp };
}

async function grantFlatXpReward(
  player: { characterId: CharacterId; xp: number; level: number; maxHp?: number; hp?: number },
  xpReward: number,
  sendToClient: (type: string, payload: unknown) => void,
): Promise<void> {
  if (!Number.isFinite(xpReward) || xpReward <= 0) {
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

async function grantEnemyDefeatXp(
  player: { characterId: CharacterId; xp: number; level: number; maxHp?: number; hp?: number },
  enemyId: string,
  sendToClient: (type: string, payload: unknown) => void,
): Promise<void> {
  const enemyDefinition = contentRegistry.enemies.get(enemyId as ContentEnemyId);
  if (enemyDefinition === undefined || !Number.isFinite(enemyDefinition.xp) || enemyDefinition.xp <= 0) {
    return;
  }

  await grantFlatXpReward(player, enemyDefinition.xp, sendToClient);
}

function toWorldUnits(contentUnits: number, fallback: number): number {
  if (!Number.isFinite(contentUnits) || contentUnits <= 0) {
    return fallback;
  }
  return contentUnits * 24;
}

/**
 * Send `enemy_attack_telegraph` to the target client. The client
 * only uses this for transient visual warning markers; damage
 * outcome is decided by the server.
 */
function sendEnemyAttackTelegraph(
  targetClient: Client,
  enemyId: string,
  targetCharacterId: string,
  windupMs: number,
): void {
  const telegraph: EnemyAttackTelegraphServerMessage = {
    type: "enemy_attack_telegraph",
    enemyId,
    targetEntityId: targetCharacterId as unknown as EntityId,
    windupMs,
    attackKind: "normal",
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

/**
 * CombatRoom with minimal real combat wiring.
 *
 * Task 263 scope: thin Colyseus shell registered as the `combat`
 * room kind with only the identity / presence slice.
 *
 * Task 268 (CombatRoom minimal real combat wiring) scope:
 *  - Extended `CombatRoomState` to include an `enemies` MapSchema
 *    (same `EnemyPresence` schema `TownRoom` uses).
 *  - On `onCreate`, initialize a small fixed combat enemy set via
 *    `initializeCombatEnemies` (3 × Trashboar Runt, deterministic
 *    layout, content-driven stats).
 *  - Register a `request_move` handler that reuses the existing
 *    `validateMovementIntent` + `applyMovementIntent` helpers
 *    (the same gate `TownRoom` uses for the same intent type).
 *  - Register a `request_attack` handler that reuses the existing
 *    `validateAttackIntent` + `consumeAttackCooldown` +
 *    `applyEnemyDamage` helpers (the same gate `TownRoom` uses).
 *  - Register a `setSimulationInterval` that runs the existing
 *    `stepTownRoomMovement` helper (state shape is identical) and
 *    a small local enemy aggro / damage tick that uses the
 *    extracted `enemyAiHelpers` primitives. Enemy respawn uses
 *    the same 5 s cooldown and `applyEnemyDamage` respawnAtMs
 *    bookkeeping that `TownRoom` uses. A minimal `request_respawn`
 *    handler keeps the player alive after defeat so the combat
 *    loop can be re-entered without leaving the room.
 *  - `onLeave` persists the latest HP / location / flask state
 *    through the same `CharacterService` call `TownRoom` uses.
 *
 * Explicitly NOT included (deferred to dedicated tasks, see
 * `docs/BACKLOG_CORE_0_1.md` Task 268 follow-ups):
 *  - loot / XP / objectives on enemy defeat
 *  - heavy-attack telegraph (Brute-only content)
 *  - corpse / respawn UI flow on the client
 *  - combat spawn point content
 *  - client routing to CombatRoom
 *  - dungeon / matchmaking / party / vendor / stash systems
 *
 * The room file stays a thin Colyseus shell. See
 * `docs/CODING_RULES.md` "Realtime Room File-Size Guard".
 */
export class CombatRoom extends Room {
  public static readonly ROOM_NAME = "combat";

  private movementIntentHandlerRegistered = false;
  private attackHandlerRegistered = false;
  private respawnHandlerRegistered = false;
  private combatReturnHandlerRegistered = false;
  private pickupWorldLootHandlerRegistered = false;
  private skillSlotHandlerRegistered = false;
  private dodgeHandlerRegistered = false;
  private healingFlaskHandlerRegistered = false;

  /**
   * Enemy-kill XP/objective-progress writes are fired without being
   * awaited in the message handler (combat shouldn't block on a DB
   * round-trip to feel responsive) -- but an unawaited write can still
   * be in flight when the room itself closes (zone travel, disconnect,
   * matchmaking routing away from this room). Tearing the room down
   * while one of these is still in flight is the same
   * write-not-awaited-before-teardown shape confirmed as a real
   * mechanism (there, corrupting a native client under test) in
   * docs/PRISMA_WINDOWS_TEARDOWN_CRASH_INVESTIGATION.md §10. This set
   * tracks every such write so `onDispose` can wait for them all to
   * settle before the room finishes closing -- see `trackPendingWrite`.
   */
  private readonly pendingWrites = new Set<Promise<void>>();

  public override async onCreate(options: CombatRoomJoinOptions): Promise<void> {
    const log = createRoomLogger(
      (this as unknown as { logger?: unknown }).logger,
    );

    const zoneId: ZoneId = options.requestedZoneId ?? ("blackwire_sewers" as ZoneId);

    const state = new CombatRoomState(zoneId);
    this.setState(state);

    // Task 268: spawn a small combat enemy set using the existing
    // `EnemyPresence` schema and the existing Trashboar Runt
    // content. The room does not read the TownRoom's spawn-zone
    // content (the Blackwire Sewers zone has none yet); the spawn
    // box lives in `initializeCombatEnemies` and is documented as
    // temporary.
    initializeCombatEnemies(state, zoneId);
    initializeCombatInteractables(state, zoneId);

    this.registerMovementIntentHandler(log);
    this.registerAttackHandler(log);
    this.registerRespawnHandler(log);
    this.registerCombatReturnHandler(log);
     this.registerPickupWorldLootHandler(log);
    this.registerSkillSlotHandler(log);
    this.registerDodgeHandler(log);
    this.registerHealingFlaskHandler(log);

    this.setSimulationInterval((deltaMs: number) => {
      // The CombatRoomState has the same `playerPresence` shape
      // (and the same `enemies` MapSchema) as `TownRoomState`, so
      // the same movement step helper is safe to reuse here
      // without duplicating its body.
      stepTownRoomMovement(
        state as unknown as Parameters<typeof stepTownRoomMovement>[0],
        deltaMs,
        { now: Date.now() },
      );
      this.applyCombatEnemyAggroDamage(Date.now(), deltaMs);
      this.respawnCombatEnemies(state, Date.now());
    }, TOWN_MOVEMENT_TICK_RATE_MS);

    log.info(
      {
        roomId: this.roomId,
        roomName: this.roomName,
        zoneId,
        roomKind: "combat",
        enemyCount: state.enemies.size,
      },
      "CombatRoom created with combat-content wiring (content-driven enemy pockets, defeat XP/loot/objectives, pickup loot, return gate).",
    );
  }

  public override async onJoin(
    _client: Client,
    options?: CombatRoomJoinOptions,
  ): Promise<void> {
    const safeLog = createRoomLogger(
      (this as unknown as { logger?: unknown }).logger,
    );

    if (!options) {
      safeLog.warn?.(
        { roomId: this.roomId, roomName: this.roomName },
        "CombatRoom join rejected: missing join options.",
      );
      throw new Error("missing_join_options");
    }

    const auth = this.normalizeJoinOptions(options);
    if (auth === null) {
      safeLog.warn?.(
        { roomId: this.roomId, roomName: this.roomName },
        "CombatRoom join rejected: invalid join options shape.",
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
          "CombatRoom join rejected: session validation failed.",
        );
        throw new Error("not_authenticated");
      }
    } else {
      resolvedUserId = auth.userId as UserId;
    }

    const validateInput: {
      userId: UserId;
      characterId: CharacterId;
      requestedRoomKind: "combat";
      requestedZoneId?: ZoneId;
    } = {
      userId: resolvedUserId,
      characterId: auth.characterId,
      requestedRoomKind: "combat",
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
        "CombatRoom join rejected by validation service.",
      );
      throw new Error(`room_join_rejected:${result.reason}`);
    }

    const state = this.state as CombatRoomState;
    const sessionId = _client.sessionId;
    const characterId = result.character.id;
    const characterName = result.character.characterName;
    const resolvedZoneId = result.resolvedZoneId;
    // Pre-existing gap found during Core 0.7 verification: this join
    // previously hardcoded hp/maxHp/movementSpeed/attackCooldownMs to 0
    // instead of reading the character's persisted stats (unlike
    // TownRoom.onJoin, which already does this correctly). That left
    // every fresh CombatRoom join permanently "downed" with 0 max HP
    // and unable to move -- silently blocking attack, dodge, and skill
    // casts alike. Mirrors TownRoom.ts's resolution exactly.
    const movementSpeed = resolvePlayerMovementSpeed(result.character);
    const attackCooldownMs = resolveAttackCooldownMs(
      result.character.stats?.derived.attackCooldownMs,
    );
    const maxHp = Math.max(0, result.character.stats?.derived.maxHp ?? 0);
    const currentHp = Math.min(maxHp, Math.max(0, result.character.stats?.currentHp ?? maxHp));
    const damage = resolvePlayerDamage(result.character.stats?.derived.damage);
    const armor = resolvePlayerArmor(result.character.stats?.derived.armor);

    const objectiveRepo = new ObjectiveRepository();
    type PersistedObjectiveState = {
      objectiveId: string;
      currentProgress: number;
      requiredProgress: number;
      completed: boolean;
      rewardGranted: boolean;
    };
    // Core 0.15 -- collect up to two not-yet-reward-granted objectives
    // (one per concurrent slot), mirroring TownRoom's restore loop.
    const persistedObjectiveSlots: PersistedObjectiveState[] = [];
    const completedObjectives = await objectiveRepo.findCompletedByCharacter(characterId.toString());
    for (const candidateId of NOTICE_BOARD_OBJECTIVE_SEQUENCE) {
      if (persistedObjectiveSlots.length >= 2) {
        break;
      }
      const objectiveRow = await objectiveRepo.findByCharacterAndObjective(characterId.toString(), candidateId);
      if (objectiveRow !== null && !objectiveRow.rewardGranted) {
        persistedObjectiveSlots.push({
          objectiveId: objectiveRow.objectiveId,
          currentProgress: objectiveRow.currentProgress,
          requiredProgress: objectiveRow.requiredProgress,
          completed: objectiveRow.completed,
          rewardGranted: objectiveRow.rewardGranted,
        });
      }
    }

    const presence = buildCombatPlayerPresence({
      sessionId,
      characterId,
      displayName: characterName,
      classKey: result.character.classKey,
      level: result.character.level,
      xp: result.character.xp,
      resolvedZoneId,
      hp: currentHp,
      maxHp,
      restoredFlaskCharges: undefined,
      movementSpeed,
      attackCooldownMs,
      damage,
      armor,
      restoredLocationZoneId: result.character.lastLocationZoneId ?? undefined,
      restoredLocationX: result.character.lastLocationX ?? undefined,
      restoredLocationY: result.character.lastLocationY ?? undefined,
      objectiveState: persistedObjectiveSlots[0],
      objectiveState2: persistedObjectiveSlots[1],
      completedObjectives,
    });

    state.playerPresence.set(sessionId, presence);
    state.connectedPlayerCount = state.playerPresence.size;

    safeLog.info?.(
      {
        roomId: this.roomId,
        roomName: this.roomName,
        sessionId,
        userId: result.character.ownerUserId,
        characterId,
        zoneId: resolvedZoneId,
        connectedPlayerCount: state.connectedPlayerCount,
      },
      "CombatRoom join accepted, minimal presence added.",
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
    const state = this.state as CombatRoomState;
    const presence = state.playerPresence.get(_client.sessionId);

    // A `request_combat_return` handoff already persisted the correct
    // destination (nightmarket) position via `updateCharacterRoomIntent`
    // before approving the transition. Persisting here too, using this
    // room's own zoneId and the player's stale in-room x/y, would race
    // that write (the client legitimately calls `room.leave()` once it
    // receives the approval) and could clobber a correct combat-zone
    // position with a mismatched (zoneId, x, y) triple -- the same root
    // cause found and fixed for the reverse direction in TownRoom.onLeave.
    const hasApprovedZoneTransition = presence?.hasPendingAction === true
      && presence.pendingActionType === "zone_transition";

    if (presence !== undefined && !hasApprovedZoneTransition) {
      try {
        const characterService = new CharacterService();
        await characterService.updateCharacterLocation(
          presence.characterId,
          state.zoneId,
          presence.x,
          presence.y,
          Math.max(0, Math.min(presence.maxHp, presence.hp)),
          Math.max(0, Math.min(presence.maxFlaskCharges, Math.floor(presence.flaskCharges))),
        );
      } catch (error: unknown) {
        safeLog.warn?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: _client.sessionId,
            characterId: presence.characterId,
            error: error instanceof Error ? error.message : String(error),
          },
          "CombatRoom failed to persist character location on leave.",
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
   * Registers a fire-and-forget write (XP grant, objective progress)
   * so `onDispose` can wait for it before the room finishes closing.
   * The write is never re-thrown or left as an unhandled rejection --
   * a failure is logged here (loudly, not silently dropped) and the
   * tracked promise still resolves, so `onDispose` never hangs on a
   * write that failed rather than merely being slow.
   */
  private trackPendingWrite(
    promise: Promise<unknown>,
    log: ReturnType<typeof createRoomLogger>,
    description: string,
  ): void {
    const tracked = promise.then(
      () => undefined,
      (error: unknown) => {
        log.error(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            write: description,
            error: error instanceof Error ? error.message : String(error),
          },
          "CombatRoom fire-and-forget write failed.",
        );
      },
    );
    this.pendingWrites.add(tracked);
    void tracked.finally(() => {
      this.pendingWrites.delete(tracked);
    });
  }

  /**
   * Colyseus awaits this before actually removing the room. Waiting
   * for every tracked fire-and-forget write here (rather than letting
   * them get orphaned when the room object goes away) is the fix for
   * the race documented on `pendingWrites` above -- no write from an
   * active room is abandoned mid-flight when that room closes.
   */
  public override async onDispose(): Promise<void> {
    if (this.pendingWrites.size > 0) {
      await Promise.all([...this.pendingWrites]);
    }
  }

  private registerMovementIntentHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.movementIntentHandlerRegistered) {
      return;
    }
    this.movementIntentHandlerRegistered = true;

    this.onMessage("request_move", (client: Client, raw: unknown) => {
      const state = this.state as CombatRoomState;
      const result = validateMovementIntent({ message: raw });

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
        } catch {}
        return;
      }

      // CombatRoom reuses the same `applyMovementIntent` helper as
      // `TownRoom` because the state shape (`playerPresence` keyed
      // by sessionId with the same movement fields) is identical.
      // The cast keeps the helper room-state-agnostic; no new
      // helper body is introduced here.
      applyMovementIntent(
        state as unknown as Parameters<typeof applyMovementIntent>[0],
        client.sessionId,
        result.targetX,
        result.targetY,
      );

      log.debug?.(
        {
          roomId: this.roomId,
          roomName: this.roomName,
          sessionId: client.sessionId,
          targetX: result.targetX,
          targetY: result.targetY,
          clientTime: result.clientTime,
        },
        "CombatRoom request_move accepted and stored as server-authoritative movement target.",
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
      const state = this.state as CombatRoomState;
      const message = raw as Partial<RequestAttackClientMessage> | null;
      const targetEnemyId = typeof message?.targetEnemyId === "string"
        ? message.targetEnemyId
        : undefined;
      const player = state.playerPresence.get(client.sessionId);
      const now = Date.now();
      const validation = validateAttackIntent(
        state as unknown as Parameters<typeof validateAttackIntent>[0],
        player,
        targetEnemyId ?? "",
        now,
      );

      if (!validation.ok) {
        const rejection: RequestAttackRejectedServerMessage = {
          type: "request_attack_rejected",
          reason: validation.reason,
          ...(targetEnemyId !== undefined ? { targetEnemyId } : {}),
        };
        try {
          client.send("request_attack_rejected", rejection);
        } catch {}
        return;
      }

      if (player === undefined) {
        return;
      }

      consumeAttackCooldown(player, now);
      const damageResult = applyEnemyDamage(validation.enemy, player.damage);

      const accepted: RequestAttackAcceptedServerMessage = {
        type: "request_attack_accepted",
        targetEnemyId: validation.enemy.id,
      };
      try {
        client.send("request_attack_accepted", accepted);
      } catch {}

      const spawnedLootList = damageResult.defeated
        ? spawnWorldLootOnEnemyDefeat(state as never, validation.enemy, now)
        : [];

      if (damageResult.defeated) {
        this.trackPendingWrite(
          grantEnemyDefeatXp(player, validation.enemy.enemyId, (type, payload) => {
            try {
              client.send(type, payload);
            } catch {}
          }),
          log,
          "grantEnemyDefeatXp",
        );

        const progressResults = advanceObjectiveProgressAllSlots(player, validation.enemy.enemyId, (updated) => {
          this.trackPendingWrite(
            new ObjectiveRepository().updateProgress(
              updated.characterId.toString(),
              updated.objectiveId,
              updated.currentProgress,
            ),
            log,
            "objectiveProgress.updateProgress",
          );
        });
        for (const progressResult of progressResults) {
          try {
            client.send("objective_updated", {
              type: "objective_updated",
              slot: progressResult.slot,
              objectiveId: progressResult.objectiveId,
              label: progressResult.label,
              descriptionKey: progressResult.descriptionKey,
              current: progressResult.current,
              target: progressResult.target,
              completed: progressResult.completed,
              ...(progressResult.completed ? { readyToTurnIn: true } : {}),
            });
          } catch {}
        }
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
        "CombatRoom request_attack accepted and synced enemy defeat combat rewards/state.",
      );
    });
  }

  /**
   * Core 0.12 -- `request_dodge` handler for CombatRoom.
   *
   * Audit finding: `request_dodge` was previously registered only in
   * TownRoom.ts, so a player could not dodge at all in Blackwire
   * Sewers or Static Yard -- the game's only real combat zones. This
   * is a direct port of TownRoom's handler, reusing the same
   * `validateDodgeIntent`/`applyDodgeIntent`/`isDodgeReady`/
   * `consumeDodgeCooldown` helpers unchanged. `applyDodgeIntent`
   * expects a `TownRoomState`-shaped `state`; `CombatRoomState` has
   * the same `zoneId`/`playerPresence` shape `resolveZoneBounds`
   * actually needs, so it is safe to reuse via the same
   * `as unknown as` cast `registerAttackHandler` above already uses
   * for `validateAttackIntent`.
   */
  private registerDodgeHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.dodgeHandlerRegistered) {
      return;
    }
    this.dodgeHandlerRegistered = true;

    this.onMessage("request_dodge", (client: Client, raw: unknown) => {
      const state = this.state as CombatRoomState;
      const player = state.playerPresence.get(client.sessionId);

      if (player === undefined) {
        log.warn?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
          },
          "CombatRoom request_dodge rejected: player not found.",
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
        } catch {}
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
        } catch {}
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
        } catch {}
        return;
      }

      const applied = applyDodgeIntent({
        state: state as unknown as TownRoomState,
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
      } catch {}

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
        "CombatRoom request_dodge accepted and player position updated.",
      );
    });
  }

  /**
   * Core 0.12 -- `request_use_healing_flask` handler for CombatRoom.
   *
   * Audit finding: `request_use_healing_flask` was previously
   * registered only in TownRoom.ts, so a player could not use their
   * healing flask at all in Blackwire Sewers or Static Yard, despite
   * CombatRoom already tracking and persisting flask charges
   * end-to-end (join restoration, respawn restoration, onLeave
   * persistence). This is a direct port of TownRoom's handler,
   * reusing `validateHealingFlaskIntent`/`applyHealingFlaskIntent`
   * unchanged -- no new heal logic, no itemization wiring (flask
   * heal-amount itemization is explicitly cut from this build; see
   * docs/CORE_BUILD_0_12_PLAN.md).
   */
  private registerHealingFlaskHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.healingFlaskHandlerRegistered) {
      return;
    }
    this.healingFlaskHandlerRegistered = true;

    this.onMessage("request_use_healing_flask", (client: Client, raw: unknown) => {
      const state = this.state as CombatRoomState;
      const player = state.playerPresence.get(client.sessionId);

      if (player === undefined) {
        log.warn?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
          },
          "CombatRoom request_use_healing_flask rejected: player not found.",
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
        } catch {}
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
        } catch {}
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
      } catch {}

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
        "CombatRoom request_use_healing_flask accepted and HP / charges synced.",
      );
    });
  }

  /**
   * Core 0.7 -- `request_use_skill_slot` handler for CombatRoom.
   *
   * Audit finding: `request_use_skill_slot` was previously registered
   * only in TownRoom.ts, so neither skill slot (Grave Spark nor the new
   * Bone Splinter tertiary slot) could be cast in Blackwire Sewers or
   * Static Yard -- the game's only real combat zones. This mirrors
   * `registerAttackHandler` above: an immediate accept/reject with no
   * deferred move-closer queue, matching how basic attack already
   * behaves in CombatRoom (unlike TownRoom, which auto-approaches).
   */
  private registerSkillSlotHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.skillSlotHandlerRegistered) {
      return;
    }
    this.skillSlotHandlerRegistered = true;

    this.onMessage("request_use_skill_slot", (client: Client, raw: unknown) => {
      const state = this.state as CombatRoomState;
      const message = raw as Partial<RequestUseSkillSlotClientMessage> | null;
      const player = state.playerPresence.get(client.sessionId);

      const slot = message?.slot === "primary" || message?.slot === "secondary" || message?.slot === "tertiary"
        ? message.slot
        : undefined;

      if (slot === undefined) {
        const rejection: RequestUseSkillSlotRejectedServerMessage = {
          type: "request_use_skill_slot_rejected",
          slot: "secondary",
          reason: "skill_unavailable",
        };
        try { client.send(rejection.type, rejection); } catch {}
        return;
      }

      const rejectionBase = { type: "request_use_skill_slot_rejected" as const, slot };

      if (player === undefined || player.lifeState !== "alive" || player.hp <= 0) {
        const rejection: RequestUseSkillSlotRejectedServerMessage = {
          ...rejectionBase,
          reason: "player_downed",
        };
        try { client.send(rejection.type, rejection); } catch {}
        return;
      }

      const skillDefinition = resolveSkillSlotDefinition(slot, player.classKey);
      const now = Date.now();
      const nextSkillSlotAt = getSkillSlotCooldownAt(player, slot);
      if (now < nextSkillSlotAt) {
        const rejection: RequestUseSkillSlotRejectedServerMessage = {
          ...rejectionBase,
          reason: "skill_on_cooldown",
        };
        try { client.send(rejection.type, rejection); } catch {}
        return;
      }

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
      if (distance > skillDefinition.range) {
        const rejection: RequestUseSkillSlotRejectedServerMessage = {
          ...rejectionBase,
          reason: "out_of_range",
        };
        try { client.send(rejection.type, rejection); } catch {}
        return;
      }

      setSkillSlotCooldownAt(player, slot, now + skillDefinition.cooldownMs);
      const castDamage = resolveSkillCastDamage(skillDefinition, player.damage);
      const damageResult = applyEnemyDamage(enemy, castDamage);

      const spawnedLootList = damageResult.defeated
        ? spawnWorldLootOnEnemyDefeat(state as never, enemy, now)
        : [];

      if (damageResult.defeated) {
        this.trackPendingWrite(
          grantEnemyDefeatXp(player, enemy.enemyId, (type, payload) => {
            try { client.send(type, payload); } catch {}
          }),
          log,
          "grantEnemyDefeatXp",
        );

        const progressResults = advanceObjectiveProgressAllSlots(player, enemy.enemyId, (updated) => {
          this.trackPendingWrite(
            new ObjectiveRepository().updateProgress(
              updated.characterId.toString(),
              updated.objectiveId,
              updated.currentProgress,
            ),
            log,
            "objectiveProgress.updateProgress",
          );
        });
        for (const progressResult of progressResults) {
          try {
            client.send("objective_updated", {
              type: "objective_updated",
              slot: progressResult.slot,
              objectiveId: progressResult.objectiveId,
              label: progressResult.label,
              descriptionKey: progressResult.descriptionKey,
              current: progressResult.current,
              target: progressResult.target,
              completed: progressResult.completed,
              ...(progressResult.completed ? { readyToTurnIn: true } : {}),
            });
          } catch {}
        }
      }

      const nextReadyAt = getSkillSlotCooldownAt(player, slot);
      const accepted: RequestUseSkillSlotAcceptedServerMessage = {
        type: "request_use_skill_slot_accepted",
        slot,
        targetEnemyId: enemy.id,
        damage: castDamage,
        remainingHp: damageResult.remainingHp,
        defeated: damageResult.defeated,
        nextReadyAt,
      };
      try { client.send(accepted.type, accepted); } catch {}

      log.debug?.(
        {
          roomId: this.roomId,
          roomName: this.roomName,
          sessionId: client.sessionId,
          slot,
          targetEnemyId: enemy.id,
          remainingHp: damageResult.remainingHp,
          appliedDamage: damageResult.appliedDamage,
          defeated: damageResult.defeated,
          respawnAtMs: damageResult.respawnAtMs,
          worldLootCount: spawnedLootList.length,
          nextReadyAt,
        },
        "CombatRoom request_use_skill_slot accepted and synced skill combat rewards/state.",
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
      const state = this.state as CombatRoomState;
      const message = raw as Partial<RequestPickupWorldLootClientMessage> | null;
      const worldLootId = typeof message?.worldLootId === "string" ? message.worldLootId : "";
      const player = state.playerPresence.get(client.sessionId);
      const validation = validatePickupWorldLootIntent(state as never, player, worldLootId);

      if (!validation.ok) {
        const rejection: RequestPickupWorldLootRejectedServerMessage = {
          type: "request_pickup_world_loot_rejected",
          reason: validation.reason,
          ...(worldLootId.length > 0 ? { worldLootId } : {}),
        };
        try {
          client.send("request_pickup_world_loot_rejected", rejection);
        } catch {}
        return;
      }

      if (player === undefined) {
        return;
      }

      const dispatchResult = await dispatchPickedUpWorldLoot({
        characterId: player.characterId,
        worldLoot: validation.worldLoot,
      });

      if (!dispatchResult.ok) {
        try {
          client.send("request_pickup_world_loot_rejected", dispatchResult.rejected);
        } catch {}
        return;
      }

      state.worldLoot.delete(validation.worldLoot.id);

      const accepted: RequestPickupWorldLootAcceptedServerMessage = dispatchResult.accepted;
      try {
        client.send("request_pickup_world_loot_accepted", accepted);
      } catch {}
      if (dispatchResult.currencyMessage !== null) {
        try {
          client.send("currency_picked_up", dispatchResult.currencyMessage);
        } catch {}
      }

      log.debug?.(
        {
          roomId: this.roomId,
          roomName: this.roomName,
          sessionId: client.sessionId,
          characterId: player.characterId,
          worldLootId: validation.worldLoot.id,
        },
        "CombatRoom request_pickup_world_loot accepted and synced loot removed from room state.",
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

    this.onMessage("request_respawn", async (client: Client) => {
      const state = this.state as CombatRoomState;
      const player = state.playerPresence.get(client.sessionId);
      if (player === undefined || player.lifeState === "alive") {
        return;
      }

      // Core 0.14 -- death in a real combat zone now has a real
      // consequence: instead of a free in-place respawn, defeat sends
      // the player back to Nightmarket through the exact same handoff
      // `request_combat_return` already uses for a voluntary gate-click
      // return (resolveCombatZoneReturnSpawnId + updateCharacterRoomIntent
      // + combat_town_return_approved). This is a structural consequence
      // (leave the zone, travel back in), not a numeric one -- HP/flask
      // are still fully restored on arrival, matching the old in-place
      // respawn's own full-restore behavior.
      if (player.hasPendingAction && player.pendingActionType === "zone_transition") {
        return;
      }

      const returnSpawnId = resolveCombatZoneReturnSpawnId(state.zoneId);
      const returnSpawn = roomContentRegistry.spawnPoints.get(returnSpawnId as never);
      if (
        returnSpawn === undefined
        || returnSpawn.zoneId !== "nightmarket"
        || !isPositionInsideZoneBounds("nightmarket" as ZoneId, returnSpawn.x, returnSpawn.y)
      ) {
        return;
      }

      const objectId = "combat_death_return";

      try {
        setPendingAction(player, {
          type: "zone_transition",
          targetId: objectId,
          targetX: returnSpawn.x,
          targetY: returnSpawn.y,
        });
        await new CharacterService().updateCharacterRoomIntent(
          player.characterId,
          "nightmarket",
          returnSpawn.x,
          returnSpawn.y,
          player.maxHp,
          player.maxFlaskCharges,
        );

        player.hp = player.maxHp;
        player.lifeState = "alive";
        player.hasMovementTarget = false;
        restoreFlaskToFull(player);

        const approved: import("@doomscrolls/shared").CombatTownReturnApprovedServerMessage = {
          type: "combat_town_return_approved",
          characterId: player.characterId,
          objectId,
          fromRoomKind: "combat",
          toRoomKind: "town",
          targetZoneId: "nightmarket" as ZoneId,
          targetSpawnKey: returnSpawnId,
          message: "Defeated. Returning to Nightmarket.",
        };
        try { client.send("combat_town_return_approved", approved); } catch {}
      } catch {
        clearPendingAction(player);
        return;
      }

      log.info?.(
        {
          roomId: this.roomId,
          roomName: this.roomName,
          sessionId: client.sessionId,
          characterId: player.characterId,
          targetZoneId: "nightmarket",
          targetSpawnKey: returnSpawnId,
        },
        "CombatRoom request_respawn accepted: death redirected to Nightmarket via combat-town handoff.",
      );
    });
  }

  private registerCombatReturnHandler(
    log: ReturnType<typeof createRoomLogger>,
  ): void {
    if (this.combatReturnHandlerRegistered) {
      return;
    }
    this.combatReturnHandlerRegistered = true;

    this.onMessage("request_combat_return", async (client: Client, raw: unknown) => {
      const state = this.state as CombatRoomState;
      const player = state.playerPresence.get(client.sessionId);
      const message = raw as { objectId?: unknown } | null;
      const objectId = typeof message?.objectId === "string" ? message.objectId : "";

      const reject = (reason: import("@doomscrolls/shared").TownCombatHandoffRejectedReason): void => {
        const rejected: import("@doomscrolls/shared").CombatTownReturnRejectedServerMessage = {
          type: "combat_town_return_rejected",
          ...(objectId.length > 0 ? { objectId } : {}),
          reason,
        };
        try { client.send("combat_town_return_rejected", rejected); } catch {}
      };

      if (player === undefined) {
        reject("player_not_ready");
        return;
      }

      if (player.hasPendingAction && player.pendingActionType === "zone_transition") {
        reject("duplicate_request");
        return;
      }

      if (player.lifeState !== "alive") {
        reject("player_not_ready");
        return;
      }

      const returnInteractable = state.interactables.get(objectId);
      if (returnInteractable === undefined || returnInteractable.type !== "combat_return_gate") {
        reject("transition_unavailable");
        return;
      }

      const returnSpawnId = resolveCombatZoneReturnSpawnId(state.zoneId);
      const returnSpawn = roomContentRegistry.spawnPoints.get(returnSpawnId as never);
      if (
        returnSpawn === undefined
        || returnSpawn.zoneId !== "nightmarket"
        || !isPositionInsideZoneBounds("nightmarket" as ZoneId, returnSpawn.x, returnSpawn.y)
      ) {
        reject("invalid_destination");
        return;
      }

      try {
        setPendingAction(player, {
          type: "zone_transition",
          targetId: objectId,
          targetX: returnSpawn.x,
          targetY: returnSpawn.y,
        });
        await new CharacterService().updateCharacterRoomIntent(
          player.characterId,
          "nightmarket",
          returnSpawn.x,
          returnSpawn.y,
          Math.max(0, Math.min(player.maxHp, player.hp)),
          Math.max(0, Math.min(player.maxFlaskCharges, Math.floor(player.flaskCharges))),
        );

        const approved: import("@doomscrolls/shared").CombatTownReturnApprovedServerMessage = {
          type: "combat_town_return_approved",
          characterId: player.characterId,
          objectId,
          fromRoomKind: "combat",
          toRoomKind: "town",
          targetZoneId: "nightmarket" as ZoneId,
          targetSpawnKey: returnSpawnId,
          message: "Returning to Nightmarket.",
        };
        try { client.send("combat_town_return_approved", approved); } catch {}
      } catch {
        clearPendingAction(player);
        reject("transition_failed");
        return;
      }

      log.info?.(
        {
          roomId: this.roomId,
          roomName: this.roomName,
          sessionId: client.sessionId,
          characterId: player.characterId,
          objectId,
          targetZoneId: "nightmarket",
          targetSpawnKey: returnSpawnId,
        },
        "CombatRoom request_combat_return approved for conservative leave-and-join handoff back to TownRoom.",
      );
    });
  }

  /**
   * Normalize the join-options object into the internal auth shape the
   * room needs. Returns `null` when the shape is not one of the
   * supported variants. Mirrors the same shape used by `TownRoom`.
   */
  private normalizeJoinOptions(
    options: CombatRoomJoinOptions,
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
      return {
        sessionToken: options.sessionToken,
        characterId,
        ...(options.requestedZoneId !== undefined
          ? { requestedZoneId: options.requestedZoneId }
          : {}),
      };
    }

    if (typeof options.userId === "string" && options.userId.length > 0) {
      return {
        userId: options.userId as UserId,
        characterId,
        ...(options.requestedZoneId !== undefined
          ? { requestedZoneId: options.requestedZoneId }
          : {}),
      };
    }

    return null;
  }

  /**
   * Minimal CombatRoom enemy aggro + damage tick.
   *
   * Task 268 — CombatRoom minimal real combat wiring.
   *
   * Walks `state.enemies`. For each non-defeated enemy with a
   * currently-targeted player, moves toward that player using the
   * shared `moveEnemyTowardTarget` helper. When the enemy is inside
   * `ENEMY_ATTACK_RANGE` and its cooldown has elapsed, starts a
   * windup telegraph and applies damage on landing. When the target
   * goes out of aggro range or disconnects, the enemy is switched to
   * the "returning" state via the shared `clearEnemyTargetAndReturn`
   * helper. When a defeated enemy's `respawnAtMs` elapses, it is
   * teleported back to its spawn point and put into the "idle" state
   * so it can re-acquire targets.
   *
   * NOTE: This is intentionally a small CombatRoom-only loop, not a
   * copy of the full TownRoom aggro-damage block. Full enemy AI
   * (wander, leash-out, multi-target re-acquire, heavy attacks,
   * aggro transfer between players, etc.) is deferred to a shared
   * helper extraction task — see `docs/BACKLOG_CORE_0_1.md`
   * "CombatRoom enemy AI helper extraction".
   */
  private applyCombatEnemyAggroDamage(now: number, deltaMs: number): void {
    const state = this.state as CombatRoomState;
    state.enemies.forEach((enemy) => {
      if (enemy.defeated) {
        return;
      }

      const targetSessionId = enemy.targetPlayerSessionId;
      const targetPlayer =
        targetSessionId.length > 0
          ? state.playerPresence.get(targetSessionId)
          : undefined;

      if (targetPlayer === undefined) {
        if (enemy.state === "chasing") {
          clearEnemyTargetAndReturn(enemy);
        }
        return;
      }

      if (targetPlayer.lifeState !== "alive") {
        clearEnemyTargetAndReturn(enemy);
        return;
      }

      // Step the enemy toward the player. moveEnemyTowardTarget is
      // a shared pure helper that does not enter the engagement
      // radius.
      const enemyDefinition = contentRegistry.enemies.get(
        enemy.enemyId as ContentEnemyId,
      );
      const enemyMoveSpeed =
        toWorldUnits(enemyDefinition?.moveSpeed ?? 0, 1.4) *
        ENEMY_MOVEMENT_SPEED_UNITS_PER_SECOND_MULTIPLIER;
      moveEnemyTowardTarget(
        enemy,
        { x: targetPlayer.x, y: targetPlayer.y },
        enemyMoveSpeed,
        deltaMs,
      );

      // Landing an in-flight telegraph.
      if (
        enemy.attackLandingAtMs > 0 &&
        now >= enemy.attackLandingAtMs
      ) {
        enemy.attackLandingAtMs = 0;
        if (
          targetPlayer.lifeState === "alive" &&
          Math.hypot(
            targetPlayer.x - enemy.x,
            targetPlayer.y - enemy.y,
          ) <= ENEMY_ATTACK_RANGE
        ) {
          const rawDamage = Math.max(1, Math.floor(enemyDefinition?.damage ?? 1));
          const damage = mitigateIncomingDamage(rawDamage, targetPlayer.armor);
          const previousHp = Math.max(0, targetPlayer.hp);
          const nextHp = Math.max(0, previousHp - damage);
          targetPlayer.hp = nextHp;
          if (nextHp <= 0) {
            targetPlayer.lifeState = "downed";
            targetPlayer.hasMovementTarget = false;
            clearPendingAction(targetPlayer);
            enemy.state = "returning";
            enemy.targetPlayerSessionId = "";
          }
          const targetClient = this.clients.find(
            (client) => client.sessionId === targetSessionId,
          );
          if (targetClient !== undefined) {
            const resolved: EnemyAttackResolvedServerMessage = {
              type: "enemy_attack_resolved",
              enemyId: enemy.id,
              targetEntityId: targetPlayer.characterId as unknown as EntityId,
              outcome: "hit",
              attackKind: "normal",
              damage: previousHp - nextHp,
              remainingHp: nextHp,
            };
            sendEnemyAttackResolved(targetClient, resolved);
          }
        }
        return;
      }

      // Start a new telegraph when in range and the cooldown has
      // elapsed.
      if (enemy.nextAttackAtMs <= now) {
        const distance = Math.hypot(
          targetPlayer.x - enemy.x,
          targetPlayer.y - enemy.y,
        );
        if (distance <= ENEMY_ATTACK_RANGE) {
          const cooldownMs = Math.max(
            500,
            Math.floor(enemyDefinition?.attackCooldownMs ?? 1200),
          );
          enemy.nextAttackAtMs = now + cooldownMs;
          enemy.attackLandingAtMs = now + ENEMY_ATTACK_WINDUP_MS;
          enemy.state = "chasing";
          const targetClient = this.clients.find(
            (client) => client.sessionId === targetSessionId,
          );
          if (targetClient !== undefined) {
            sendEnemyAttackTelegraph(
              targetClient,
              enemy.id,
              targetPlayer.characterId.toString(),
              ENEMY_ATTACK_WINDUP_MS,
            );
          }
        }
      }
    });
  }

  /**
   * Minimal CombatRoom enemy respawn tick.
   *
   * Reuses the same 5 s cooldown and `applyEnemyDamage` respawnAtMs
   * bookkeeping that `TownRoom` uses. When an enemy's
   * `respawnAtMs` elapses, it is teleported back to its original
   * spawn point and put into the "idle" state so it can re-acquire
   * targets.
   */
  private respawnCombatEnemies(state: CombatRoomState, now: number): void {
    state.enemies.forEach((enemy) => {
      if (!enemy.defeated) {
        return;
      }
      if (!Number.isFinite(enemy.respawnAtMs) || enemy.respawnAtMs <= 0) {
        return;
      }
      if (now < enemy.respawnAtMs) {
        return;
      }
      // Use ENEMY_RESPAWN_DELAY_MS from applyEnemyDamage so the
      // respawn window matches the rest of the room (5 s).
      if (now - enemy.respawnAtMs < 0) {
        return;
      }
      const spawnX = Number.isFinite(enemy.spawnX) ? enemy.spawnX : enemy.x;
      const spawnY = Number.isFinite(enemy.spawnY) ? enemy.spawnY : enemy.y;
      enemy.x = spawnX;
      enemy.y = spawnY;
      enemy.hp = enemy.maxHp;
      enemy.defeated = false;
      enemy.state = "idle";
      enemy.targetPlayerSessionId = "";
      enemy.nextAttackAtMs = 0;
      enemy.attackLandingAtMs = 0;
      enemy.respawnAtMs = 0;
      enemy.attackKind = "normal";
      enemy.nextHeavyAttackAtMs = 0;
    });
  }
}
