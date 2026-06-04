import { contentRegistry } from "@doomscrolls/content";
import { EnemyPresence, type ZoneId } from "@doomscrolls/shared";

import type { TownRoomState } from "./TownRoomState";

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Spawns enemies from content-driven spawn zone definitions.
 * Each enemy gets a deterministic id based on the zone and enemy type.
 * Positions are randomly placed within the spawn zone bounds.
 */
export function initializeTownEnemies(
  state: TownRoomState,
  zoneId: ZoneId,
): void {
  for (const zone of contentRegistry.spawnZones) {
    if (zone.zoneId !== zoneId) {
      continue;
    }

    const enemyContent = contentRegistry.enemies.require(zone.enemyId);

    for (let i = 0; i < zone.count; i++) {
      const x = Math.round(randomInRange(zone.minX, zone.maxX));
      const y = Math.round(randomInRange(zone.minY, zone.maxY));
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

      state.enemies.set(enemy.id, enemy);
    }
  }
}
