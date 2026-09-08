import type { VendorStockEntryDefinition } from "./types";

/**
 * No vendor exists yet for Namesti Republiky -- deliberately deferred
 * to a later build (see the Nightmarket removal/Namesti Republiky
 * foundation build notes).
 */
export const vendorStocks = [] as const satisfies readonly VendorStockEntryDefinition[];
