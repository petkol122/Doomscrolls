import { contentRegistry } from "@doomscrolls/content";
import type { SpawnPointContentDefinition, SpawnPointContentId } from "@doomscrolls/content";
import type { CharacterId, ZoneId } from "@doomscrolls/shared";
import { PlayerPresence } from "./PlayerPresence";
import { NIGHTMARKET_DEFAULT_SPAWN_POINT_ID } from "./resolveTownSpawnPoint";
import { resolvePlayerInitialPosition } from "./validateCharacterLocation";

export interface BuildTownPlayerPresenceInput {
  readonly sessionId: string;
  readonly characterId: CharacterId;
  readonly displayName: string;
  readonly resolvedZoneId: ZoneId;
  readonly movementSpeed: number;
  readonly attackCooldownMs: number;
  readonly restoredLocationZoneId: string | undefined;
  readonly restoredLocationX: number | undefined;
  readonly restoredLocationY: number | undefined;
}

/**
 * Builds a TownRoom PlayerPresence using the resolved content spawn point,
 * while restoring a previously persisted location when it is valid for the
 * current zone bounds.
 */
export function buildTownPlayerPresence(
  input: BuildTownPlayerPresenceInput,
): PlayerPresence {
  const spawnPoint = resolveTownSpawnPointDefinition(input.resolvedZoneId);
  const initialPosition = resolvePlayerInitialPosition({
    resolvedZoneId: input.resolvedZoneId,
    spawnPointX: spawnPoint.x,
    spawnPointY: spawnPoint.y,
    restoredLocationZoneId: input.restoredLocationZoneId,
    restoredLocationX: input.restoredLocationX,
    restoredLocationY: input.restoredLocationY,
  });

  return new PlayerPresence(
    input.sessionId,
    input.characterId,
    input.displayName,
    spawnPoint.spawnPointId,
    initialPosition.x,
    initialPosition.y,
    input.movementSpeed,
    input.attackCooldownMs,
  );
}

function resolveTownSpawnPointDefinition(
  resolvedZoneId: ZoneId,
): SpawnPointContentDefinition {
  const definition = contentRegistry.spawnPoints.get(
    NIGHTMARKET_DEFAULT_SPAWN_POINT_ID as SpawnPointContentId,
  );

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