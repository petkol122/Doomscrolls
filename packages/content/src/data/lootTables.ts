import type { ItemDefinitionId } from "@doomscrolls/shared";
import type { LootTableDefinition } from "./types";

const itemId = (value: string): ItemDefinitionId => value as ItemDefinitionId;

export const lootTables = [
  {
    id: "sewer_starter_loot",
    entries: [
      { itemId: itemId("blackwire_scrap"), weight: 80 },
      { itemId: itemId("starter_pipe"), weight: 10 },
      { itemId: itemId("sewer_jacket"), weight: 10 }
    ]
  }
] as const satisfies readonly LootTableDefinition[];