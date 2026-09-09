import { contentRegistry } from "@doomscrolls/content";
import type { WorldPropPoint, ZoneContentId } from "@doomscrolls/content";
import type { ZoneId } from "@doomscrolls/shared";

/**
 * Resolve the solid building outlines for a zone, for server-side
 * movement collision. Reads `building_footprint` world props' `points`
 * polygons from content data (see `WorldPropContentDefinition.points`
 * in `packages/content/src/data/types.ts`); props without `points` are
 * skipped defensively even though content validation already requires
 * at least 3 points for this kind.
 *
 * Returns an empty array for a zone with no building footprints
 * (e.g. combat zones) rather than throwing, since most zones have none.
 */
export function resolveZoneBuildingFootprints(
  zoneId: ZoneId,
): readonly (readonly WorldPropPoint[])[] {
  return contentRegistry.worldProps.all
    .filter(
      (prop) =>
        prop.zoneId === (zoneId as ZoneContentId) &&
        prop.kind === "building_footprint" &&
        prop.points !== undefined &&
        prop.points.length >= 3,
    )
    .map((prop) => prop.points as readonly WorldPropPoint[]);
}
