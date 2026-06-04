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

// ---------------------------------------------------------------------------
// Movement intent (Task 026 — Player Movement Intent Foundation Batch)
//
// Generic across future combat / dungeon / boss rooms: any room that
// wants server-authoritative click-to-move can accept this same
// intent. The server validates shape + range only for now; it does
// not yet move the player, does not broadcast, and does not know
// about maps, collision or pathfinding.
// ---------------------------------------------------------------------------

/**
 * Movement intent sent by the client.
 *
 * `clientTime` is optional and is currently informational only. It
 * lets future server logic reason about intent ordering / latency
 * without trusting the value for any gameplay outcome.
 */
export interface RequestMoveClientMessage {
  readonly type: "request_move";
  readonly targetX: number;
  readonly targetY: number;
  readonly clientTime?: number;
}

/**
 * Basic server-authoritative attack intent foundation.
 *
 * The client may only identify which synced enemy it wants to attack.
 * The server validates presence, enemy existence and range, then decides
 * whether HP changes. No client-sent damage is accepted.
 */
export interface RequestAttackClientMessage {
  readonly type: "request_attack";
  readonly targetEnemyId: string;
}

/**
 * Server-authoritative loot pickup intent.
 *
 * The client may only identify which synced world-loot entry it wants
 * to pick up. The server validates player presence, loot existence and
 * pickup range, then decides whether the loot is removed from room state.
 * No client-side reward authority, inventory write or persistence exists yet.
 */
export interface RequestPickupWorldLootClientMessage {
  readonly type: "request_pickup_world_loot";
  readonly worldLootId: string;
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

/**
 * Task 057 — Interactable Object Foundation Batch
 * Client sends interact request with object id.
 */
export interface RequestInteractClientMessage {
  readonly type: "request_interact";
  readonly objectId: string;
}

export type ClientRoomMessage =
  | MoveToPointClientMessage
  | AttackTargetClientMessage
  | UseBeltSlotClientMessage
  | PickupLootClientMessage
  | MoveInventoryItemClientMessage
  | EquipItemClientMessage
  | UnequipItemClientMessage
  | RequestMoveClientMessage
  | RequestAttackClientMessage
  | RequestPickupWorldLootClientMessage
  | RequestRespawnClientMessage
  | RetrieveCorpseClientMessage
  | ForceRecoverCorpseClientMessage
  | ChatMessageClientMessage
  | TransitionZoneClientMessage
  | DropInventoryItemClientMessage
  | RequestInteractClientMessage;
