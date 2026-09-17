import { contentRegistry } from "@doomscrolls/content";
import type { ZoneId } from "@doomscrolls/shared";
import { createRng } from "./serverRng";
import { buildPocketEnemies } from "./spawnPocketEnemies";

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

    for (const enemy of buildPocketEnemies(zone, rng)) {
      state.enemies.set(enemy.id, enemy);
    }
  }
}
