import { Room } from "colyseus";
import type {
  CharacterId,
  UserId,
  ZoneId,
} from "@doomscrolls/shared";
import type { ServerLogger } from "../../config/logger";
import { RoomJoinValidationService } from "../RoomJoinValidationService";
import type { TownRoomJoinOptions } from "./townRoomTypes";

/**
 * Empty placeholder Colyseus room for town (hub) gameplay.
 *
 * Task 018.1 scope:
 *  - extends `colyseus.Room`
 *  - accepts a placeholder `TownRoomJoinOptions` for future `onCreate` / `onJoin` use
 *  - `onCreate` logs a safe, minimal initialization event
 *  - `onJoin`  logs a safe join event without validating anything
 *  - `onLeave` / `onDispose` are intentionally no-ops
 *
 * Task 018.2 scope (this file):
 *  - `onJoin` now wires `RoomJoinValidationService` to validate the join
 *    using the authenticated user/session context and the requested character.
 *  - Invalid joins are rejected safely by throwing from `onJoin`; the raw
 *    session token is never logged, and the session token value is never
 *    embedded in the thrown error message.
 *  - Valid joins are accepted but do NOT spawn any player entity, do NOT
 *    create any room state, and do NOT start any gameplay. Spawning a
 *    player is intentionally deferred to a later dedicated task.
 *
 * Explicitly out of scope (deferred to later dedicated tasks):
 *  - state schema, players, entities, movement, combat
 *  - chat, inventory, equipment, persistence
 *  - real client connection UI
 *  - seed data
 */
export class TownRoom extends Room {
  public static readonly ROOM_NAME = "town";

  public override async onCreate(_options: TownRoomJoinOptions): Promise<void> {
    const logger = (this as unknown as { logger?: ServerLogger }).logger;
    if (logger && typeof logger.info === "function") {
      logger.info(
        { roomId: this.roomId, roomName: this.roomName },
        "TownRoom created (placeholder, no gameplay state).",
      );
    }

    // options is intentionally unused for now; reserved for future join-options.
    void _options;
  }

  public override async onJoin(
    _client: unknown,
    options?: TownRoomJoinOptions,
  ): Promise<void> {
    const logger = (this as unknown as { logger?: ServerLogger }).logger;
    const safeLog: Pick<ServerLogger, "debug" | "info" | "warn" | "error"> = {
      debug: (obj: unknown, msg?: string) => {
        logger?.debug?.(obj, msg);
      },
      info: (obj: unknown, msg?: string) => {
        logger?.info?.(obj, msg);
      },
      warn: (obj: unknown, msg?: string) => {
        logger?.warn?.(obj, msg);
      },
      error: (obj: unknown, msg?: string) => {
        logger?.error?.(obj, msg);
      },
    };

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

    safeLog.info?.(
      {
        roomId: this.roomId,
        roomName: this.roomName,
        userId: result.character.ownerUserId,
        characterId: result.character.id,
        zoneId: result.resolvedZoneId,
      },
      "TownRoom join accepted (validation only, no player spawn).",
    );

    // Intentionally NOT spawning a player entity. Spawning is deferred to
    // a later dedicated task per Task 018.2 scope.
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
