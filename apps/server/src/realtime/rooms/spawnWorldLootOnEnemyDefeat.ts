import { contentRegistry } from "@doomscrolls/content";
import type { EnemyPresence, WorldLootId } from "@doomscrolls/shared";

import { TownRoomState } from "./TownRoomState";
import { WorldLoot } from "./WorldLoot";
import { rollLoot } from "./rollLoot";

const WORLD_LOOT_OFFSET_X = 14;
const WORLD_LOOT_OFFSET_Y = 10;

export function spawnWorldLootOnEnemyDefeat(
  state: TownRoomState,
  enemy: EnemyPresence,
  now: number,
): WorldLoot | null {
  const itemId = rollLoot(enemy.enemyId);
  if (itemId === null) {
    return null;
  }

  const itemDefinition = contentRegistry.items.get(itemId);
  if (itemDefinition === undefined) {
    return null;
  }

  const lootId = buildWorldLootId(enemy.id, now);
  const worldLoot = new WorldLoot(
    lootId,
    itemId,
    itemDefinition.nameKey,
    enemy.x + WORLD_LOOT_OFFSET_X,
    enemy.y + WORLD_LOOT_OFFSET_Y,
  );

  state.worldLoot.set(lootId, worldLoot);
  return worldLoot;
}

function buildWorldLootId(enemyInstanceId: string, now: number): WorldLootId {
  return `world_loot:${enemyInstanceId}:${now}` as WorldLootId;
}