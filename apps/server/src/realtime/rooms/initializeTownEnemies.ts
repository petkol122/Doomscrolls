import { contentRegistry } from "@doomscrolls/content";
import { EnemyPresence, type ZoneId } from "@doomscrolls/shared";
import { createRng } from "./serverRng";

import type { TownRoomState } from "./TownRoomState";

/**
 * Simple stable hash from a string to produce a deterministic seed
 * for the room instance.
 */
function hashSeed(str: string): number {
  let seed = 0;
  for (let i = 0; i < str.length; i++) {
    seed = (seed * 31 + str.charCodeAt(i)) | 0;
  }
  return seed >>> 0;
}

/**
 * Spawns enemies from content-driven spawn zone definitions.
 * Each enemy gets a deterministic id based on the zone and enemy type.
 * Positions are randomly placed within the spawn zone bounds using
 * a deterministic seeded RNG so the same zone always produces the
 * same initial enemy layout.
 */
export function initializeTownEnemies(
  state: TownRoomState,
  zoneId: ZoneId,
): void {
  const rng = createRng(hashSeed(zoneId));

  for (const zone of contentRegistry.spawnZones) {
    if (zone.zoneId !== zoneId) {
      continue;
    }

    const enemyContent = contentRegistry.enemies.require(zone.enemyId);

    for (let i = 0; i < zone.count; i++) {
      const x = rng.nextInt(zone.minX, zone.maxX + 1);
      const y = rng.nextInt(zone.minY, zone.maxY + 1);
      const id = `${zone.id}_${i}`;

      const enemy = new EnemyPresence();
      enemy.id = id;
      enemy.enemyId = enemyContent.id;
      enemy.label = enemyContent.nameKey;
      enemy.spawnX = x;
      enemy.spawnY = y;
      enemy.x = x;
      enemy.y = y;
      enemy.state = "idle";
      enemy.targetPlayerSessionId = "";
      enemy.hp = enemyContent.maxHp;
      enemy.maxHp = enemyContent.maxHp;
      enemy.defeated = false;
      enemy.nextAttackAtMs = 0;
      enemy.respawnAtMs = 0;
      enemy.attackLandingAtMs = 0;
      enemy.attackKind = "normal";
      enemy.nextHeavyAttackAtMs = 0;

      state.enemies.set(enemy.id, enemy);
    }
  }
}
