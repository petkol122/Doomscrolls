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
  },
  // Task 356 (Core 0.5) — give the new equipment-slot-coverage items a
  // guaranteed obtainability path alongside loot table RNG.
  {
    id: "nightmarket_suspicious_vendor_stock_04",
    vendorId: vendorId("nightmarket_suspicious_vendor"),
    itemId: itemId("scavenged_hood"),
    priceCopper: 90
  },
  {
    id: "nightmarket_suspicious_vendor_stock_05",
    vendorId: vendorId("nightmarket_suspicious_vendor"),
    itemId: itemId("wraptape_gloves"),
    priceCopper: 90
  },
  {
    id: "nightmarket_suspicious_vendor_stock_06",
    vendorId: vendorId("nightmarket_suspicious_vendor"),
    itemId: itemId("sewer_treads"),
    priceCopper: 100
  },
  {
    id: "nightmarket_suspicious_vendor_stock_07",
    vendorId: vendorId("nightmarket_suspicious_vendor"),
    itemId: itemId("scrapcord_belt"),
    priceCopper: 80
  },
  {
    id: "nightmarket_suspicious_vendor_stock_08",
    vendorId: vendorId("nightmarket_suspicious_vendor"),
    itemId: itemId("signal_scarred_amulet"),
    priceCopper: 220
  },
  // Core 0.19 — rarity matrix pass. New commons get a guaranteed
  // obtainability path, matching the 0.5 precedent above. Flask_1's new
  // rare tier follows starter_blood_flask's own vendor-only path
  // (flasks have never appeared in a loot table), same as how
  // signal_scarred_amulet is already vendor-sold at rare.
  {
    id: "nightmarket_suspicious_vendor_stock_09",
    vendorId: vendorId("nightmarket_suspicious_vendor"),
    itemId: itemId("frayed_signet"),
    priceCopper: 70
  },
  {
    id: "nightmarket_suspicious_vendor_stock_10",
    vendorId: vendorId("nightmarket_suspicious_vendor"),
    itemId: itemId("scavenged_cord"),
    priceCopper: 70
  },
  {
    id: "nightmarket_suspicious_vendor_stock_11",
    vendorId: vendorId("nightmarket_suspicious_vendor"),
    itemId: itemId("sealed_blood_flask"),
    priceCopper: 160
  }
] as const satisfies readonly VendorStockEntryDefinition[];
