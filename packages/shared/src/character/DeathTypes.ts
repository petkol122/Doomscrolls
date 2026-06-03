import type { CharacterId, CorpseId, IsoDateTimeString, RoomId, ZoneId } from "../ids";
import type { Vector2 } from "../math/Vector2";

export type CharacterLifeState = "alive" | "dead" | "respawning";

export type CorpseState = "active" | "recovered" | "force_recovered";

export interface CharacterCorpseState {
  readonly corpseId: CorpseId;
  readonly characterId: CharacterId;
  readonly state: CorpseState;
  readonly zoneId: ZoneId;
  readonly roomId: RoomId;
  readonly position: Vector2;
  readonly diedAt: IsoDateTimeString;
  readonly recoveredAt?: IsoDateTimeString;
}

export interface CharacterDeathState {
  readonly lifeState: CharacterLifeState;
  readonly activeCorpse?: CharacterCorpseState;
  readonly lastDeathAt?: IsoDateTimeString;
}