import { Room } from "colyseus";
import type { ServerLogger } from "../../config/logger";
import type { TownRoomJoinOptions } from "./townRoomTypes";

/**
 * Empty placeholder Colyseus room for town (hub) gameplay.
 *
 * Task 018.1 scope ONLY:
 *  - extends `colyseus.Room`
 *  - accepts a placeholder `TownRoomJoinOptions` for future `onCreate` / `onJoin` use
 *  - `onCreate` logs a safe, minimal initialization event
 *  - `onJoin`  logs a safe join event without validating anything
 *  - `onLeave` / `onDispose` are intentionally no-ops
 *
 * Explicitly out of scope (deferred to later dedicated tasks):
 *  - state schema, players, entities, movement, combat
 *  - chat, inventory, equipment, persistence
 *  - real client connection / real join validation
 *
 * Real join-time validation for this room is owned by
 * `RoomJoinValidationService` and must be wired in a future task; this
 * class must never accept client-sent damage, XP, loot, inventory or
 * equipment changes.
 */
export class TownRoom extends Room {
  public static readonly ROOM_NAME = "town";

  public override async onCreate(options: TownRoomJoinOptions): Promise<void> {
    const logger = (this as unknown as { logger?: ServerLogger }).logger;
    if (logger && typeof logger.info === "function") {
      logger.info(
        { roomId: this.roomId, roomName: this.roomName },
        "TownRoom created (placeholder, no gameplay state).",
      );
    }

    // options is intentionally unused for now; reserved for future join-options.
    void options;
  }

  public override async onJoin(
    _client: unknown,
    options?: TownRoomJoinOptions,
  ): Promise<void> {
    const logger = (this as unknown as { logger?: ServerLogger }).logger;
    if (logger && typeof logger.debug === "function") {
      logger.debug(
        { roomId: this.roomId, roomName: this.roomName },
        "TownRoom join event received (no validation yet).",
      );
    }

    void options;
  }
}
