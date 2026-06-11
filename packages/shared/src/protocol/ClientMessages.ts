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

/**
 * Task 095 — Player Dodge Intent Foundation.
 *
 * The client may only identify a desired unit direction (`dirX`, `dirY`)
 * in which the player wants to roll. The server is the sole authority
 * for whether the dodge happens, how far the player moves, and whether
 * it interacts with combat telegraphs. The server never accepts
 * client-sent damage, kills, XP, loot, inventory changes, equipment
 * changes, level-up or quest completion.
 */
export interface RequestDodgeClientMessage {
  readonly type: "request_dodge";
  readonly dirX: number;
  readonly dirY: number;
}

// ---------------------------------------------------------------------------
// Task 096 — Basic Healing Flask Foundation.
//
// Minimal client intent to ask the server to consume a healing-flask charge.
// The client never decides whether the flask is usable, never tells the
// server how much to heal and never tracks flask charges locally for any
// gameplay outcome: the server is the sole authority for charge counts,
// cooldown, heal amount, and the resulting HP state.
// ---------------------------------------------------------------------------
export interface RequestUseHealingFlaskClientMessage {
  readonly type: "request_use_healing_flask";
}

/**
 * Task 217 — First Real Right-Click Skill Batch.
 *
 * The client may identify which synced enemy it wants to target with the
 * RMB skill slot. `targetEnemyId` is optional; when omitted the server
 * may reject with "skill_unavailable" or use a fallback (currently none).
 * The server validates presence, target existence, range and cooldown,
 * then applies server-authoritative damage. No client-sent damage is accepted.
 */
export interface RequestUseSkillSlotClientMessage {
  readonly type: "request_use_skill_slot";
  readonly slot: "secondary";
  readonly targetEnemyId?: string;
}

export interface RequestCorpseInteractClientMessage {
  readonly type: "request_corpse_interact";
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

export interface RequestResetObjectiveClientMessage {
  readonly type: "request_reset_objective";
}

/**
 * Task 319 — Vendor Foundation: Server-Authoritative Buy Item.
 *
 * Client sends a buy request with the vendor stock entry id.
 * The server validates vendor existence, stock membership, price,
 * player currency and inventory space. No client-sent price or
 * item id is accepted.
 */
export interface RequestBuyVendorItemClientMessage {
  readonly type: "request_buy_vendor_item";
  readonly vendorId: string;
  readonly stockEntryId: string;
}

/**
 * Task 320 — Vendor Foundation: Server-Authoritative Sell Item.
 *
 * Client sends a sell request with the vendor id and the item instance
 * id of the inventory item to sell. The server validates ownership,
 * equipment state, sellability and price. No client-sent price is accepted.
 */
export interface RequestSellItemClientMessage {
  readonly type: "request_sell_item";
  readonly vendorId: string;
  readonly itemInstanceId: string;
}

/**
 * Task 329 — Stash Foundation: Server-authoritative inventory -> stash transfer.
 */
export interface RequestStoreInventoryItemInStashClientMessage {
  readonly type: "request_store_inventory_item_in_stash";
  readonly serviceId: string;
  readonly itemInstanceId: string;
  readonly pageIndex?: number;
  readonly x?: number;
  readonly y?: number;
}

/**
 * Task 329 — Stash Foundation: Server-authoritative stash -> inventory transfer.
 */
export interface RequestTakeStashItemToInventoryClientMessage {
  readonly type: "request_take_stash_item_to_inventory";
  readonly serviceId: string;
  readonly itemInstanceId: string;
}

export interface RequestWaypointTravelClientMessage {
  readonly type: "request_waypoint_travel";
  readonly waypointId: string;
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
  | RequestCorpseInteractClientMessage
  | RequestRespawnClientMessage
  | RetrieveCorpseClientMessage
  | ForceRecoverCorpseClientMessage
  | ChatMessageClientMessage
  | TransitionZoneClientMessage
  | DropInventoryItemClientMessage
  | RequestInteractClientMessage
  | RequestResetObjectiveClientMessage
  | RequestDodgeClientMessage
  | RequestUseHealingFlaskClientMessage
  | RequestUseSkillSlotClientMessage
  | RequestBuyVendorItemClientMessage
  | RequestSellItemClientMessage
  | RequestStoreInventoryItemInStashClientMessage
  | RequestTakeStashItemToInventoryClientMessage
  | RequestWaypointTravelClientMessage;
