import type { StatModifier } from "../character/StatTypes";
import type { CharacterId, CorpseId, IsoDateTimeString, ItemDefinitionId, ItemInstanceId, RoomId, ZoneId } from "../ids";
import type { Vector2 } from "../math/Vector2";
import type { EquipmentSlot } from "./EquipmentTypes";

export type ItemCategory = "weapon" | "armor" | "accessory" | "belt" | "flask" | "material";

export type ItemLocationType = "room_loot" | "inventory" | "stash" | "equipment" | "corpse_bound" | "deleted";

export interface ItemSize {
  readonly width: number;
  readonly height: number;
}

export interface ItemDefinition {
  readonly id: ItemDefinitionId;
  readonly key: string;
  readonly displayName: string;
  readonly category: ItemCategory;
  readonly size: ItemSize;
  readonly allowedEquipmentSlots: readonly EquipmentSlot[];
  readonly statModifiers: readonly StatModifier[];
  readonly maxStackSize: number;
}

export interface RoomLootLocation {
  readonly type: "room_loot";
  readonly zoneId: ZoneId;
  readonly roomId: RoomId;
  readonly position: Vector2;
}

export interface InventoryItemLocation {
  readonly type: "inventory";
  readonly characterId: CharacterId;
  readonly pageIndex: number;
  readonly x: number;
  readonly y: number;
}

export interface StashItemLocation {
  readonly type: "stash";
  readonly characterId: CharacterId;
  readonly pageIndex: number;
  readonly x: number;
  readonly y: number;
}

export interface EquipmentItemLocation {
  readonly type: "equipment";
  readonly characterId: CharacterId;
  readonly slot: EquipmentSlot;
}

export interface CorpseBoundItemLocation {
  readonly type: "corpse_bound";
  readonly characterId: CharacterId;
  readonly corpseId: CorpseId;
}

export interface DeletedItemLocation {
  readonly type: "deleted";
  readonly deletedAt: IsoDateTimeString;
}

export type ItemLocation =
  | RoomLootLocation
  | InventoryItemLocation
  | StashItemLocation
  | EquipmentItemLocation
  | CorpseBoundItemLocation
  | DeletedItemLocation;

export interface ItemInstance {
  readonly id: ItemInstanceId;
  readonly definitionId: ItemDefinitionId;
  readonly ownerCharacterId?: CharacterId;
  readonly stackQuantity: number;
  readonly location: ItemLocation;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
}