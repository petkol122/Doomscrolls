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

// ---------------------------------------------------------------------------
// Enemy attack telegraph (Task 094)
//
// Server-only, time-bound warning sent to the target player right before
// an enemy attack lands. The client must not derive damage outcome from
// this message; the server is the sole authority for whether/when damage
// is applied. The `windupMs` value is informational and describes how
// long the windup phase is expected to last; clients may use it for
// transient visual warning markers only.
// ---------------------------------------------------------------------------
export interface EnemyAttackTelegraphServerMessage {
  readonly type: "enemy_attack_telegraph";
  readonly enemyId: string;
  readonly targetEntityId: EntityId;
  readonly windupMs: number;
  readonly attackKind?: "normal" | "heavy";
}

export interface EnemyAttackResolvedServerMessage {
  readonly type: "enemy_attack_resolved";
  readonly enemyId: string;
  readonly targetEntityId: EntityId;
  readonly outcome: "hit" | "miss";
  readonly attackKind?: "normal" | "heavy";
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
// Task 096 — Basic Healing Flask Foundation.
//
// Safe server-owned rejection reasons for `request_use_healing_flask`
// intents. The client never decides whether a flask charge is usable;
// the server is the only authority for the heal, the cooldown, the
// charge count, the full-HP / no-charges / cooldown / downed feedback
// and the resulting synced HP / flask state.
// ---------------------------------------------------------------------------
export type RequestUseHealingFlaskRejectedReason =
  | "player_downed"
  | "already_full_hp"
  | "no_charges"
  | "flask_on_cooldown";

export interface RequestUseHealingFlaskAcceptedServerMessage {
  readonly type: "request_use_healing_flask_accepted";
  readonly healedAmount: number;
  readonly remainingHp: number;
  readonly flaskCharges: number;
  readonly nextFlaskAt: number;
}

export interface RequestUseHealingFlaskRejectedServerMessage {
  readonly type: "request_use_healing_flask_rejected";
  readonly reason: RequestUseHealingFlaskRejectedReason;
}

export type RequestUseSkillSlotRejectedReason =
  | "player_downed"
  | "skill_on_cooldown"
  | "slot_not_learned"
  | "skill_unavailable"
  | "enemy_not_found"
  | "enemy_defeated"
  | "out_of_range";

export interface RequestUseSkillSlotAcceptedServerMessage {
  readonly type: "request_use_skill_slot_accepted";
  readonly slot: "secondary";
  readonly targetEnemyId: string;
  readonly damage: number;
  readonly remainingHp: number;
  readonly defeated: boolean;
  readonly nextReadyAt: number;
}

export interface RequestUseSkillSlotRejectedServerMessage {
  readonly type: "request_use_skill_slot_rejected";
  readonly slot: "secondary";
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
}

export interface ObjectiveUpdatedServerMessage {
  readonly type: "objective_updated";
  readonly objectiveId: string;
  readonly label: string;
  readonly current: number;
  readonly target: number;
  readonly completed: boolean;
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
  | RequestUseHealingFlaskAcceptedServerMessage
  | RequestUseHealingFlaskRejectedServerMessage
  | RequestUseSkillSlotAcceptedServerMessage
  | RequestUseSkillSlotRejectedServerMessage
  | CurrencyPickedUpServerMessage
  | ErrorServerMessage;
