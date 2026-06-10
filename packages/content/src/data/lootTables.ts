import type { ItemDefinitionId } from "@doomscrolls/shared";
import type { LootTableDefinition } from "./types";

const itemId = (value: string): ItemDefinitionId => value as ItemDefinitionId;

export const lootTables = [
  {
    id: "sewer_starter_loot",
    entries: [
      { itemId: itemId("blackwire_scrap"), rarity: "common", weight: 60 },
      { itemId: itemId("scrap_cloth"), rarity: "common", weight: 14 },
      { itemId: itemId("starter_pipe"), rarity: "common", weight: 10 },
      { itemId: itemId("sewer_jacket"), rarity: "common", weight: 7 },
      { itemId: itemId("rustbound_ring"), rarity: "rare", weight: 1 },
      { itemId: itemId("tarnished_coin"), rarity: "common", weight: 8 }
    ]
  },
  {
    // Brute variant: same item pool as sewer_starter_loot, but with a
    // slightly higher rare weight so Brute kills feel marginally more
    // rewarding. Rare items stay controlled (weight 2 of 100).
    id: "sewer_brute_loot",
    entries: [
      { itemId: itemId("blackwire_scrap"), rarity: "common", weight: 60 },
      { itemId: itemId("scrap_cloth"), rarity: "common", weight: 14 },
      { itemId: itemId("starter_pipe"), rarity: "common", weight: 10 },
      { itemId: itemId("sewer_jacket"), rarity: "common", weight: 6 },
      { itemId: itemId("rustbound_ring"), rarity: "rare", weight: 2 },
      { itemId: itemId("tarnished_coin"), rarity: "common", weight: 8 }
    ]
  }
] as const satisfies readonly LootTableDefinition[];
