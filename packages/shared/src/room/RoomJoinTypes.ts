import type { CharacterId, SessionToken, ZoneId } from "../ids";
import type { RoomKind } from "./RoomStateTypes";

export interface SelectedCharacterRoomJoinRequest {
  readonly characterId: CharacterId;
  readonly requestedRoomKind: RoomKind;
  readonly requestedZoneId?: ZoneId;
}

export interface RoomJoinAuthPayload extends SelectedCharacterRoomJoinRequest {
  readonly sessionToken: SessionToken;
}

export type RoomJoinFailureReason =
  | "not_authenticated"
  | "session_expired"
  | "character_not_found"
  | "character_not_owned"
  | "invalid_room_kind"
  | "invalid_zone"
  | "room_unavailable";