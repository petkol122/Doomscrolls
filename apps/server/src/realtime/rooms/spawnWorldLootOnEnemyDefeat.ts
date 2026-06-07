import { contentRegistry } from "@doomscrolls/content";
import type { EnemyPresence, ItemDefinitionId, WorldLootId } from "@doomscrolls/shared";

import { TownRoomState } from "./TownRoomState";
import { WorldLoot } from "./WorldLoot";
import { rollCurrencyLoot } from "./rollCurrencyLoot";
import { rollLoot } from "./rollLoot";

const MAX_ACTIVE_WORLD_LOOT = 20;
const WORLD_LOOT_OFFSET_X = 14;
const WORLD_LOOT_OFFSET_Y = 10;
const CURRENCY_LABEL_KEY = "money.currency_drop_label";

export interface SpawnedWorldLoot {
  readonly item: WorldLoot;
  readonly isCurrency: boolean;
}

export function spawnWorldLootOnEnemyDefeat(
  state: TownRoomState,
  enemy: EnemyPresence,
  now: number,
): WorldLoot | null {
  const itemId = rollLoot(enemy.enemyId);
  const currencyAmount = rollCurrencyLoot(enemy.enemyId, now);
  const spawnX = enemy.x + WORLD_LOOT_OFFSET_X;
  const spawnY = enemy.y + WORLD_LOOT_OFFSET_Y;

  if (itemId !== null) {
    const itemDefinition = contentRegistry.items.get(itemId);
    if (itemDefinition !== undefined) {
      const loot = new WorldLoot(
        buildWorldLootId(enemy.id, "item", now),
        itemId,
        itemDefinition.nameKey,
        itemDefinition.rarity,
        spawnX,
        spawnY,
        0,
      );
      evictOldestWorldLootIfNeeded(state);
      state.worldLoot.set(loot.id, loot);
      return loot;
    }
  }

  if (currencyAmount > 0) {
    const loot = new WorldLoot(
      buildWorldLootId(enemy.id, "coin", now),
      "" as ItemDefinitionId,
      CURRENCY_LABEL_KEY,
      "common",
      spawnX,
      spawnY,
      currencyAmount,
    );
    evictOldestWorldLootIfNeeded(state);
    state.worldLoot.set(loot.id, loot);
    return loot;
  }

  return null;
}

function buildWorldLootId(
  enemyInstanceId: string,
  kind: "item" | "coin",
  now: number,
): WorldLootId {
  return `world_loot:${enemyInstanceId}:${kind}:${now}` as WorldLootId;
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
