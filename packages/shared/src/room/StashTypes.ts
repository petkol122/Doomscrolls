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