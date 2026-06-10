import { contentRegistry } from "@doomscrolls/content";
import type { SpawnPointContentDefinition, SpawnPointContentId } from "@doomscrolls/content";
import type { CharacterId, ZoneId } from "@doomscrolls/shared";
import { PlayerPresence } from "./PlayerPresence";
import { NIGHTMARKET_DEFAULT_SPAWN_POINT_ID } from "./resolveTownSpawnPoint";
import { resolvePlayerInitialPosition } from "./validateCharacterLocation";
import { restoreFlaskToFull } from "./healingFlaskConfig";

export interface BuildTownPlayerPresenceInput {
  readonly sessionId: string;
  readonly characterId: CharacterId;
  readonly displayName: string;
  readonly level: number;
  readonly xp: number;
  readonly resolvedZoneId: ZoneId;
  readonly hp: number;
  readonly maxHp: number;
  readonly restoredFlaskCharges: number | undefined;
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

  const presence = new PlayerPresence(
    input.sessionId,
    input.characterId,
    input.displayName,
    input.level,
    input.xp,
    spawnPoint.spawnPointId,
    input.hp,
    input.maxHp,
    initialPosition.x,
    initialPosition.y,
    input.movementSpeed,
    input.attackCooldownMs,
  );
  // Restore the flask baseline before applying persisted state.
  // `restoreFlaskToFull` intentionally sets `maxFlaskCharges` (3) and
  // `nextFlaskAt` (0) as a side-effect, even though `flaskCharges` is
  // then overridden by the persisted value below. This ensures the
  // Colyseus schema always has a valid max-flask-cap baseline for HUD
  // rendering, regardless of whether persisted state exists.
  restoreFlaskToFull(presence);
  const restoredFlaskCharges = Number.isFinite(input.restoredFlaskCharges)
    ? Math.floor(input.restoredFlaskCharges ?? 0)
    : presence.maxFlaskCharges;
  presence.flaskCharges = Math.min(
    presence.maxFlaskCharges,
    Math.max(0, restoredFlaskCharges),
  );
  return presence;
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
