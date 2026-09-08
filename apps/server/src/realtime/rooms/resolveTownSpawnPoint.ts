import { contentRegistry } from "@doomscrolls/content";
import type { SpawnPointId, ZoneId } from "@doomscrolls/shared";
import type { SpawnPointContentDefinition, SpawnPointContentId } from "@doomscrolls/content";

/**
 * Default town (Namesti Republiky) spawn point id.
 *
 * Task 023.2 scope: a single, content-driven default spawn point for
 * TownRoom joins. Selection logic (death recovery, transition
 * portals, etc.) is explicitly out of scope and will be added in
 * later tasks.
 */
export const DEFAULT_TOWN_SPAWN_POINT_ID: SpawnPointContentId = "namesti_republiky_spawn";

/**
 * Resolve the spawn point for a TownRoom join.
 *
 * - Looks up the default town spawn point in the content registry.
 * - Verifies the spawn point belongs to the resolved zone.
 * - Returns the branded `SpawnPointId` that should be stored on the
 *   player's presence entry.
 *
 * This function is intentionally side-effect free: it does not move
 * the player, does not write to the database, and does not touch any
 * Colyseus state. It only validates and resolves data from content.
 */
export function resolveTownSpawnPoint(
  resolvedZoneId: ZoneId,
): SpawnPointId {
  const definition: SpawnPointContentDefinition | undefined =
    contentRegistry.spawnPoints.get(DEFAULT_TOWN_SPAWN_POINT_ID);

  if (definition === undefined) {
    throw new Error(
      `Missing spawn point content definition: ${DEFAULT_TOWN_SPAWN_POINT_ID}`,
    );
  }

  if (definition.zoneId !== resolvedZoneId) {
    throw new Error(
      `Spawn point ${definition.id} is not bound to resolved zone ${resolvedZoneId}.`,
    );
  }

  return definition.spawnPointId;
}
