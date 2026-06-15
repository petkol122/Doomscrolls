/**
 * Task 320 — Vendor Foundation: Server-Authoritative Sell Item.
 *
 * Shared types for the vendor sell item network contract.
 */

/**
 * Safe, server-owned rejection reasons for `request_sell_item` intents.
 */
export type RequestSellItemRejectedReason =
  | "vendor_unavailable"
  | "item_unavailable"
  | "item_not_owned"
  | "item_not_sellable"
  | "item_equipped"
  | "invalid_price";