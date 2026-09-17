import type { ItemDefinitionId } from "@doomscrolls/shared";
import type { VendorStockEntryDefinition } from "./types";

const itemId = (value: string): ItemDefinitionId => value as ItemDefinitionId;

/**
 * Milestone 0.3 -- Pawn Shop / Army Surplus Vendor. CZK-priced stock for
 * the `army_surplus_pawn` vendor (see townServices.ts).
 */
export const vendorStocks = [
  {
    id: "army_surplus_pawn_blood_flask",
    vendorId: "army_surplus_pawn",
    itemId: itemId("starter_blood_flask"),
    priceCopper: 15
  },

  // Milestone 0.3 -- Namesti Republiky Building Doorway Vendors. Each
  // stocks existing items matching its doorway's theme rather than
  // inventing new item categories/mechanics out of scope for this pass
  // (see townServices.ts and items.ts for the reasoning per item).

  // Lékárna (North) -- flasks/potions.
  { id: "lekarna_vendor_blood_flask", vendorId: "lekarna_vendor", itemId: itemId("starter_blood_flask"), priceCopper: 15 },
  { id: "lekarna_vendor_sealed_blood_flask", vendorId: "lekarna_vendor", itemId: itemId("sealed_blood_flask"), priceCopper: 40 },
  { id: "lekarna_vendor_vital_reserve_flask", vendorId: "lekarna_vendor", itemId: itemId("vital_reserve_flask"), priceCopper: 60 },
  // Milestone 0.3 -- 4-Slot Flask Belt. Mana/stamina flasks only have a
  // single (common) tier each so far -- unlike the 3-tier blood flask
  // ladder above -- so they're priced to match that same starter tier
  // (starter_blood_flask, 15 copper), not the whole ladder.
  { id: "lekarna_vendor_mana_draught", vendorId: "lekarna_vendor", itemId: itemId("starter_mana_draught"), priceCopper: 15 },
  { id: "lekarna_vendor_stamina_tonic", vendorId: "lekarna_vendor", itemId: itemId("starter_stamina_tonic"), priceCopper: 15 },

  // Císařský dům (West) -- pawn shop / salvage / weapons & armor surplus.
  // `iron_scrap` is no longer stocked here: it's a salvage-material
  // currency balance now (see MaterialTypes.ts), not a purchasable item.
  { id: "cisarsky_dum_vendor_pipe", vendorId: "cisarsky_dum_vendor", itemId: itemId("starter_pipe"), priceCopper: 20 },
  { id: "cisarsky_dum_vendor_jacket", vendorId: "cisarsky_dum_vendor", itemId: itemId("sewer_jacket"), priceCopper: 25 },

  // Tech Hub (South) -- netrunner parts/gadgets (Static Yard-family gear).
  { id: "tech_hub_vendor_livewire_lance", vendorId: "tech_hub_vendor", itemId: itemId("livewire_lance"), priceCopper: 90 },
  { id: "tech_hub_vendor_static_wraps", vendorId: "tech_hub_vendor", itemId: itemId("static_wraps"), priceCopper: 55 },
  { id: "tech_hub_vendor_signal_scarred_amulet", vendorId: "tech_hub_vendor", itemId: itemId("signal_scarred_amulet"), priceCopper: 70 },

  // Hostinec Pub (East) -- cooking-profession fare (see items.ts `hostinec_stew`).
  { id: "hostinec_pub_vendor_stew", vendorId: "hostinec_pub_vendor", itemId: itemId("hostinec_stew"), priceCopper: 10 }
] as const satisfies readonly VendorStockEntryDefinition[];
