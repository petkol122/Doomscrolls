/**
 * Task 324 — Stash Foundation: Open Basic Town Stash Panel.
 *
 * Shared types for the stash list network contract.
 */

/**
 * Safe, server-owned rejection reasons for stash listing failures.
 */
export type StashItemsListRejectedReason =
  | "stash_unavailable"
  | "character_not_ready"
  | "list_failed";

/**
 * Safe, server-owned rejection reasons for stash transfer failures.
 */
export type RequestStoreInventoryItemInStashRejectedReason =
  | "item_unavailable"
  | "item_not_owned"
  | "item_not_in_inventory"
  | "item_equipped"
  | "stash_full"
  | "invalid_stash_placement"
  | "stash_unavailable";

export type RequestTakeStashItemToInventoryRejectedReason =
  | "item_unavailable"
  | "item_not_owned"
  | "item_not_in_stash"
  | "inventory_full"
  | "stash_unavailable";