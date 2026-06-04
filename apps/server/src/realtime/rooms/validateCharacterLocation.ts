import { contentRegistry } from "@doomscrolls/content";
import type { ZoneContentDefinition, ZoneContentId } from "@doomscrolls/content";
import type { ZoneId } from "@doomscrolls/shared";

/**
 * Validates whether a position (x, y) is within a zone's bounds.
 *
 * Task 075 scope:
 *  - Restores character location on TownRoom join if previously persisted.
 *  - Validates that restored location falls inside zone bounds.
 *  - Falls back to spawn point if invalid/missing.
 *
 * This helper is side-effect-free and only checks content and geometry.
 */
export function isPositionInsideZoneBounds(
  zoneId: ZoneId,
  x: number,
  y: number,
): boolean {
  let zoneDefinition: ZoneContentDefinition | undefined;

  try {
    // Cast to ZoneContentId since the branded types should match semantically
    zoneDefinition = contentRegistry.zones.get(zoneId as unknown as ZoneContentId);
  } catch {
    return false;
  }

  if (zoneDefinition === undefined) {
    return false;
  }

  const bounds = zoneDefinition.bounds;
  return (
    x >= bounds.minX &&
    x <= bounds.maxX &&
    y >= bounds.minY &&
    y <= bounds.maxY
  );
}

/**
 * Resolves the initial world position for a player on TownRoom join.
 *
 * - If restoredLocation is provided and valid (inside bounds), use it.
 * - Otherwise, fall back to the spawn point position.
 *
 * Returns { zoneId, x, y } suitable for PlayerPresence initialization.
 */
export function resolvePlayerInitialPosition(args: {
  readonly resolvedZoneId: ZoneId;
  readonly spawnPointX: number;
  readonly spawnPointY: number;
  readonly restoredLocationZoneId: string | undefined;
  readonly restoredLocationX: number | undefined;
  readonly restoredLocationY: number | undefined;
}): { readonly zoneId: ZoneId; readonly x: number; readonly y: number } {
  // If restoration data is available, validate it
  if (
    args.restoredLocationZoneId !== undefined &&
    args.restoredLocationX !== undefined &&
    args.restoredLocationY !== undefined
  ) {
    const restoredZoneId = args.restoredLocationZoneId as ZoneId;

    // Position is valid if it's in the same zone and inside bounds
    if (
      restoredZoneId === args.resolvedZoneId &&
      isPositionInsideZoneBounds(restoredZoneId, args.restoredLocationX, args.restoredLocationY)
    ) {
      return {
        zoneId: restoredZoneId,
        x: args.restoredLocationX,
        y: args.restoredLocationY,
      };
    }
  }

  return {
    zoneId: args.resolvedZoneId,
    x: args.spawnPointX,
    y: args.spawnPointY,
  };
}
