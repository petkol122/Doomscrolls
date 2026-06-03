import { Room, Client } from "colyseus";
import type {
  CharacterId,
  RequestMoveRejectedServerMessage,
  UserId,
  ZoneId,
} from "@doomscrolls/shared";
import { RoomJoinValidationService } from "../RoomJoinValidationService";
import type { TownRoomJoinOptions } from "./townRoomTypes";
import { TownRoomState } from "./TownRoomState";
import { buildTownPlayerPresence } from "./buildPlayerPresence";
import { createRoomLogger } from "./roomLogger";
import { validateMovementIntent } from "./movementIntentValidation";
import { applyMovementIntent } from "./applyMovementIntent";
import { resolveZoneBounds } from "./resolveZoneBounds";

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
 *  - Task 029: on acceptance, applies the validated position update
 *    to the player's PlayerPresence via {@link applyMovementIntent},
 *    which is broadcast automatically through Colyseus schema sync.
 *    No interpolation, pathfinding, collision, map, speed checks,
 *    combat or persistence.
 *
 * Player presence building is delegated to
 * {@link buildTownPlayerPresence} so this room stays a thin Colyseus
 * shell. Movement intent validation is delegated to
 * {@link validateMovementIntent} for the same reason. See
 * `docs/CODING_RULES.md` "Realtime Room File-Size Guard".
 *
 * Explicitly out of scope:
 *  - movement simulation / position updates after join
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
 * Task 029 extends the handler to also apply the validated position
 * update to the player's PlayerPresence, which is then broadcast
 * automatically through Colyseus schema synchronization.
 */
private movementIntentHandlerRegistered = false;

  public override async onCreate(options: TownRoomJoinOptions): Promise<void> {
    const log = createRoomLogger(
      (this as unknown as { logger?: unknown }).logger,
    );

    const zoneId: ZoneId = options.requestedZoneId ?? ("nightmarket" as ZoneId);

    this.setState(new TownRoomState(zoneId));

    this.registerMovementIntentHandler(log);

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

    // Delegate presence building (spawn point resolution + initial
    // world position copy) to a dedicated helper so this room file
    // stays a thin Colyseus shell.
    const presence = buildTownPlayerPresence({
      sessionId,
      characterId,
      displayName: characterName,
      resolvedZoneId,
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
        x: presence.x,
        y: presence.y,
        connectedPlayerCount: state.connectedPlayerCount,
      },
      "TownRoom join accepted, player presence added with resolved spawn point and initial world position.",
    );
  }

  public override async onLeave(_client: Client): Promise<void> {
    const state = this.state as TownRoomState;
    state.playerPresence.delete(_client.sessionId);
    state.connectedPlayerCount = state.playerPresence.size;
  }

  /**
   * Register the `request_move` message handler on the room.
   *
   * Scope (Task 026 foundation + Task 029 movement step 1):
   *   - validates the intent shape and range
   *   - on rejection, sends a `request_move_rejected` message back
   *     to the originating client with a safe reason code
   *   - on acceptance, applies the validated position update to the
   *     player's PlayerPresence via {@link applyMovementIntent} so the
   *     new x/y is broadcast automatically through Colyseus schema
   *     synchronization
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

      // Apply the validated position update to the player's
      // PlayerPresence. Colyseus schema synchronization handles the
      // broadcast automatically.
      const applied = applyMovementIntent(
        state,
        client.sessionId,
        result.targetX,
        result.targetY,
      );

      if (applied) {
        log.debug?.(
          {
            roomId: this.roomId,
            roomName: this.roomName,
            sessionId: client.sessionId,
            targetX: result.targetX,
            targetY: result.targetY,
            clientTime: result.clientTime,
          },
          "TownRoom request_move applied and broadcast via schema sync.",
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
}
