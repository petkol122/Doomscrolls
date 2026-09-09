import { contentRegistry } from "@doomscrolls/content";
import type { ZoneContentId } from "@doomscrolls/content";
import type { ZoneId } from "@doomscrolls/shared";
import { resolveSafeFallbackTownZoneId } from "./resolveTownSpawnPoint";

/**
 * Resolves the town zone ID for a TownRoom.
 *
 * Priority:
 * 1. If `requestedZoneId` is provided and is a known town-type zone in the
 *    content registry, return it.
 * 2. If `requestedZoneId` is provided but is not a valid town-type zone
 *    (e.g. a zone that was renamed/removed from content but a client or a
 *    persisted character row still references the old id), redirect to
 *    the same safe fallback town zone `RoomJoinValidationService` uses for
 *    a per-client join, instead of throwing. This runs during room
 *    creation, before any client's join is validated, so it has to apply
 *    its own redirect rather than relying on that later check.
 * 3. If `requestedZoneId` is not provided, return the first registered
 *    town-type zone from the content registry. If no town zone exists,
 *    fall back the same way.
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
    return resolveSafeFallbackTownZoneId();
  }

  // No zone requested — pick the first town-type zone from content data.
  const townZone = contentRegistry.zones.all.find(
    (z) => z.roomType === "town",
  );
  if (townZone !== undefined) {
    return townZone.zoneId;
  }

  return resolveSafeFallbackTownZoneId();
}