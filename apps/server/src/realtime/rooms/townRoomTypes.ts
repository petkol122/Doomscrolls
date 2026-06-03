import type { CharacterId, SessionToken, UserId, ZoneId } from "@doomscrolls/shared";

/**
 * Type definitions for the empty TownRoom.
 *
 * Task 018.1 scope was a placeholder join-options type only.
 *
 * Task 018.2 scope (this file):
 *  - the join-options object now carries the minimal context the room
 *    needs to validate a join with `RoomJoinValidationService`
 *  - it is a discriminated, real contract: no gameplay, no player state,
 *    no game state, no persistence
 *  - the room itself does not register a Colyseus schema and does not
 *    spawn any entity from these options; it only uses them to validate
 *    the join
 *
 * Exactly one of `sessionToken` or `userId` must be supplied. The room
 * rejects joins that carry none of them.
 */
export interface TownRoomJoinOptions {
  readonly characterId: CharacterId;
  readonly sessionToken?: SessionToken;
  readonly userId?: UserId;
  readonly requestedZoneId?: ZoneId;
}
