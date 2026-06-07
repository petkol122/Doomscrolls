import type { ItemDefinitionId } from "@doomscrolls/shared";
import type { VendorId, VendorStockEntryDefinition } from "./types";

const itemId = (value: string): ItemDefinitionId => value as ItemDefinitionId;
const vendorId = (value: string): VendorId => value as VendorId;

/**
 * Task 204 — Basic Sell-Disabled Vendor Inventory Preview
 *
 * Placeholder stock entries for the Nightmarket Suspicious Vendor.
 * No buying, selling, stock persistence or refresh timers yet.
 */
export const vendorStocks = [
  {
    id: "nightmarket_suspicious_vendor_stock_01",
    vendorId: vendorId("nightmarket_suspicious_vendor"),
    itemId: itemId("starter_blood_flask"),
    priceCopper: 75
  },
  {
    id: "nightmarket_suspicious_vendor_stock_02",
    vendorId: vendorId("nightmarket_suspicious_vendor"),
    itemId: itemId("sewer_jacket"),
    priceCopper: 120
  },
  {
    id: "nightmarket_suspicious_vendor_stock_03",
    vendorId: vendorId("nightmarket_suspicious_vendor"),
    itemId: itemId("scrap_cloth"),
    priceCopper: 15
  }
] as const satisfies readonly VendorStockEntryDefinition[];
