/**
 * Task 304 — Rest Area Visual Feedback.
 *
 * Client-side helper that checks whether a player's world position is inside
 * the zone's defined rest area bounds (if any). This is used to provide
 * visual feedback when entering/exiting the rest area without duplicating
 * server-side logic — the server still owns the actual refill.
 *
 * The bounds come from the zone content definition (restAreaBounds).
 * If the zone has no rest area defined, this helper always returns false.
 */

import { contentRegistry, type ZoneContentId } from "@doomscrolls/content";

export interface RestAreaBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/**
 * Resolve the rest area bounds for a given zone id.
 * Returns null if the zone has no rest area defined.
 */
export function resolveZoneRestAreaBounds(zoneId: string): RestAreaBounds | null {
  const zone = contentRegistry.zones.get(zoneId as ZoneContentId);
  if (zone === undefined || zone.restAreaBounds === undefined) {
    return null;
  }
  return zone.restAreaBounds;
}

/**
 * Check whether a point (px, py) is inside the rest area bounds.
 * Returns false if bounds is null.
 */
export function isInsideRestArea(
  px: number,
  py: number,
  bounds: RestAreaBounds | null,
): boolean {
  if (bounds === null) {
    return false;
  }
  return (
    px >= bounds.minX &&
    px <= bounds.maxX &&
    py >= bounds.minY &&
    py <= bounds.maxY
  );
}

/**
 * Convenience helper: given a zone id and player position, returns true
 * if the player is inside that zone's rest area (if any).
 */
export function checkPlayerInRestArea(
  zoneId: string,
  px: number,
  py: number,
): boolean {
  const bounds = resolveZoneRestAreaBounds(zoneId);
  return isInsideRestArea(px, py, bounds);
}