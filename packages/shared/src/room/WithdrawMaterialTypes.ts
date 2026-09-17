/**
 * Shared types for the `request_withdraw_material` network contract:
 * converting a chosen quantity of a salvage-material currency balance
 * (see `MaterialTypes.ts`) back into a physical, tradeable inventory
 * item stack.
 */
export type RequestWithdrawMaterialRejectedReason =
  | "invalid_amount"
  | "insufficient_material"
  | "inventory_full"
  | "character_not_found";
