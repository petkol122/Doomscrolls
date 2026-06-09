import type { CharacterId, SessionToken, UserId, ZoneId } from "@doomscrolls/shared";

/**
 * Type definitions for the minimal CombatRoom.
 *
 * Task 263 scope: thin join-options contract mirroring `TownRoomJoinOptions`
 * so the room can validate the join through `RoomJoinValidationService`
 * without registering any gameplay, room-state schema or schema mutations
 * of its own beyond the minimal `CombatRoomState`.
 *
 * Exactly one of `sessionToken` or `userId` must be supplied. The room
 * rejects joins that carry none of them.
 */
export interface CombatRoomJoinOptions {
  readonly characterId: CharacterId;
  readonly sessionToken?: SessionToken;
  readonly userId?: UserId;
  readonly requestedZoneId?: ZoneId;
}
