import type { CharacterDetails } from "../character/CharacterTypes";
import type { CharacterCorpseState } from "../character/DeathTypes";
import type { RequestBuyVendorItemRejectedReason } from "../room/VendorBuyTypes";
import type { RequestSellItemRejectedReason } from "../room/VendorSellTypes";
import type { RequestSalvageItemRejectedReason } from "../room/SalvageTypes";
import type { RequestWithdrawMaterialRejectedReason } from "../room/WithdrawMaterialTypes";
import type { MaterialId } from "../economy/MaterialTypes";
import type { RequestUnlockProfessionRejectedReason } from "../room/ProfessionTrainingTypes";
import type {
  RequestStoreInventoryItemInStashRejectedReason,
  RequestTakeStashItemToInventoryRejectedReason,
  StashItemsListRejectedReason,
} from "../room/StashTypes";
import type {
  AccountStashItemSummary,
  AccountStashListRejectedReason,
  RequestDepositStashItemRejectedReason,
  RequestWithdrawStashItemRejectedReason,
} from "../room/AccountStashTypes";
import type { MoveInventoryItemRejectedReason } from "../inventory/InventoryTypes";
import type { WaypointDestinationEntry, WaypointRejectedReason } from "../room/WaypointTypes";
import type { EquipmentLoadout, FlaskBeltSlotNumber } from "../inventory/EquipmentTypes";
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

// ---------------------------------------------------------------------------
// Enemy attack telegraph (Task 094 / Task 269)
//
// Server-only, time-bound warning sent to the target player right before
// an enemy attack lands. The client must not derive damage outcome from
// this message; the server is the sole authority for whether/when damage
// is applied. The `windupMs` value is informational and describes how
// long the windup phase is expected to last; clients may use it for
// transient visual warning markers only.
//
// Task 269: `attackKind` is now REQUIRED and is part of the explicit
// telegraph protocol. The server must always set it to either
// "normal" or "heavy"; clients consume it from the protocol instead
// of guessing. The field is purely visual (heavy Brute charged
// strike vs normal swing) — outcomes are still server-authoritative.
// ---------------------------------------------------------------------------
export interface EnemyAttackTelegraphServerMessage {
  readonly type: "enemy_attack_telegraph";
  readonly enemyId: string;
  readonly targetEntityId: EntityId;
  readonly windupMs: number;
  readonly attackKind: "normal" | "heavy";
}

export interface EnemyAttackResolvedServerMessage {
  readonly type: "enemy_attack_resolved";
  readonly enemyId: string;
  readonly targetEntityId: EntityId;
  readonly outcome: "hit" | "miss";
  readonly attackKind: "normal" | "heavy";
  readonly damage?: number;
  readonly remainingHp?: number;
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
  readonly level?: number;
  readonly leveledUp?: boolean;
  readonly hp?: number;
  readonly maxHp?: number;
  readonly gainedMaxHp?: number;
  /**
   * Core 0.1 Foundation — Skill Point Allocation. Present only when
   * `leveledUp` is true: 1 point per level gained, and the player's
   * new unallocated total, so the skill panel updates without waiting
   * for a full state resync.
   */
  readonly gainedSkillPoints?: number;
  readonly totalSkillPoints?: number;
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

export interface CorpseInteractRejectedServerMessage {
  readonly type: "corpse_interact_rejected";
  readonly reason: "out_of_range" | "no_corpse" | "player_downed";
}

export interface CorpseInteractAcceptedServerMessage {
  readonly type: "corpse_interact_accepted";
  readonly message: string;
}

export interface CorpseRecoveredServerMessage {
  readonly type: "corpse_recovered";
  readonly characterId: CharacterId;
  readonly recoveredItemIds: readonly ItemInstanceId[];
}

/**
 * Core 0.29 — Room-Local Chat.
 *
 * Broadcast to every client currently connected to the sender's room
 * (the same TownRoom or CombatRoom instance), including the sender
 * itself -- this doubles as the accept signal, so there is no separate
 * `request_chat_accepted`. Carries only what the Core 0.29 field-
 * visibility audit classified as safe to show a third party:
 * `sessionId` (keying only, never displayed), `displayName`, `text`
 * and `sentAt`. Deliberately excludes `classKey`, `level` or any other
 * `PlayerPresence` field. Replaces the earlier `chat_message` server
 * message, which was never wired to any room handler.
 */
export interface ChatMessageServerMessage {
  readonly type: "chat_message";
  readonly sessionId: string;
  readonly displayName: string;
  readonly text: string;
  readonly sentAt: number;
}

/**
 * Core 0.29 — Room-Local Chat.
 *
 * Safe, server-owned rejection reasons for `request_chat` intents. The
 * client never decides message shape, length or rate limiting; the
 * server is the sole authority.
 */
export type RequestChatRejectedReason =
  | "invalid_shape"
  | "empty_message"
  | "message_too_long"
  | "chat_on_cooldown";

export interface RequestChatRejectedServerMessage {
  readonly type: "request_chat_rejected";
  readonly reason: RequestChatRejectedReason;
}

/**
 * Global chat -- sent to every connected player process-wide (see
 * `broadcastToAllConnectedPlayers` in `connectedPlayerRegistry.ts`),
 * not just the sender's own room. Same field-visibility rules as
 * `ChatMessageServerMessage`; this also doubles as its own accept
 * signal, so there is no separate `request_global_chat_accepted`.
 */
export interface GlobalChatMessageServerMessage {
  readonly type: "global_chat_message";
  readonly sessionId: string;
  readonly displayName: string;
  readonly text: string;
  readonly sentAt: number;
}

export interface RequestGlobalChatRejectedServerMessage {
  readonly type: "request_global_chat_rejected";
  readonly reason: RequestChatRejectedReason;
}

/**
 * Sent once, on join, to the joining client only (never broadcast) --
 * the recent tail of the logged global chat history, oldest first, so
 * a player who logs back in sees the conversation instead of an empty
 * log. No `sessionId`: history entries aren't tied to a live session
 * (the sender may no longer be connected).
 */
export interface GlobalChatHistoryServerMessage {
  readonly type: "global_chat_history";
  readonly messages: readonly {
    readonly displayName: string;
    readonly text: string;
    readonly sentAt: number;
  }[];
}

export interface ZoneTransitionApprovedServerMessage {
  readonly type: "zone_transition_approved";
  readonly characterId: CharacterId;
  readonly targetZoneId: ZoneId;
}

export type TownCombatHandoffRejectedReason =
  | "transition_unavailable"
  | "invalid_destination"
  | "duplicate_request"
  | "player_not_ready"
  | "transition_failed";

export interface TownCombatHandoffApprovedServerMessage {
  readonly type: "town_combat_handoff_approved";
  readonly characterId: CharacterId;
  readonly fromRoomKind: "town";
  readonly toRoomKind: "combat";
  readonly targetZoneId: ZoneId;
  readonly targetSpawnKey: string;
  readonly message: string;
}

export interface TownCombatHandoffRejectedServerMessage {
  readonly type: "town_combat_handoff_rejected";
  readonly objectId?: string;
  readonly reason: TownCombatHandoffRejectedReason;
}

export interface CombatTownReturnApprovedServerMessage {
  readonly type: "combat_town_return_approved";
  readonly characterId: CharacterId;
  readonly objectId: string;
  readonly fromRoomKind: "combat";
  readonly toRoomKind: "town";
  readonly targetZoneId: ZoneId;
  readonly targetSpawnKey: string;
  readonly message: string;
}

export interface CombatTownReturnRejectedServerMessage {
  readonly type: "combat_town_return_rejected";
  readonly objectId?: string;
  readonly reason: TownCombatHandoffRejectedReason;
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
  | "player_downed"
  | "target_inside_building";

export interface RequestMoveRejectedServerMessage {
  readonly type: "request_move_rejected";
  readonly reason: RequestMoveRejectedReason;
  readonly clientTime?: number;
}

export type RequestStartBoardObjectiveRejectedReason =
  | "invalid_request"
  | "already_has_active_objective"
  | "objective_not_found"
  | "objective_not_available"
  | "objective_already_completed";

export interface RequestStartBoardObjectiveRejectedServerMessage {
  readonly type: "request_start_board_objective_rejected";
  readonly reason: RequestStartBoardObjectiveRejectedReason;
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

/**
 * Task 095 — Player Dodge Intent Foundation.
 *
 * Safe server-owned rejection reasons for `request_dodge` intents.
 */
export type RequestDodgeRejectedReason =
  | "invalid_shape"
  | "non_finite_direction"
  | "zero_direction"
  | "player_downed"
  | "dodge_on_cooldown";

export interface RequestDodgeRejectedServerMessage {
  readonly type: "request_dodge_rejected";
  readonly reason: RequestDodgeRejectedReason;
}

export interface RequestDodgeAcceptedServerMessage {
  readonly type: "request_dodge_accepted";
}

// ---------------------------------------------------------------------------
// Milestone 0.3 — 4-Slot Flask Belt.
//
// Safe server-owned rejection reasons for `request_use_flask_slot`
// intents. The client never decides whether a slot's charge is usable;
// the server is the only authority for the effect (heal / mana restore /
// dodge-cooldown reset), the cooldown, the charge count, the
// empty-slot / no-charges / cooldown / downed feedback and the resulting
// synced HP / mana / flask-belt state.
// ---------------------------------------------------------------------------
export type RequestUseFlaskSlotRejectedReason =
  | "player_downed"
  | "slot_empty"
  | "no_charges"
  | "flask_on_cooldown"
  | "no_effect";

export interface RequestUseFlaskSlotAcceptedServerMessage {
  readonly type: "request_use_flask_slot_accepted";
  readonly slot: FlaskBeltSlotNumber;
  readonly effectType: string;
  readonly healedAmount: number;
  readonly remainingHp: number;
  readonly remainingMana: number;
  readonly charges: number;
  readonly nextReadyAt: number;
}

export interface RequestUseFlaskSlotRejectedServerMessage {
  readonly type: "request_use_flask_slot_rejected";
  readonly slot: FlaskBeltSlotNumber;
  readonly reason: RequestUseFlaskSlotRejectedReason;
}

export type RequestUseSkillSlotRejectedReason =
  | "player_downed"
  | "skill_on_cooldown"
  | "slot_not_learned"
  | "skill_unavailable"
  | "enemy_not_found"
  | "enemy_defeated"
  | "out_of_range"
  // Core 0.1 Foundation — Mana/Resource System. The caster's mana pool
  // did not cover the skill's manaCost; the cast is rejected and no
  // mana, cooldown or damage is applied.
  | "insufficient_mana"
  // Milestone 0.2 — a "ground_aoe" cast arrived without a finite
  // targetX/targetY ground point.
  | "invalid_ground_target";

export interface RequestUseSkillSlotAcceptedServerMessage {
  readonly type: "request_use_skill_slot_accepted";
  readonly slot: "primary" | "secondary" | "tertiary";
  readonly targetEnemyId: string;
  readonly damage: number;
  readonly remainingHp: number;
  readonly defeated: boolean;
  readonly nextReadyAt: number;
  /**
   * Core 0.1 Foundation — the caster's mana pool immediately after this
   * cast's cost was deducted. Lets the client reconcile its HUD without
   * waiting for the next full state sync, mirroring how healing-flask
   * accept messages already carry `remainingHp`.
   */
  readonly remainingMana: number;
}

export interface RequestUseSkillSlotRejectedServerMessage {
  readonly type: "request_use_skill_slot_rejected";
  readonly slot: "primary" | "secondary" | "tertiary";
  readonly reason: RequestUseSkillSlotRejectedReason;
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
  readonly itemLabel?: string;
  readonly rarity?: string;
  /** Milestone 0.3 -- the rolled instance tier, preferred over `rarity`
   *  for display when present (see `affixRollEngine.ts`). */
  readonly rarityTier?: string;
  /**
   * Set when the picked-up world-loot was a currency drop. The amount
   * is the copper gained by the character. Absent (undefined) for
   * item pickups. The client may use this to display pickup-specific
   * feedback; the new total is always re-read from `/me`.
   */
  readonly currencyCopper?: number;
  readonly totalMoneyCopper?: number;
  /**
   * Server-formatted compact money text for the gained amount. Set
   * only for currency world-loot pickups. The client MUST prefer this
   * value when displaying pickup feedback so the same shared
   * `formatMoneyCompact` helper is used everywhere money is shown.
   */
  readonly formattedMoneyText?: string;
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
  /**
   * Task 348 — Notice board objective catalog foundation.
   * When the notice board responds with available objectives (player has
   * no active objective), this field contains the list of objectives the
   * player can start. Each entry includes the objective id and the
   * localization key for the title.
   */
  readonly availableObjectives?: readonly {
    readonly objectiveId: string;
    readonly titleKey: string;
    readonly descriptionKey: string;
  }[];
  /**
   * Core 0.1 — Persistent Quest & Dialogue System foundation. Present
   * when the interacted object is a "quest_giver": the quest it offers
   * and the character's current persisted status for it, so the client
   * dialogue view can show the right greeting/turn-in copy and choices.
   */
  readonly questInfo?: {
    readonly questId: string;
    readonly status: "available" | "accepted" | "completed";
    readonly titleKey: string;
    readonly descriptionKey: string;
    readonly xpReward: number;
    readonly copperReward: number;
  };
}

export interface ObjectiveUpdatedServerMessage {
  readonly type: "objective_updated";
  // Core 0.15 -- which of the two concurrent objective slots this update
  // is for. Required: every emitter in this build is updated to pass it.
  readonly slot: 1 | 2;
  readonly objectiveId: string;
  readonly label: string;
  readonly descriptionKey?: string;
  readonly current: number;
  readonly target: number;
  readonly completed: boolean;
  readonly readyToTurnIn?: boolean;
  readonly xpReward?: number;
  readonly copperReward?: number;
}

// ---------------------------------------------------------------------------
// Currency pickup feedback (Task 185)
//
// Sent to the originating client after a currency world-loot drop has
// been picked up and the character's `moneyCopper` total has been
// updated in the database. The client uses `gainedCopper` for
// transient pickup feedback and then refreshes `/me` to read the
// authoritative `totalMoneyCopper` for HUD / overlay rendering.
// ---------------------------------------------------------------------------
export interface CurrencyPickedUpServerMessage {
  readonly type: "currency_picked_up";
  readonly characterId: CharacterId;
  readonly gainedCopper: number;
  readonly totalMoneyCopper: number;
}

// ---------------------------------------------------------------------------
// Task 299 — Town Rest Refill Foundation.
//
// Sent to the joining client after the server has restored HP and healing
// flask charges to their maximum values on entering a valid town zone.
// The client must not derive the refill values from this message; the
// synced Colyseus schema state is the source of truth for display.
// ---------------------------------------------------------------------------
export interface TownRestRefillServerMessage {
  readonly type: "town_rest_refill";
  readonly restoredHp: number;
  readonly restoredFlaskCharges: number;
}

// ---------------------------------------------------------------------------
// Task 319 — Vendor Foundation: Server-Authoritative Buy Item.
//
// Server sends accepted/rejected feedback after validating a vendor buy
// request. The client never decides the price or item placement.
// ---------------------------------------------------------------------------
export interface RequestBuyVendorItemAcceptedServerMessage {
  readonly type: "request_buy_vendor_item_accepted";
  readonly stockEntryId: string;
  readonly itemId: string;
  readonly priceCopper: number;
  readonly remainingCopper: number;
}

export interface RequestBuyVendorItemRejectedServerMessage {
  readonly type: "request_buy_vendor_item_rejected";
  readonly reason: RequestBuyVendorItemRejectedReason;
  readonly stockEntryId?: string;
}

// ---------------------------------------------------------------------------
// Task 320 — Vendor Foundation: Server-Authoritative Sell Item.
//
// Server sends accepted/rejected feedback after validating a vendor sell
// request. The client never decides the sell price.
// ---------------------------------------------------------------------------
export interface RequestSellItemAcceptedServerMessage {
  readonly type: "request_sell_item_accepted";
  readonly itemInstanceId: string;
  readonly definitionId: string;
  readonly sellPriceCopper: number;
  readonly remainingCopper: number;
}

export interface RequestSellItemRejectedServerMessage {
  readonly type: "request_sell_item_rejected";
  readonly reason: RequestSellItemRejectedReason;
  readonly itemInstanceId?: string;
}

// ---------------------------------------------------------------------------
// Milestone 0.3 -- Pawn Shop / Army Surplus Vendor: Salvage & Tech Teardown.
//
// Server sends accepted/rejected feedback after validating a salvage
// request. The client never decides the resulting material.
// ---------------------------------------------------------------------------
export interface RequestSalvageItemAcceptedServerMessage {
  readonly type: "request_salvage_item_accepted";
  readonly itemInstanceId: string;
  readonly definitionId: string;
  readonly materialItemId: MaterialId;
  readonly materialQuantity: number;
  /** New balance of `materialItemId` after this salvage, so the HUD can update without waiting on a full refresh. */
  readonly newMaterialBalance: number;
}

export interface RequestSalvageItemRejectedServerMessage {
  readonly type: "request_salvage_item_rejected";
  readonly reason: RequestSalvageItemRejectedReason;
  readonly itemInstanceId?: string;
}

// ---------------------------------------------------------------------------
// Withdraw a chosen quantity of a salvage-material currency balance back
// into a physical, tradeable inventory item stack (see `MaterialTypes.ts`
// and `withdrawMaterialItem.ts`).
// ---------------------------------------------------------------------------
export interface RequestWithdrawMaterialAcceptedServerMessage {
  readonly type: "request_withdraw_material_accepted";
  readonly materialId: MaterialId;
  readonly quantity: number;
  readonly newMaterialBalance: number;
}

export interface RequestWithdrawMaterialRejectedServerMessage {
  readonly type: "request_withdraw_material_rejected";
  readonly reason: RequestWithdrawMaterialRejectedReason;
}

// ---------------------------------------------------------------------------
// Milestone 0.3 -- Profession Training System.
//
// Server sends accepted/rejected feedback after validating an unlock/
// rank-up request. The client never decides the tier cost.
// ---------------------------------------------------------------------------
export interface RequestUnlockProfessionAcceptedServerMessage {
  readonly type: "request_unlock_profession_accepted";
  readonly professionId: string;
  readonly newTier: number;
  readonly costCopper: number;
  readonly remainingCopper: number;
}

export interface RequestUnlockProfessionRejectedServerMessage {
  readonly type: "request_unlock_profession_rejected";
  readonly reason: RequestUnlockProfessionRejectedReason;
  readonly professionId?: string;
}

export interface StashItemsListedServerMessage {
  readonly type: "stash_items_listed";
  readonly objectId: string;
  readonly serviceId: string;
  readonly items: readonly ItemInstance[];
}

export interface StashItemsListRejectedServerMessage {
  readonly type: "stash_items_list_rejected";
  readonly objectId: string;
  readonly serviceId: string;
  readonly reason: StashItemsListRejectedReason;
}

export interface RequestStoreInventoryItemInStashAcceptedServerMessage {
  readonly type: "request_store_inventory_item_in_stash_accepted";
  readonly serviceId: string;
  readonly itemInstanceId: string;
  readonly stashItems: readonly ItemInstance[];
}

export interface RequestStoreInventoryItemInStashRejectedServerMessage {
  readonly type: "request_store_inventory_item_in_stash_rejected";
  readonly serviceId: string;
  readonly itemInstanceId?: string;
  readonly reason: RequestStoreInventoryItemInStashRejectedReason;
}

export interface RequestTakeStashItemToInventoryAcceptedServerMessage {
  readonly type: "request_take_stash_item_to_inventory_accepted";
  readonly serviceId: string;
  readonly itemInstanceId: string;
  readonly stashItems: readonly ItemInstance[];
}

export interface RequestTakeStashItemToInventoryRejectedServerMessage {
  readonly type: "request_take_stash_item_to_inventory_rejected";
  readonly serviceId: string;
  readonly itemInstanceId?: string;
  readonly reason: RequestTakeStashItemToInventoryRejectedReason;
}

/**
 * Milestone 0.2 — Inventory Grid Repositioning: the server is the sole
 * authority on slot placement; the accepted message carries the item id
 * only, the client re-fetches account state for the persisted grid.
 */
export interface MoveInventoryItemAcceptedServerMessage {
  readonly type: "move_inventory_item_accepted";
  readonly itemInstanceId: string;
}

export interface MoveInventoryItemRejectedServerMessage {
  readonly type: "move_inventory_item_rejected";
  readonly itemInstanceId?: string;
  readonly reason: MoveInventoryItemRejectedReason;
}

/**
 * Milestone 0.2 — Account Stash Foundation network contract. Separate
 * from the per-character `StashItemsListedServerMessage` family above.
 */
export interface AccountStashListedServerMessage {
  readonly type: "account_stash_listed";
  readonly items: readonly AccountStashItemSummary[];
}

export interface AccountStashListRejectedServerMessage {
  readonly type: "account_stash_list_rejected";
  readonly reason: AccountStashListRejectedReason;
}

export interface RequestDepositStashItemAcceptedServerMessage {
  readonly type: "request_deposit_stash_item_accepted";
  readonly itemInstanceId: string;
  readonly stashItems: readonly AccountStashItemSummary[];
}

export interface RequestDepositStashItemRejectedServerMessage {
  readonly type: "request_deposit_stash_item_rejected";
  readonly itemInstanceId?: string;
  readonly reason: RequestDepositStashItemRejectedReason;
}

export interface RequestWithdrawStashItemAcceptedServerMessage {
  readonly type: "request_withdraw_stash_item_accepted";
  readonly stashItemId: string;
  readonly stashItems: readonly AccountStashItemSummary[];
}

export interface RequestWithdrawStashItemRejectedServerMessage {
  readonly type: "request_withdraw_stash_item_rejected";
  readonly stashItemId?: string;
  readonly reason: RequestWithdrawStashItemRejectedReason;
}

export interface WaypointOpenedServerMessage {
  readonly type: "waypoint_opened";
  readonly objectId: string;
  readonly waypointId: string;
  readonly activated: boolean;
  readonly destinations: readonly WaypointDestinationEntry[];
}

export interface RequestWaypointTravelAcceptedServerMessage {
  readonly type: "request_waypoint_travel_accepted";
  readonly waypointId: string;
  readonly zoneId: ZoneId;
  readonly x: number;
  readonly y: number;
  readonly message: string;
}

export interface RequestWaypointTravelRejectedServerMessage {
  readonly type: "request_waypoint_travel_rejected";
  readonly waypointId?: string;
  readonly reason: WaypointRejectedReason;
}

export type RequestRouteTravelRejectedReason =
  | "route_unavailable"
  | "destination_unavailable"
  | "invalid_destination"
  | "travel_failed";

export interface RequestRouteTravelAcceptedServerMessage {
  readonly type: "request_route_travel_accepted";
  readonly objectId: string;
  readonly zoneId: ZoneId;
  readonly x: number;
  readonly y: number;
  readonly message: string;
  readonly areaLabel: string;
}

export interface RequestRouteTravelRejectedServerMessage {
  readonly type: "request_route_travel_rejected";
  readonly objectId?: string;
  readonly reason: RequestRouteTravelRejectedReason;
}

// ---------------------------------------------------------------------------
// Core 0.1 — Persistent Quest & Dialogue System foundation.
//
// Quest accept/complete state is persisted per character (see
// CharacterQuest / QuestRepository) and survives scene restarts and
// rejoins. `quest_state` is sent once, on join, with every quest the
// character has accepted or completed; `quest_updated` is sent after a
// successful accept/complete so the dialogue view and any quest log can
// update without a full rejoin.
// ---------------------------------------------------------------------------
export type QuestStatus = "accepted" | "completed";

export interface QuestStateServerMessage {
  readonly type: "quest_state";
  readonly quests: readonly {
    readonly questId: string;
    readonly status: QuestStatus;
  }[];
}

export interface QuestUpdatedServerMessage {
  readonly type: "quest_updated";
  readonly questId: string;
  readonly status: QuestStatus;
}

export type RequestAcceptQuestRejectedReason =
  | "invalid_request"
  | "quest_not_found"
  | "already_accepted"
  | "already_completed";

export interface RequestAcceptQuestRejectedServerMessage {
  readonly type: "request_accept_quest_rejected";
  readonly questId?: string;
  readonly reason: RequestAcceptQuestRejectedReason;
}

export type RequestCompleteQuestRejectedReason =
  | "invalid_request"
  | "quest_not_found"
  | "not_accepted"
  | "already_completed";

export interface RequestCompleteQuestRejectedServerMessage {
  readonly type: "request_complete_quest_rejected";
  readonly questId?: string;
  readonly reason: RequestCompleteQuestRejectedReason;
}

// ---------------------------------------------------------------------------
// Core 0.1 Foundation — Skill Point Allocation.
//
// Server sends accepted/rejected feedback after validating a
// `request_allocate_skill_point` intent. The client never decides
// whether a point is available or how much a rank increases damage by;
// the server is the sole authority and persists the resulting rank.
// ---------------------------------------------------------------------------
export type RequestAllocateSkillPointRejectedReason =
  | "invalid_slot"
  | "no_points_available"
  | "rank_maxed";

export interface RequestAllocateSkillPointAcceptedServerMessage {
  readonly type: "request_allocate_skill_point_accepted";
  readonly slot: "primary" | "secondary" | "tertiary";
  readonly skillId: string;
  readonly newRank: number;
  readonly remainingSkillPoints: number;
}

export interface RequestAllocateSkillPointRejectedServerMessage {
  readonly type: "request_allocate_skill_point_rejected";
  readonly slot: "primary" | "secondary" | "tertiary";
  readonly reason: RequestAllocateSkillPointRejectedReason;
}

export type ServerRoomMessage =
  | RoomStateSnapshotServerMessage
  | RoomStatePatchServerMessage
  | DamageAppliedServerMessage
  | EnemyAttackTelegraphServerMessage
  | EnemyAttackResolvedServerMessage
  | EntityDiedServerMessage
  | XpGainedServerMessage
  | LootDroppedServerMessage
  | InventoryUpdatedServerMessage
  | EquipmentUpdatedServerMessage
  | CharacterUpdatedServerMessage
  | PlayerDiedServerMessage
  | PlayerRespawnedServerMessage
  | CorpseInteractRejectedServerMessage
  | CorpseInteractAcceptedServerMessage
  | CorpseRecoveredServerMessage
  | ChatMessageServerMessage
  | GlobalChatMessageServerMessage
  | GlobalChatHistoryServerMessage
  | TownCombatHandoffApprovedServerMessage
  | TownCombatHandoffRejectedServerMessage
  | CombatTownReturnApprovedServerMessage
  | CombatTownReturnRejectedServerMessage
  | ZoneTransitionApprovedServerMessage
  | RequestMoveRejectedServerMessage
  | RequestAttackAcceptedServerMessage
  | RequestAttackRejectedServerMessage
  | RequestPickupWorldLootAcceptedServerMessage
  | RequestPickupWorldLootRejectedServerMessage
  | DeferredActionQueuedServerMessage
  | InteractResponseServerMessage
  | ObjectiveUpdatedServerMessage
  | RequestDodgeAcceptedServerMessage
  | RequestDodgeRejectedServerMessage
  | RequestUseFlaskSlotAcceptedServerMessage
  | RequestUseFlaskSlotRejectedServerMessage
  | RequestUseSkillSlotAcceptedServerMessage
  | RequestUseSkillSlotRejectedServerMessage
  | CurrencyPickedUpServerMessage
  | TownRestRefillServerMessage
  | RequestBuyVendorItemAcceptedServerMessage
  | RequestBuyVendorItemRejectedServerMessage
  | RequestSellItemAcceptedServerMessage
  | RequestSellItemRejectedServerMessage
  | RequestSalvageItemAcceptedServerMessage
  | RequestSalvageItemRejectedServerMessage
  | RequestWithdrawMaterialAcceptedServerMessage
  | RequestWithdrawMaterialRejectedServerMessage
  | RequestUnlockProfessionAcceptedServerMessage
  | RequestUnlockProfessionRejectedServerMessage
  | StashItemsListedServerMessage
  | StashItemsListRejectedServerMessage
  | RequestStoreInventoryItemInStashAcceptedServerMessage
  | RequestStoreInventoryItemInStashRejectedServerMessage
  | RequestTakeStashItemToInventoryAcceptedServerMessage
  | RequestTakeStashItemToInventoryRejectedServerMessage
  | MoveInventoryItemAcceptedServerMessage
  | MoveInventoryItemRejectedServerMessage
  | AccountStashListedServerMessage
  | AccountStashListRejectedServerMessage
  | RequestDepositStashItemAcceptedServerMessage
  | RequestDepositStashItemRejectedServerMessage
  | RequestWithdrawStashItemAcceptedServerMessage
  | RequestWithdrawStashItemRejectedServerMessage
  | WaypointOpenedServerMessage
  | RequestWaypointTravelAcceptedServerMessage
  | RequestWaypointTravelRejectedServerMessage
  | RequestRouteTravelAcceptedServerMessage
  | RequestRouteTravelRejectedServerMessage
  | RequestStartBoardObjectiveRejectedServerMessage
  | QuestStateServerMessage
  | QuestUpdatedServerMessage
  | RequestAcceptQuestRejectedServerMessage
  | RequestCompleteQuestRejectedServerMessage
  | RequestAllocateSkillPointAcceptedServerMessage
  | RequestAllocateSkillPointRejectedServerMessage
  | RequestChatRejectedServerMessage
  | RequestGlobalChatRejectedServerMessage
  | ErrorServerMessage;
