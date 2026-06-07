import type { TownServiceContentDefinition, TownServiceId } from "./types";

const townServiceId = (value: string): TownServiceId => value as TownServiceId;

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
    id: townServiceId("nightmarket_stash_keeper"),
    serviceId: townServiceId("nightmarket_stash_keeper"),
    serviceKind: "stash",
    labelKey: "town_service.stash_keeper.name",
    unavailableMessageKey: "town_service.stash_keeper.unavailable"
  }
] as const satisfies readonly TownServiceContentDefinition[];
