/**
 * Milestone 0.2 — Account Stash Foundation.
 *
 * Shared types for the account-wide stash network contract. Unlike
 * `StashTypes.ts` (a per-character bank keyed by `ownerCharacterId` on
 * `ItemInstance`), this stash is keyed by `userId` and shared across
 * every character on the account: deposit from one character, withdraw
 * to another.
 */

import type { ItemDefinitionId } from "../ids";

/**
 * A stack of items sitting in the account-wide stash. Deliberately not
 * an `ItemInstance` -- the stash stores stackable definition+quantity
 * only (no rolled durability/stats), so unique-instance data is not
 * preserved across a deposit.
 */
export interface AccountStashItemSummary {
  readonly id: string;
  readonly definitionId: ItemDefinitionId;
  readonly quantity: number;
  readonly slotIndex: number;
}

export type AccountStashListRejectedReason = "stash_unavailable" | "character_not_ready" | "list_failed";

export type RequestDepositStashItemRejectedReason =
  | "item_unavailable"
  | "item_not_owned"
  | "item_not_in_inventory"
  | "item_equipped"
  | "item_not_stashable"
  | "stash_unavailable";

export type RequestWithdrawStashItemRejectedReason =
  | "item_unavailable"
  | "item_not_owned"
  | "item_not_in_stash"
  | "inventory_full"
  | "stash_unavailable";
