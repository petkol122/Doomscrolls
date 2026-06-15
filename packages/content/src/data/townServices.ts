import type { ContentLocalizationKey, TownServiceContentDefinition, TownServiceId } from "./types";

const townServiceId = (value: string): TownServiceId => value as TownServiceId;
const locKey = (value: string): ContentLocalizationKey => value as ContentLocalizationKey;

/**
 * Task 205 — Vendor Preview + Safe-Zone Services Batch
 *
 * Placeholder town-service content definitions for the Nightmarket.
 * No real vendor/stash/trainer behavior exists yet. Services only
 * render as interactable objects and surface a "not available yet"
 * placeholder when interacted with.
 */
export const townServices = [
  {
    id: townServiceId("nightmarket_suspicious_vendor"),
    serviceId: townServiceId("nightmarket_suspicious_vendor"),
    serviceKind: "vendor",
    labelKey: locKey("town_service.suspicious_vendor.name"),
    unavailableMessageKey: locKey("town_service.suspicious_vendor.unavailable")
  },
  {
    id: townServiceId("nightmarket_stash_keeper"),
    serviceId: townServiceId("nightmarket_stash_keeper"),
    serviceKind: "stash",
    labelKey: "town_service.stash_keeper.name",
    unavailableMessageKey: "town_service.stash_keeper.unavailable"
  },
  {
    id: townServiceId("nightmarket_trainer"),
    serviceId: townServiceId("nightmarket_trainer"),
    serviceKind: "trainer",
    labelKey: "town_service.trainer.name",
    unavailableMessageKey: "town_service.trainer.unavailable"
  },
  {
    id: townServiceId("nightmarket_waypoint"),
    serviceId: townServiceId("nightmarket_waypoint"),
    serviceKind: "waypoint",
    labelKey: "town_service.waypoint.name",
    unavailableMessageKey: "town_service.waypoint.unavailable"
  }
] as const satisfies readonly TownServiceContentDefinition[];
