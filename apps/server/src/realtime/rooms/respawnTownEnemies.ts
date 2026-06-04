import type { EnemyPresence, ZoneId } from "@doomscrolls/shared";
import { contentRegistry } from "@doomscrolls/content";
import { createRng } from "./serverRng";

import type { TownRoomState } from "./TownRoomState";
import { clearWanderState } from "./wanderEnemies";

/**
 * Simple stable hash from a string to produce a deterministic seed
 * for the room instance, shared with initializeTownEnemies.
 */
function hashSeed(str: string): number {
  let seed = 0;
  for (let i = 0; i < str.length; i++) {
    seed = (seed * 31 + str.charCodeAt(i)) | 0;
  }
  return seed >>> 0;
}

/**
 * Build a map from spawn zone id prefix to zone bounds so we can
 * look up the correct bounds for each enemy id.
 */
function buildZoneBoundsMap(zoneId: ZoneId): Map<string, { minX: number; maxX: number; minY: number; maxY: number }> {
  const map = new Map<string, { minX: number; maxX: number; minY: number; maxY: number }>();
  for (const zone of contentRegistry.spawnZones) {
    if (zone.zoneId !== zoneId) {
      continue;
    }
    map.set(zone.id, { minX: zone.minX, maxX: zone.maxX, minY: zone.minY, maxY: zone.maxY });
  }
  return map;
}

/**
 * Extract the spawn zone id prefix from an enemy id.
 * Enemy ids are formatted as `${zone.id}_${i}` so we split on the
 * last underscore to get the zone prefix.
 */
function extractZonePrefix(enemyId: string): string | null {
  const lastUnderscore = enemyId.lastIndexOf("_");
  if (lastUnderscore < 0) {
    return null;
  }
  return enemyId.slice(0, lastUnderscore);
}

function resetEnemy(
  enemy: EnemyPresence,
  zoneBounds: { minX: number; maxX: number; minY: number; maxY: number },
  rng: ReturnType<typeof createRng>,
): void {
  const newX = rng.nextInt(zoneBounds.minX, zoneBounds.maxX + 1);
  const newY = rng.nextInt(zoneBounds.minY, zoneBounds.maxY + 1);
  enemy.spawnX = newX;
  enemy.spawnY = newY;
  enemy.state = "idle";
  enemy.targetPlayerSessionId = "";
  enemy.x = newX;
  enemy.y = newY;
  enemy.hp = enemy.maxHp;
  enemy.defeated = false;
  enemy.nextAttackAtMs = 0;
  enemy.respawnAtMs = 0;
  enemy.attackLandingAtMs = 0;
  clearWanderState(enemy.id);
}

export function respawnTownEnemies(state: TownRoomState, zoneId: ZoneId, now: number): void {
  const rng = createRng(hashSeed(zoneId));
  const zoneBoundsByPrefix = buildZoneBoundsMap(zoneId);

  state.enemies.forEach((enemy) => {
    if (!enemy.defeated) {
      if (!Number.isFinite(enemy.respawnAtMs) || enemy.respawnAtMs < 0) {
        enemy.respawnAtMs = 0;
      }
      // Guard against a stale telegraph from before the enemy was
      // marked defeated; clients should not see a warning marker on
      // a freshly respawned enemy.
      if (enemy.attackLandingAtMs > 0 && enemy.attackLandingAtMs < now) {
        enemy.attackLandingAtMs = 0;
      }
      return;
    }

    if (!Number.isFinite(enemy.respawnAtMs) || enemy.respawnAtMs <= 0) {
      return;
    }

    if (now >= enemy.respawnAtMs) {
      const zonePrefix = extractZonePrefix(enemy.id);
      const zoneBounds = zonePrefix !== null ? zoneBoundsByPrefix.get(zonePrefix) : undefined;
      if (zoneBounds === undefined) {
        // Fallback: keep current spawnX/spawnY if zone lookup fails
        resetEnemy(enemy, { minX: enemy.spawnX, maxX: enemy.spawnX, minY: enemy.spawnY, maxY: enemy.spawnY }, rng);
        return;
      }
      resetEnemy(enemy, zoneBounds, rng);
    }
  });
}
