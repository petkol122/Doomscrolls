/**
 * Type definitions for the empty TownRoom.
 *
 * Task 018.1 scope: a placeholder join-options type only.
 * No validation, no player state, no game state, no persistence.
 *
 * The TownRoom is intentionally empty. Real auth, character ownership checks
 * and join validation are handled upstream by `RoomJoinValidationService`
 * and must be wired into a future dedicated task before any client may
 * connect to a town room.
 */
export interface TownRoomJoinOptions {
  readonly placeholder?: never;
}
