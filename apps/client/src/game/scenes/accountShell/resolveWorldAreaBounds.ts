import { contentRegistry } from "@doomscrolls/content";
import type { ZoneContentBounds, ZoneContentId } from "@doomscrolls/content";

/**
 * Resolve zone world-area bounds for the client UI from content definitions.
 *
 * These are placeholder zone bounds from the content registry, NOT collision
 * geometry or map size. They define the numeric range for the click-to-move
 * input panel only.
 *
 * Falls back to safe defaults if the zone is missing from content, so the
 * client UI never crashes on missing content.
 */
export function resolveWorldAreaBounds(
  zoneId: string = "nightmarket",
): ZoneContentBounds {
  const zone = contentRegistry.zones.get(zoneId as ZoneContentId);

  if (zone === undefined) {
    // Safe fallback — matches the Core 0.1 nightmarket content definition.
    // This should only be reached if content data is missing, which would
    // also fail content validation.
    return { minX: 0, maxX: 800, minY: 0, maxY: 600 };
  }

  return zone.bounds;
}