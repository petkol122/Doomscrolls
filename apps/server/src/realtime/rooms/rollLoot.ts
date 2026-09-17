import { randomBytes } from "node:crypto";
import { contentRegistry } from "@doomscrolls/content";
import type { EnemyRarity, ItemDefinitionId } from "@doomscrolls/shared";
import { createLootRoller } from "./lootRoller";
import { getEnemyRarityMultiplier } from "./enemyRarity";

function createLootSeed(): number {
  return randomBytes(4).readUInt32BE(0);
}

/**
 * Roll loot from a specific content loot table, by the table's own real
 * id -- the generic core both `rollLoot` (below, resolved via an enemy's
 * `lootTableId`) and any other content-driven loot source (e.g. a world
 * prop's own `lootTableId`, see interactValidation.ts) delegate to.
 */
export function rollLootFromTableId(lootTableId: string): ItemDefinitionId | null {
  const lootTable = contentRegistry.lootTables.get(lootTableId as never);
  if (lootTable === undefined) {
    return null;
  }

  const result = createLootRoller(createLootSeed()).rollContentTable(lootTable.entries);
  return result.itemId;
}

/**
 * Core 0.1 Foundation -- Champion/Elite enemies get extra guaranteed
 * loot-roll attempts (see enemyRarity.ts): each bonus attempt re-rolls
 * the table and only overrides a still-empty result, so rarity can only
 * ever raise the odds of a drop, never replace an already-rolled item.
 */
export function rollLoot(enemyId: string, rarity: EnemyRarity = "normal"): ItemDefinitionId | null {
  const enemyDefinition = contentRegistry.enemies.get(enemyId as never);
  if (enemyDefinition === undefined) {
    return null;
  }

  let result = rollLootFromTableId(enemyDefinition.lootTableId);
  const { bonusLootRolls } = getEnemyRarityMultiplier(rarity);
  for (let attempt = 0; result === null && attempt < bonusLootRolls; attempt++) {
    result = rollLootFromTableId(enemyDefinition.lootTableId);
  }

  return result;
}
