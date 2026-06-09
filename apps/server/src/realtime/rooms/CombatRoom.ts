import { Room, Client } from "colyseus";
import type {
  CharacterId,
  UserId,
  ZoneId,
} from "@doomscrolls/shared";
import { RoomJoinValidationService } from "../RoomJoinValidationService";
import type { CombatRoomJoinOptions } from "./combatRoomTypes";
import { CombatRoomState } from "./CombatRoomState";
import { createRoomLogger } from "./roomLogger";
import { buildCombatPlayerPresence } from "./buildCombatPlayerPresence";

/**
 * CombatRoom with minimal Colyseus schema state.
 *
 * Task 263 scope: thin Colyseus shell registered as the `combat` room
 * kind. Its only responsibilities are:
 *
 *  - Set a minimal `CombatRoomState` schema containing:
 *      roomKind = "combat"
 *      zoneId
 *      playerPresence (MapSchema<PlayerPresence>)
 *      connectedPlayerCount
 *  - On valid join, validate the session token and the selected
 *    character ownership through the shared `RoomJoinValidationService`
 *    (re-using the same gate `TownRoom` uses), then build a placeholder
 *    `PlayerPresence` entry through `buildCombatPlayerPresence`.
 *  - On leave, remove the presence entry.
 *
 * No enemy state, no map, no movement, no combat, no loot, no XP, no
 * objectives, no client message handlers and no simulation tick exist
 * in this minimal foundation. Those belong to future dedicated tasks
 * (Task 264+) and must reuse the existing shared helpers instead of
 * copying `TownRoom` gameplay logic.
 *
 * The room file stays a thin Colyseus shell — lifecycle only, no
 * gameplay. See `docs/CODING_RULES.md` "Realtime Room File-Size Guard".
 */
export class CombatRoom extends Room {
  public static readonly ROOM_NAME = "combat";

  public override async onCreate(options: CombatRoomJoinOptions): Promise<void> {
    const log = createRoomLogger(
      (this as unknown as { logger?: unknown }).logger,
    );

    const zoneId: ZoneId = options.requestedZoneId ?? ("blackwire_sewers" as ZoneId);

    this.setState(new CombatRoomState(zoneId));

    log.info(
      { roomId: this.roomId, roomName: this.roomName, zoneId, roomKind: "combat" },
      "CombatRoom created with minimal state schema.",
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

    // Resolve the join auth into a discriminated shape. Either:
    //   - a raw session token (and we resolve userId via AuthService), or
    //   - an already-resolved userId supplied by the caller.
    // characterId is required in both cases. Anything else is rejected.
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
      // auth.sessionToken is undefined and userId is required in that
      // case. The guard in normalizeJoinOptions guarantees this branch
      // only runs with a real userId.
      resolvedUserId = auth.userId as UserId;
    }

    // Step 2: validate kind/zone/character ownership through the
    // shared validation service.
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

    // Minimal presence entry — delegated to a dedicated helper that
    // mirrors the shape of `buildTownPlayerPresence`. The CombatRoom
    // foundation intentionally does not own spawn point resolution
    // (no combat spawn point exists in content yet) or HP/location
    // restoration. Future tasks (Task 264+) are expected to add a
    // real combat spawn point to content and reuse a shared spawn
    // resolver, not duplicate `TownRoom`.
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

    state.playerPresence.delete(_client.sessionId);
    state.connectedPlayerCount = state.playerPresence.size;

    safeLog.debug?.(
      { roomId: this.roomId, roomName: this.roomName, sessionId: _client.sessionId },
      "CombatRoom leave, presence removed.",
    );
  }

  /**
   * Normalize the join-options object into the internal auth shape the
   * room needs. Returns `null` when the shape is not one of the
   * supported variants.
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
        ...(options.requestedZoneId !== undefined ? { requestedZoneId: options.requestedZoneId } : {}),
      };
    }

    if (
      options.userId !== undefined &&
      typeof options.userId === "string" &&
      options.userId.length > 0
    ) {
      return {
        userId: options.userId,
        characterId,
        ...(options.requestedZoneId !== undefined ? { requestedZoneId: options.requestedZoneId } : {}),
      };
    }

    return null;
  }
}
