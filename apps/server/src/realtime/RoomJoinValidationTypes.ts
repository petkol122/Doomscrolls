import type {
  CharacterDetails,
  CharacterId,
  RoomJoinFailureReason,
  RoomKind,
  UserId,
  ZoneId,
} from "@doomscrolls/shared";

/**
 * Safe input for a future room join request.
 *
 * The caller is responsible for providing the authenticated user/character context.
 * The service performs ownership + kind/zone checks only; it does not register
 * any Colyseus room and does not perform any actual join.
 */
export interface RoomJoinValidationInput {
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly requestedRoomKind: RoomKind;
  readonly requestedZoneId?: ZoneId;
}

/**
 * Discriminated safe result returned by the validation service.
 *
 * - `success: true` means the join may proceed; the validated character details
 *   are returned for downstream use.
 * - `success: false` means the join must be rejected; `reason` is a stable
 *   `RoomJoinFailureReason` code safe to surface to the client.
 */
export type RoomJoinValidationResult =
  | {
      readonly success: true;
      readonly character: CharacterDetails;
      readonly resolvedRoomKind: RoomKind;
      readonly resolvedZoneId: ZoneId;
    }
  | {
      readonly success: false;
      readonly reason: RoomJoinFailureReason;
    };
