import type { CharacterId, EntityId, ItemInstanceId, ZoneId } from "../ids";
import type { Vector2 } from "../math/Vector2";
import type { MoveInventoryItemPayload } from "../inventory/InventoryTypes";
import type { EquipItemPayload, EquipmentSlot, UnequipItemPayload } from "../inventory/EquipmentTypes";

export interface MoveToPointClientMessage {
  readonly type: "move_to_point";
  readonly target: Vector2;
}

export interface AttackTargetClientMessage {
  readonly type: "attack_target";
  readonly targetEntityId: EntityId;
}

export interface UseBeltSlotClientMessage {
  readonly type: "use_belt_slot";
  readonly slot: Extract<EquipmentSlot, "flask_1">;
}

export interface PickupLootClientMessage {
  readonly type: "pickup_loot";
  readonly lootEntityId: EntityId;
}

export interface MoveInventoryItemClientMessage extends MoveInventoryItemPayload {
  readonly type: "move_inventory_item";
}

export interface EquipItemClientMessage extends EquipItemPayload {
  readonly type: "equip_item";
}

export interface UnequipItemClientMessage extends UnequipItemPayload {
  readonly type: "unequip_item";
}

export interface RequestRespawnClientMessage {
  readonly type: "request_respawn";
}

export interface RetrieveCorpseClientMessage {
  readonly type: "retrieve_corpse";
}

export interface ForceRecoverCorpseClientMessage {
  readonly type: "force_recover_corpse";
}

export interface ChatMessageClientMessage {
  readonly type: "chat_message";
  readonly text: string;
}

export interface TransitionZoneClientMessage {
  readonly type: "transition_zone";
  readonly targetZoneId: ZoneId;
  readonly characterId: CharacterId;
}

export interface DropInventoryItemClientMessage {
  readonly type: "drop_inventory_item";
  readonly itemInstanceId: ItemInstanceId;
}

export type ClientRoomMessage =
  | MoveToPointClientMessage
  | AttackTargetClientMessage
  | UseBeltSlotClientMessage
  | PickupLootClientMessage
  | MoveInventoryItemClientMessage
  | EquipItemClientMessage
  | UnequipItemClientMessage
  | RequestRespawnClientMessage
  | RetrieveCorpseClientMessage
  | ForceRecoverCorpseClientMessage
  | ChatMessageClientMessage
  | TransitionZoneClientMessage
  | DropInventoryItemClientMessage;