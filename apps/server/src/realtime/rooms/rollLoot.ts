import { randomBytes } from "node:crypto";
import { contentRegistry } from "@doomscrolls/content";
import type { ItemDefinitionId } from "@doomscrolls/shared";
import { createLootRoller } from "./lootRoller";

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

export function rollLoot(enemyId: string): ItemDefinitionId | null {
  const enemyDefinition = contentRegistry.enemies.get(enemyId as never);
  if (enemyDefinition === undefined) {
    return null;
  }

  return rollLootFromTableId(enemyDefinition.lootTableId);
}
