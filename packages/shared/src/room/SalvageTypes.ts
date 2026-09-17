/**
 * Milestone 0.3 -- Pawn Shop / Army Surplus Vendor: Salvage & Tech Teardown.
 *
 * Shared types for the `request_salvage_item` network contract.
 */

/**
 * Safe, server-owned rejection reasons for `request_salvage_item` intents.
 */
export type RequestSalvageItemRejectedReason =
  | "vendor_unavailable"
  | "item_not_owned"
  | "item_equipped"
  | "item_not_salvageable";
