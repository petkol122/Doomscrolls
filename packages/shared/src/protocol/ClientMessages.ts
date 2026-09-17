import type { CharacterId, EntityId, ItemInstanceId, ZoneId } from "../ids";
import type { Vector2 } from "../math/Vector2";
import type { MoveInventoryItemPayload } from "../inventory/InventoryTypes";
import type { EquipItemPayload, FlaskBeltSlotNumber, UnequipItemPayload } from "../inventory/EquipmentTypes";

export interface MoveToPointClientMessage {
  readonly type: "move_to_point";
  readonly target: Vector2;
}

export interface AttackTargetClientMessage {
  readonly type: "attack_target";
  readonly targetEntityId: EntityId;
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
// Milestone 0.3 — 4-Slot Flask Belt.
//
// Minimal client intent to ask the server to consume a charge from one of
// the four flask belt slots (hotkeys 1-4). The client never decides
// whether the slot is usable, never tells the server what effect it has
// and never tracks charges locally for any gameplay outcome: the server
// is the sole authority for charge counts, cooldown, the equipped item's
// effect, and the resulting HP/mana/dodge-cooldown state.
// ---------------------------------------------------------------------------
export interface RequestUseFlaskSlotClientMessage {
  readonly type: "request_use_flask_slot";
  readonly slot: FlaskBeltSlotNumber;
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
  readonly slot: "primary" | "secondary" | "tertiary";
  readonly targetEnemyId?: string;
  /**
   * Milestone 0.2 -- Server-Authoritative Projectiles & Ground-Targeted
   * AoE Skills. Used instead of `targetEnemyId` for a `ground_aoe` skill
   * (the caster clicks a ground point rather than an enemy).
   */
  readonly targetX?: number;
  readonly targetY?: number;
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

/**
 * Core 0.29 — Room-Local Chat.
 *
 * The client may only supply the message text. The server is the sole
 * authority for the sender's identity (resolved server-side from the
 * connected player's own PlayerPresence, never trusted from the
 * client), message length, and rate limiting. Replaces the earlier
 * `chat_message` client message, which was never wired to any room
 * handler.
 */
export interface RequestChatClientMessage {
  readonly type: "request_chat";
  readonly text: string;
}

/**
 * Global chat -- reaches every connected player regardless of which
 * room (Town zone or Combat zone) they're currently in, unlike
 * `RequestChatClientMessage` which only reaches the sender's own room.
 * Same shape and validation rules (trim, non-empty, length cap) as
 * room-local chat; only the `type` (and therefore the routing/scope)
 * differs.
 */
export interface RequestGlobalChatClientMessage {
  readonly type: "request_global_chat";
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
  // Core 0.15 -- which of the two concurrent objective slots to reset.
  readonly slot: 1 | 2;
}

/**
 * Task 348 — Notice board objective catalog foundation.
 *
 * The client sends the desired objective ID to start when the player
 * selects an available objective from the notice board catalog.
 * The server validates that the objective exists, is available, and
 * that the player does not already have an incompatible active objective.
 */
export interface RequestStartBoardObjectiveClientMessage {
  readonly type: "request_start_board_objective";
  readonly objectiveId: string;
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
 * Milestone 0.3 -- Pawn Shop / Army Surplus Vendor: Salvage & Tech
 * Teardown. Client sends a salvage request with the vendor id and the
 * item instance id of the inventory item to break down. The server
 * validates ownership/equipment state and decides the resulting
 * material -- no client-sent material choice is accepted.
 */
export interface RequestSalvageItemClientMessage {
  readonly type: "request_salvage_item";
  readonly vendorId: string;
  readonly itemInstanceId: string;
}

/**
 * Client sends a request to convert a chosen quantity of a salvage-
 * material currency balance (see `MaterialTypes.ts`) back into a
 * physical, tradeable inventory item stack. The server is the sole
 * authority on whether the balance/inventory space allow it.
 */
export interface RequestWithdrawMaterialClientMessage {
  readonly type: "request_withdraw_material";
  readonly materialId: string;
  readonly quantity: number;
}

/**
 * Milestone 0.3 -- Profession Training System. Client sends an unlock/
 * rank-up request naming the profession id; the server is the sole
 * authority on the next tier's cost and whether the character can
 * afford it.
 */
export interface RequestUnlockProfessionClientMessage {
  readonly type: "request_unlock_profession";
  readonly vendorId: string;
  readonly professionId: string;
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

/**
 * Milestone 0.2 — Account Stash Foundation: deposit an inventory item
 * into the account-wide stash (keyed by userId, shared across characters).
 */
export interface RequestDepositStashItemClientMessage {
  readonly type: "request_deposit_stash_item";
  readonly itemInstanceId: string;
  readonly quantity?: number;
}

/**
 * Milestone 0.2 — Account Stash Foundation: withdraw a stack from the
 * account-wide stash into the current character's inventory.
 */
export interface RequestWithdrawStashItemClientMessage {
  readonly type: "request_withdraw_stash_item";
  readonly stashItemId: string;
  readonly quantity?: number;
}

/** Milestone 0.2 — Request the current account-wide stash contents. */
export interface RequestListAccountStashClientMessage {
  readonly type: "request_list_account_stash";
}

export interface RequestWaypointTravelClientMessage {
  readonly type: "request_waypoint_travel";
  readonly waypointId: string;
}

export interface RequestCombatReturnClientMessage {
  readonly type: "request_combat_return";
  readonly objectId: string;
}

/**
 * Core 0.1 — Persistent Quest & Dialogue System foundation.
 *
 * The client sends the quest id it wants to accept from a quest-giver's
 * dialogue. The server validates the quest exists and is not already
 * accepted or completed before persisting it.
 */
export interface RequestAcceptQuestClientMessage {
  readonly type: "request_accept_quest";
  readonly questId: string;
}

/**
 * The client sends the quest id it wants to turn in from a quest-giver's
 * dialogue. The server validates the quest is accepted (and not already
 * completed) before granting rewards and persisting completion.
 */
export interface RequestCompleteQuestClientMessage {
  readonly type: "request_complete_quest";
  readonly questId: string;
}

/**
 * Core 0.1 Foundation — Skill Point Allocation.
 *
 * The client identifies which skill slot ("primary" | "secondary" |
 * "tertiary") it wants to spend an unallocated skill point on. The
 * server is the sole authority for whether the player has points
 * available, resolves which real skill id that slot maps to for the
 * player's own class, and persists the resulting rank.
 */
export interface RequestAllocateSkillPointClientMessage {
  readonly type: "request_allocate_skill_point";
  readonly slot: "primary" | "secondary" | "tertiary";
}

export type ClientRoomMessage =
  | MoveToPointClientMessage
  | AttackTargetClientMessage
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
  | RequestChatClientMessage
  | RequestGlobalChatClientMessage
  | TransitionZoneClientMessage
  | DropInventoryItemClientMessage
  | RequestInteractClientMessage
  | RequestResetObjectiveClientMessage
  | RequestStartBoardObjectiveClientMessage
  | RequestDodgeClientMessage
  | RequestUseFlaskSlotClientMessage
  | RequestUseSkillSlotClientMessage
  | RequestBuyVendorItemClientMessage
  | RequestSellItemClientMessage
  | RequestSalvageItemClientMessage
  | RequestWithdrawMaterialClientMessage
  | RequestUnlockProfessionClientMessage
  | RequestStoreInventoryItemInStashClientMessage
  | RequestTakeStashItemToInventoryClientMessage
  | RequestDepositStashItemClientMessage
  | RequestWithdrawStashItemClientMessage
  | RequestListAccountStashClientMessage
  | RequestWaypointTravelClientMessage
  | RequestCombatReturnClientMessage
  | RequestAcceptQuestClientMessage
  | RequestCompleteQuestClientMessage
  | RequestAllocateSkillPointClientMessage;
