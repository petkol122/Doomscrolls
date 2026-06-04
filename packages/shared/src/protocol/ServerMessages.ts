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
  readonly hp: number;
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

// ---------------------------------------------------------------------------
// Movement intent acknowledgement / rejection (Task 026)
//
// Intent validation only — the server does not yet move the player,
// does not broadcast, and does not know about maps, collision or
// pathfinding. A `request_move_rejected` message is sent back to the
// originating client when the intent shape/range is invalid; there is
// no positive acknowledgement yet because there is no movement
// simulation to acknowledge.
// ---------------------------------------------------------------------------

/**
 * Safe, server-owned rejection reasons for `request_move` intents.
 *
 * The client never decides whether a movement intent is valid; the
 * server validates shape and range and may reject with one of these
 * reasons. The reasons are intentionally generic across future
 * combat / dungeon / boss rooms.
 */
export type RequestMoveRejectedReason =
  | "invalid_shape"
  | "non_finite_target"
  | "out_of_range"
  | "player_downed";

export interface RequestMoveRejectedServerMessage {
  readonly type: "request_move_rejected";
  readonly reason: RequestMoveRejectedReason;
  readonly clientTime?: number;
}

export type RequestAttackRejectedReason =
  | "player_not_ready"
  | "player_downed"
  | "attack_on_cooldown"
  | "enemy_not_found"
  | "enemy_defeated"
  | "out_of_range";

export interface RequestAttackAcceptedServerMessage {
  readonly type: "request_attack_accepted";
  readonly targetEnemyId: string;
}

export interface RequestAttackRejectedServerMessage {
  readonly type: "request_attack_rejected";
  readonly reason: RequestAttackRejectedReason;
  readonly targetEnemyId?: string;
}

export type RequestPickupWorldLootRejectedReason =
  | "player_not_ready"
  | "player_downed"
  | "world_loot_not_found"
  | "inventory_full"
  | "out_of_range";

export interface RequestPickupWorldLootAcceptedServerMessage {
  readonly type: "request_pickup_world_loot_accepted";
  readonly worldLootId: string;
  readonly message: string;
}

export interface RequestPickupWorldLootRejectedServerMessage {
  readonly type: "request_pickup_world_loot_rejected";
  readonly reason: RequestPickupWorldLootRejectedReason;
  readonly worldLootId?: string;
}

export interface DeferredActionQueuedServerMessage {
  readonly type: "deferred_action_queued";
  readonly actionType: "attack" | "interact" | "pickup";
  readonly targetId: string;
  readonly message: string;
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

/**
 * Task 057 — Interactable Object Foundation Batch
 * Server sends interact response with a safe message.
 */
export interface InteractResponseServerMessage {
  readonly type: "interact_response";
  readonly objectId: string;
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
  | RequestMoveRejectedServerMessage
  | RequestAttackAcceptedServerMessage
  | RequestAttackRejectedServerMessage
  | RequestPickupWorldLootAcceptedServerMessage
  | RequestPickupWorldLootRejectedServerMessage
  | DeferredActionQueuedServerMessage
  | InteractResponseServerMessage
  | ErrorServerMessage;
