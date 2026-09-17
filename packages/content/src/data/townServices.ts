import type { TownServiceContentDefinition } from "./types";

/**
 * Milestone 0.3 -- Pawn Shop / Army Surplus Vendor. First real town
 * service: a CZK-priced vendor in pilsen_namesti (see worldProps.ts
 * `army_surplus_pawn` and vendorStocks.ts).
 */
export const townServices = [
  {
    id: "army_surplus_pawn",
    serviceId: "army_surplus_pawn",
    serviceKind: "vendor",
    labelKey: "town_service.army_surplus_pawn.name",
    unavailableMessageKey: "town_service.army_surplus_pawn.unavailable"
  },

  // Milestone 0.3 -- Namesti Republiky Building Doorway Vendors (see
  // worldProps.ts `lekarna_vendor`/`cisarsky_dum_vendor`/`tech_hub_vendor`/
  // `hostinec_pub_vendor` and vendorStocks.ts for each one's stock).
  {
    id: "lekarna_vendor",
    serviceId: "lekarna_vendor",
    serviceKind: "vendor",
    labelKey: "town_service.lekarna_vendor.name",
    unavailableMessageKey: "town_service.lekarna_vendor.unavailable"
  },
  {
    id: "cisarsky_dum_vendor",
    serviceId: "cisarsky_dum_vendor",
    serviceKind: "vendor",
    labelKey: "town_service.cisarsky_dum_vendor.name",
    unavailableMessageKey: "town_service.cisarsky_dum_vendor.unavailable"
  },
  {
    id: "tech_hub_vendor",
    serviceId: "tech_hub_vendor",
    serviceKind: "vendor",
    labelKey: "town_service.tech_hub_vendor.name",
    unavailableMessageKey: "town_service.tech_hub_vendor.unavailable"
  },
  {
    id: "hostinec_pub_vendor",
    serviceId: "hostinec_pub_vendor",
    serviceKind: "vendor",
    labelKey: "town_service.hostinec_pub_vendor.name",
    unavailableMessageKey: "town_service.hostinec_pub_vendor.unavailable"
  }
] as const satisfies readonly TownServiceContentDefinition[];
