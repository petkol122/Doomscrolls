import { Room, Client } from "colyseus";
import {
  type CharacterId,
  type EnemyAttackResolvedServerMessage,
  type EntityId,
  type EnemyAttackTelegraphServerMessage,
  type PlayerRespawnedServerMessage,
  type RequestAttackAcceptedServerMessage,
  type RequestAttackClientMessage,
  type RequestAttackRejectedServerMessage,
  type RequestMoveRejectedServerMessage,
  type UserId,
  type ZoneId,
} from "@doomscrolls/shared";
import { RoomJoinValidationService } from "../RoomJoinValidationService";
import type { CombatRoomJoinOptions } from "./combatRoomTypes";
import { CombatRoomState } from "./CombatRoomState";
import { createRoomLogger } from "./roomLogger";
import { buildCombatPlayerPresence } from "./buildCombatPlayerPresence";
import { initializeCombatEnemies, COMBAT_SPAWN_BOX } from "./initializeCombatEnemies";
import { validateMovementIntent } from "./movementIntentValidation";
import { applyMovementIntent } from "./applyMovementIntent";
import { stepTownRoomMovement, TOWN_MOVEMENT_TICK_RATE_MS } from "./stepTownRoomMovement";
import { validateAttackIntent } from "./attackIntentValidation";
import { consumeAttackCooldown } from "./attackCooldown";
import { applyEnemyDamage } from "./applyEnemyDamage";
import { restoreFlaskToFull } from "./healingFlaskConfig";
import { clearPendingAction } from "./pendingActionState";
import {
  ENEMY_ATTACK_RANGE,
  clearEnemyTargetAndReturn,
  moveEnemyTowardTarget,
} from "./enemyAiHelpers";
import { contentRegistry } from "@doomscrolls/content";
import { CharacterService } from "../../character/CharacterService";

// Task 227 -- enemy movement speed is authored in the same per-second
// stat space as the player's derived `moveSpeed`. The runtime
// world-units-per-second value must be scaled by this constant the
// same way the player speed is, otherwise the enemy moves at
// <1 wu/sec and can never catch a player running at 200+ wu/sec.
const ENEMY_MOVEMENT_SPEED_UNITS_PER_SECOND_MULTIPLIER = 220;
// Task 306: reduced from 350 ms to 300 ms to match TownRoom tuning
const ENEMY_ATTACK_WINDUP_MS = 300;

type ContentEnemyId = Parameters<typeof contentRegistry.enemies.get>[0];

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

    this.registerMovementIntentHandler(log);
    this.registerAttackHandler(log);
    this.registerRespawnHandler(log);

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
      "CombatRoom created with real combat wiring (request_move, request_attack, simulation tick, 3×Trashboar Runt spawn set).",
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

    const presence = buildCombatPlayerPresence({
      sessionId,
      characterId,
      displayName: characterName,
      level: result.character.level,
      xp: result.character.xp,
      resolvedZoneId,
      hp: 0,
      maxHp: 0,
      restoredFlaskCharges: undefined,
      movementSpeed: 0,
      attackCooldownMs: 0,
      restoredLocationZoneId: result.character.lastLocationZoneId ?? undefined,
      restoredLocationX: result.character.lastLocationX ?? undefined,
      restoredLocationY: result.character.lastLocationY ?? undefined,
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
  }

  public override async onLeave(_client: Client): Promise<void> {
    const safeLog = createRoomLogger(
      (this as unknown as { logger?: unknown }).logger,
    );
    const state = this.state as CombatRoomState;
    const presence = state.playerPresence.get(_client.sessionId);

    if (presence !== undefined) {
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
      const damageResult = applyEnemyDamage(validation.enemy, 1);

      const accepted: RequestAttackAcceptedServerMessage = {
        type: "request_attack_accepted",
        targetEnemyId: validation.enemy.id,
      };
      try {
        client.send("request_attack_accepted", accepted);
      } catch {}

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
          nextAttackAt: player.nextAttackAt,
        },
        "CombatRoom request_attack accepted and enemy state synced (no loot/XP/objective yet).",
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
      const state = this.state as CombatRoomState;
      const player = state.playerPresence.get(client.sessionId);
      if (player === undefined || player.lifeState === "alive") {
        return;
      }

      // Minimal respawn: restore the player's HP to max and a
      // ready flask set; teleport the player back to the centre of
      // the combat spawn box (the same box `initializeCombatEnemies`
      // uses). Heavy corpse / recovery UI is out of scope for the
      // Task 268 minimal wiring.
      player.hp = player.maxHp;
      player.lifeState = "alive";
      player.hasMovementTarget = false;
      clearPendingAction(player);
      const { minX, maxX, minY, maxY } = COMBAT_SPAWN_BOX;
      player.x = Math.round((minX + maxX) / 2);
      player.y = Math.round((minY + maxY) / 2);
      restoreFlaskToFull(player);

      const respawned: PlayerRespawnedServerMessage = {
        type: "player_respawned",
        characterId: player.characterId,
        zoneId: state.zoneId,
        hp: player.hp,
      };
      try {
        client.send("player_respawned", respawned);
      } catch {}

      log.info?.(
        {
          roomId: this.roomId,
          roomName: this.roomName,
          sessionId: client.sessionId,
          characterId: player.characterId,
          hp: player.hp,
          maxHp: player.maxHp,
          x: player.x,
          y: player.y,
        },
        "CombatRoom request_respawn accepted: player HP restored and teleported to combat spawn centre.",
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
          const damage = Math.max(1, Math.floor(enemyDefinition?.damage ?? 1));
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
