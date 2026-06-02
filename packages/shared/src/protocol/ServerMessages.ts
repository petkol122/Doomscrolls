import type { CharacterDetails } from "../character/CharacterTypes";
import type { CharacterCorpseState } from "../character/DeathTypes";
import type { EquipmentLoadout } from "../inventory/EquipmentTypes";
import type { InventoryGrid } from "../inventory/InventoryTypes";
import type { ItemInstance } from "../inventory/ItemTypes";
import type { CharacterId, EntityId, ItemInstanceId, ZoneId } from "../ids";
import type { RoomState, RoomStatePatch } from "../room/RoomStateTypes";

export interface RoomStateSnapshotServerMessage {
  readonly type: "room_state_snapshot";
  readonly state: RoomState;
}

export interface RoomStatePatchServerMessage {
  readonly type: "room_state_patch";
  readonly patch: RoomStatePatch;
}

export interface DamageAppliedServerMessage {
  readonly type: "damage_applied";
  readonly targetEntityId: EntityId;
  readonly sourceEntityId?: EntityId;
  readonly damage: number;
  readonly remainingHp: number;
}

export interface EntityDiedServerMessage {
  readonly type: "entity_died";
  readonly entityId: EntityId;
}

export interface XpGainedServerMessage {
  readonly type: "xp_gained";
  readonly characterId: CharacterId;
  readonly amount: number;
  readonly totalXp: number;
}

export interface LootDroppedServerMessage {
  readonly type: "loot_dropped";
  readonly item: ItemInstance;
  readonly lootEntityId: EntityId;
}

export interface InventoryUpdatedServerMessage {
  readonly type: "inventory_updated";
  readonly inventory: InventoryGrid;
}

export interface EquipmentUpdatedServerMessage {
  readonly type: "equipment_updated";
  readonly equipment: EquipmentLoadout;
}

export interface CharacterUpdatedServerMessage {
  readonly type: "character_updated";
  readonly character: CharacterDetails;
}

export interface PlayerDiedServerMessage {
  readonly type: "player_died";
  readonly characterId: CharacterId;
  readonly corpse: CharacterCorpseState;
}

export interface PlayerRespawnedServerMessage {
  readonly type: "player_respawned";
  readonly characterId: CharacterId;
  readonly zoneId: ZoneId;
}

export interface CorpseRecoveredServerMessage {
  readonly type: "corpse_recovered";
  readonly characterId: CharacterId;
  readonly recoveredItemIds: readonly ItemInstanceId[];
}

export interface ChatMessageServerMessage {
  readonly type: "chat_message";
  readonly fromCharacterId: CharacterId;
  readonly text: string;
}

export interface ZoneTransitionApprovedServerMessage {
  readonly type: "zone_transition_approved";
  readonly characterId: CharacterId;
  readonly targetZoneId: ZoneId;
}

export type ServerErrorCode =
  | "invalid_message"
  | "not_authenticated"
  | "not_authorized"
  | "rate_limited"
  | "invalid_action"
  | "server_error";

export interface ErrorServerMessage {
  readonly type: "error";
  readonly code: ServerErrorCode;
  readonly message: string;
}

export type ServerRoomMessage =
  | RoomStateSnapshotServerMessage
  | RoomStatePatchServerMessage
  | DamageAppliedServerMessage
  | EntityDiedServerMessage
  | XpGainedServerMessage
  | LootDroppedServerMessage
  | InventoryUpdatedServerMessage
  | EquipmentUpdatedServerMessage
  | CharacterUpdatedServerMessage
  | PlayerDiedServerMessage
  | PlayerRespawnedServerMessage
  | CorpseRecoveredServerMessage
  | ChatMessageServerMessage
  | ZoneTransitionApprovedServerMessage
  | ErrorServerMessage;