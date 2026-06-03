import { contentRegistry } from "@doomscrolls/content";
import type { SpawnPointContentDefinition } from "@doomscrolls/content";
import type { CharacterId, ZoneId } from "@doomscrolls/shared";
import { PlayerPresence } from "./PlayerPresence";
import { NIGHTMARKET_DEFAULT_SPAWN_POINT_ID } from "./resolveTownSpawnPoint";

/**
 * Build a {@link PlayerPresence} for a TownRoom join.
 *
 * Task 025 scope:
 *  - Resolve the spawn point for the resolved zone from the content
 *    registry (the same single Core 0.1 spawn point the rest of the
 *    town foundation uses).
 *  - Copy the spawn point's x/y into the new presence entry as the
 *    player's initial world position.
 *  - Do not read input, do not move the player, do not run any
 *    gameplay simulation.
 *
 * This helper is intentionally side-effect free aside from constructing
 * a fresh Colyseus schema instance. It exists to keep `TownRoom` thin
 * and to make the presence-construction contract unit-testable.
 */
export function buildTownPlayerPresence(args: {
  readonly sessionId: string;
  readonly characterId: CharacterId;
  readonly displayName: string;
  readonly resolvedZoneId: ZoneId;
  readonly movementSpeed: number;
}): PlayerPresence {
  const spawnPoint = resolveTownPresenceSpawnPoint(args.resolvedZoneId);

  return new PlayerPresence(
    args.sessionId,
    args.characterId,
    args.displayName,
    spawnPoint.spawnPointId,
    spawnPoint.x,
    spawnPoint.y,
    args.movementSpeed,
  );
}

function resolveTownPresenceSpawnPoint(
  resolvedZoneId: ZoneId,
): SpawnPointContentDefinition {
  const definition: SpawnPointContentDefinition | undefined =
    contentRegistry.spawnPoints.get(NIGHTMARKET_DEFAULT_SPAWN_POINT_ID);

  if (definition === undefined) {
    throw new Error(
      `Missing spawn point content definition: ${NIGHTMARKET_DEFAULT_SPAWN_POINT_ID}`,
    );
  }

  if (definition.zoneId !== resolvedZoneId) {
    throw new Error(
      `Spawn point ${definition.id} is not bound to resolved zone ${resolvedZoneId}.`,
    );
  }

  return definition;
}
