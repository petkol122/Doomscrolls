import { Room, Client } from "colyseus";
import type {
  CharacterId,
  DamageAppliedServerMessage,
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
  UserId,
  ZoneId,
  RequestInteractClientMessage,
  InteractResponseServerMessage,
} from "@doomscrolls/shared";
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
import { validateInteractIntent, getInteractableResponseMessage } from "./interactValidation";
import { validateAttackIntent } from "./attackIntentValidation";
import { consumeAttackCooldown, resolveAttackCooldownMs } from "./attackCooldown";
import { applyEnemyDamage } from "./applyEnemyDamage";
import { respawnTownEnemies } from "./respawnTownEnemies";
import { spawnWorldLootOnEnemyDefeat } from "./spawnWorldLootOnEnemyDefeat";
import { persistPickedUpWorldLootToInventory } from "./pickupWorldLootInventory";
import { validatePickupWorldLootIntent } from "./pickupWorldLootValidation";
import { clearPendingAction, setPendingAction } from "./pendingActionState";
import { resolvePlayerInitialPosition } from "./validateCharacterLocation";
import { contentRegistry } from "@doomscrolls/content";
import type { SpawnPointContentId } from "@doomscrolls/content";
import { NIGHTMARKET_DEFAULT_SPAWN_POINT_ID } from "./resolveTownSpawnPoint";

const ENEMY_AGGRO_RANGE = 120;
const ENEMY_ATTACK_RANGE = 44;
const ENEMY_ATTACK_COOLDOWN_MS = 1200;
const ENEMY_ATTACK_DAMAGE = 2;

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
private pickupWorldLootHandlerRegistered = false;
private respawnHandlerRegistered = false;

  public override async onCreate(options: TownRoomJoinOptions): Promise<void> {
    const log = createRoomLogger(
      (this as unknown as { logger?: unknown }).logger,
    );

    const zoneId: ZoneId = options.requestedZoneId ?? ("nightmarket" as ZoneId);

    this.setState(new TownRoomState(zoneId));

    // Task 057 — Initialize interactable objects
    initializeTownInteractables(this.state as TownRoomState, zoneId);

    // Task 058 — Initialize synced static enemy placeholders.
    initializeTownEnemies(this.state as TownRoomState, zoneId);

    this.registerMovementIntentHandler(log);
    this.registerInteractHandler(log);
    this.registerAttackHandler(log);
    this.registerPickupWorldLootHandler(log);
    this.registerRespawnHandler(log);
    this.setSimulationInterval((deltaMs: number) => {
      stepTownRoomMovement(this.state as TownRoomState, deltaMs, {
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
      this.applyEnemyAggroDamage(Date.now());
      respawnTownEnemies(this.state as TownRoomState, Date.now());
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

    // Delegate presence building (spawn point resolution + initial
    // world position copy) to a dedicated helper so this room file
    // stays a thin Colyseus shell.
    const presence = buildTownPlayerPresence({
      sessionId,
      characterId,
      displayName: characterName,
      resolvedZoneId,
      hp: maxHp,
      maxHp,
      movementSpeed,
      attackCooldownMs,
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
        spawnPointId: presence.spawnPointId,
        movementSpeed: presence.movementSpeed,
        attackCooldownMs: presence.attackCooldownMs,
        x: presence.x,
        y: presence.y,
        connectedPlayerCount: state.connectedPlayerCount,
      },
      "TownRoom join accepted, player presence added with resolved spawn point and initial world position.",
    );
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
        await characterService.updateCharacterLocation(
          presence.characterId,
          state.zoneId,
          presence.x,
          presence.y,
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

    this.onMessage("request_interact", (client: Client, raw: unknown) => {
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
            applyMovementIntent(state, client.sessionId, interactable.x, interactable.y);
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
            applyMovementIntent(state, client.sessionId, enemy.x, enemy.y);
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
      const spawnedLoot = damageResult.defeated
        ? spawnWorldLootOnEnemyDefeat(state, validation.enemy, now)
        : null;
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
          worldLootId: spawnedLoot?.id,
          worldLootItemId: spawnedLoot?.itemId,
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
            applyMovementIntent(state, client.sessionId, worldLoot.x, worldLoot.y);
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
      const pickupResult = await persistPickedUpWorldLootToInventory({
        characterId: player.characterId,
        itemDefinitionId: validation.worldLoot.itemId,
        itemLabel: validation.worldLoot.label,
      });

      if (!pickupResult.ok) {
        const rejection: RequestPickupWorldLootRejectedServerMessage = {
          type: "request_pickup_world_loot_rejected",
          reason: pickupResult.reason === "inventory_full" ? "inventory_full" : "world_loot_not_found",
          worldLootId: validation.worldLoot.id,
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
            worldLootId: validation.worldLoot.id,
            worldLootItemId: validation.worldLoot.itemId,
            reason: rejection.reason,
          },
          "TownRoom request_pickup_world_loot rejected during inventory persistence.",
        );
        return;
      }

      state.worldLoot.delete(validation.worldLoot.id);

      const accepted: RequestPickupWorldLootAcceptedServerMessage = {
        type: "request_pickup_world_loot_accepted",
        worldLootId: validation.worldLoot.id,
        message: pickupResult.message,
      };

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
      player.x = respawnPosition.x;
      player.y = respawnPosition.y;
      player.targetX = respawnPosition.x;
      player.targetY = respawnPosition.y;
      player.hasMovementTarget = false;
      clearPendingAction(player);

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

  private applyEnemyAggroDamage(now: number): void {
    const state = this.state as TownRoomState;

    state.enemies.forEach((enemy) => {
      if (enemy.defeated || enemy.hp <= 0) {
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

      if (closestPlayerSessionId === null || closestDistance > ENEMY_AGGRO_RANGE) {
        return;
      }

      if (closestDistance > ENEMY_ATTACK_RANGE) {
        return;
      }

      const targetPlayer = state.playerPresence.get(closestPlayerSessionId);
      if (targetPlayer === undefined || targetPlayer.hp <= 0) {
        return;
      }

      if (now < enemy.nextAttackAtMs) {
        return;
      }

      enemy.nextAttackAtMs = now + ENEMY_ATTACK_COOLDOWN_MS;
      const nextHp = Math.max(0, targetPlayer.hp - ENEMY_ATTACK_DAMAGE);
      targetPlayer.hp = nextHp;
      if (nextHp <= 0) {
        targetPlayer.lifeState = "downed";
        targetPlayer.hasMovementTarget = false;
        targetPlayer.targetX = targetPlayer.x;
        targetPlayer.targetY = targetPlayer.y;
        clearPendingAction(targetPlayer);
      }

      const targetClient = this.clients.find((client) => client.sessionId === closestPlayerSessionId);
      if (targetClient !== undefined) {
        const message: DamageAppliedServerMessage = {
          type: "damage_applied",
          targetEntityId: targetPlayer.characterId as unknown as EntityId,
          sourceEntityId: enemy.id as unknown as EntityId,
          damage: ENEMY_ATTACK_DAMAGE,
          remainingHp: nextHp,
        };

        try {
          targetClient.send("damage_applied", message);
        } catch {
          // keep room state authoritative even if send fails
        }
      }
    });
  }
}
