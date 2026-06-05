import { contentRegistry } from "@doomscrolls/content";
import type { EnemyPresence, WorldLootId } from "@doomscrolls/shared";

import { TownRoomState } from "./TownRoomState";
import { WorldLoot } from "./WorldLoot";
import { rollLoot } from "./rollLoot";

const MAX_ACTIVE_WORLD_LOOT = 20;
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
    itemDefinition.rarity,
    enemy.x + WORLD_LOOT_OFFSET_X,
    enemy.y + WORLD_LOOT_OFFSET_Y,
  );
  evictOldestWorldLootIfNeeded(state);

  state.worldLoot.set(lootId, worldLoot);
  return worldLoot;
}

function buildWorldLootId(enemyInstanceId: string, now: number): WorldLootId {
  return `world_loot:${enemyInstanceId}:${now}` as WorldLootId;
}

function evictOldestWorldLootIfNeeded(state: TownRoomState): void {
  if (state.worldLoot.size < MAX_ACTIVE_WORLD_LOOT) {
    return;
  }

  const oldestLootId = state.worldLoot.keys().next().value;
  if (typeof oldestLootId !== "string") {
    return;
  }

  state.worldLoot.delete(oldestLootId);
}