import type { EntityId, IsoDateTimeString, RoomId, ZoneId } from "../ids";
import type { RoomEntity } from "./EntityTypes";

export type RoomKind = "town" | "combat";

export interface RoomState {
  readonly roomId: RoomId;
  readonly zoneId: ZoneId;
  readonly kind: RoomKind;
  readonly connectedPlayerCount: number;
  readonly entities: Readonly<Record<EntityId, RoomEntity>>;
  readonly serverTime: IsoDateTimeString;
}

export interface RoomStatePatch {
  readonly upsertedEntities: readonly RoomEntity[];
  readonly removedEntityIds: readonly EntityId[];
  readonly serverTime: IsoDateTimeString;
}