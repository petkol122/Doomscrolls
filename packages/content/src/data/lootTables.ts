import type { ItemDefinitionId } from "@doomscrolls/shared";
import type { LootTableDefinition } from "./types";

const itemId = (value: string): ItemDefinitionId => value as ItemDefinitionId;

export const lootTables = [
  {
    id: "sewer_starter_loot",
    entries: [
      { itemId: itemId("blackwire_scrap"), rarity: "common", weight: 68 },
      { itemId: itemId("scrap_cloth"), rarity: "common", weight: 14 },
      { itemId: itemId("starter_pipe"), rarity: "common", weight: 10 },
      { itemId: itemId("sewer_jacket"), rarity: "common", weight: 7 },
      { itemId: itemId("rustbound_ring"), rarity: "rare", weight: 1 }
    ]
  }
] as const satisfies readonly LootTableDefinition[];