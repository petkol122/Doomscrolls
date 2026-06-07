import { randomBytes } from "node:crypto";
import { contentRegistry } from "@doomscrolls/content";
import type { ItemDefinitionId } from "@doomscrolls/shared";
import { createLootRoller } from "./lootRoller";

function createLootSeed(): number {
  return randomBytes(4).readUInt32BE(0);
}

export function rollLoot(enemyId: string): ItemDefinitionId | null {
  const enemyDefinition = contentRegistry.enemies.get(enemyId as never);
  if (enemyDefinition === undefined) {
    return null;
  }

  const lootTable = contentRegistry.lootTables.get(enemyDefinition.lootTableId);
  if (lootTable === undefined) {
    return null;
  }

  const result = createLootRoller(createLootSeed()).rollContentTable(lootTable.entries);
  return result.itemId;
}
