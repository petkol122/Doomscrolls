import { contentRegistry } from "@doomscrolls/content";
import type { ZoneContentBounds, ZoneContentId } from "@doomscrolls/content";
import type { ZoneId } from "@doomscrolls/shared";

/**
 * Resolve the movement bounds for a given zone from content data.
 *
 * Returns the placeholder zone bounds defined in the content registry.
 * These are NOT collision geometry or map size — they are conservative
 * zone-specific numeric ranges for movement intent validation only.
 *
 * Throws if the zone id is missing from the content registry.
 */
export function resolveZoneBounds(
  zoneId: ZoneId,
): ZoneContentBounds {
  const zoneDefinition = contentRegistry.zones.get(
    zoneId as ZoneContentId,
  );

  if (zoneDefinition === undefined) {
    throw new Error(
      `Missing zone content definition for bounds lookup: ${zoneId}`,
    );
  }

  return zoneDefinition.bounds;
}
