/**
 * Task 319 — Vendor Foundation: Server-Authoritative Buy Item.
 *
 * Shared types for the vendor buy item network contract.
 */

/**
 * Safe, server-owned rejection reasons for `request_buy_vendor_item` intents.
 */
export type RequestBuyVendorItemRejectedReason =
  | "vendor_unavailable"
  | "item_unavailable"
  | "not_enough_currency"
  | "inventory_full"
  | "invalid_stock_entry";