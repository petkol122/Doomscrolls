import { contentRegistry } from "@doomscrolls/content";
import type { ZoneContentId } from "@doomscrolls/content";
import type { ZoneId } from "@doomscrolls/shared";

/**
 * Resolves the town zone ID for a TownRoom.
 *
 * Priority:
 * 1. If `requestedZoneId` is provided and is a known town-type zone in the
 *    content registry, return it.
 * 2. If `requestedZoneId` is provided but is not a valid town-type zone,
 *    throw with a descriptive error.
 * 3. If `requestedZoneId` is not provided, return the first registered
 *    town-type zone from the content registry. If no town zone exists,
 *    throw.
 *
 * This replaces the earlier hardcoded `"nightmarket"` fallback with a
 * data-driven resolver that automatically picks up any future town zones
 * added to the content registry.
 */
export function resolveTownZoneId(requestedZoneId?: ZoneId): ZoneId {
  if (requestedZoneId !== undefined) {
    const zone = contentRegistry.zones.get(
      requestedZoneId as unknown as ZoneContentId,
    );
    if (zone !== undefined && zone.roomType === "town") {
      return requestedZoneId;
    }
    throw new Error(
      `resolveTownZoneId: requested zone "${String(requestedZoneId)}" is not a registered town-type zone.`,
    );
  }

  // No zone requested — pick the first town-type zone from content data.
  const townZone = contentRegistry.zones.all.find(
    (z) => z.roomType === "town",
  );
  if (townZone !== undefined) {
    return townZone.zoneId;
  }

  throw new Error(
    "resolveTownZoneId: no town-type zone found in content registry.",
  );
}