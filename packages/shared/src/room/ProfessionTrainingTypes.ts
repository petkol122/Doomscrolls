/**
 * Milestone 0.3 -- Profession Training System.
 *
 * Shared types for the `request_unlock_profession` network contract.
 */

/**
 * Safe, server-owned rejection reasons for `request_unlock_profession` intents.
 */
export type RequestUnlockProfessionRejectedReason =
  | "vendor_unavailable"
  | "profession_unavailable"
  | "not_enough_currency"
  | "already_max_tier";
