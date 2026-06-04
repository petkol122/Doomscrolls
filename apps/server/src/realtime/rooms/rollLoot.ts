import { contentRegistry } from "@doomscrolls/content";
import type { ItemDefinitionId } from "@doomscrolls/shared";

export function rollLoot(enemyId: string): ItemDefinitionId | null {
  const enemyDefinition = contentRegistry.enemies.get(enemyId as never);
  if (enemyDefinition === undefined) {
    return null;
  }

  const lootTable = contentRegistry.lootTables.get(enemyDefinition.lootTableId);
  if (lootTable === undefined) {
    return null;
  }

  const totalWeight = lootTable.entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  const roll = Math.random() * totalWeight;
  let currentWeight = 0;
  for (const entry of lootTable.entries) {
    currentWeight += entry.weight;
    if (roll < currentWeight) {
      return entry.itemId;
    }
  }

  return null;
}
