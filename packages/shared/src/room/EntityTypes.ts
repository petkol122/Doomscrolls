import type { CharacterId, EntityId, ItemInstanceId } from "../ids";
import type { Vector2 } from "../math/Vector2";
import type { CharacterLifeState } from "../character/DeathTypes";

export type RoomEntityType = "player" | "enemy" | "loot" | "corpse";

export interface RoomEntityBase {
  readonly id: EntityId;
  readonly type: RoomEntityType;
  readonly position: Vector2;
}

export interface PlayerEntity extends RoomEntityBase {
  readonly type: "player";
  readonly characterId: CharacterId;
  readonly characterName: string;
  readonly lifeState: CharacterLifeState;
  readonly currentHp: number;
  readonly maxHp: number;
}

export interface EnemyEntity extends RoomEntityBase {
  readonly type: "enemy";
  readonly enemyDefinitionKey: string;
  readonly currentHp: number;
  readonly maxHp: number;
}

export interface LootEntity extends RoomEntityBase {
  readonly type: "loot";
  readonly itemInstanceId: ItemInstanceId;
}

export interface CorpseEntity extends RoomEntityBase {
  readonly type: "corpse";
  readonly characterId: CharacterId;
}

export type RoomEntity = PlayerEntity | EnemyEntity | LootEntity | CorpseEntity;