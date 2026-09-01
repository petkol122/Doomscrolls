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
      { itemId: itemId("tarnished_coin"), rarity: "common", weight: 8 },
      // Task 356 (Core 0.5) — equipment slot coverage entries.
      { itemId: itemId("scavenged_hood"), rarity: "common", weight: 6 },
      { itemId: itemId("wraptape_gloves"), rarity: "common", weight: 6 },
      { itemId: itemId("sewer_treads"), rarity: "common", weight: 6 },
      { itemId: itemId("scrapcord_belt"), rarity: "common", weight: 6 },
      { itemId: itemId("signal_scarred_amulet"), rarity: "rare", weight: 1 }
    ]
  },
  {
    // Brute variant: same item pool as sewer_starter_loot, but with a
    // slightly higher rare weight so Brute kills feel marginally more
    // rewarding. Rare items stay controlled relative to the common pool.
    id: "sewer_brute_loot",
    entries: [
      { itemId: itemId("blackwire_scrap"), rarity: "common", weight: 60 },
      { itemId: itemId("scrap_cloth"), rarity: "common", weight: 14 },
      { itemId: itemId("starter_pipe"), rarity: "common", weight: 10 },
      { itemId: itemId("sewer_jacket"), rarity: "common", weight: 6 },
      { itemId: itemId("rustbound_ring"), rarity: "rare", weight: 2 },
      { itemId: itemId("tarnished_coin"), rarity: "common", weight: 8 },
      // Task 356 (Core 0.5) — equipment slot coverage entries.
      { itemId: itemId("scavenged_hood"), rarity: "common", weight: 6 },
      { itemId: itemId("wraptape_gloves"), rarity: "common", weight: 6 },
      { itemId: itemId("sewer_treads"), rarity: "common", weight: 6 },
      { itemId: itemId("scrapcord_belt"), rarity: "common", weight: 6 },
      { itemId: itemId("signal_scarred_amulet"), rarity: "rare", weight: 2 }
    ]
  },
  {
    // Task 357 (Core 0.5) — Skitter gets its own table instead of sharing
    // Runt's pool. Skitter is the fast/low-value cousin, so its table
    // skews away from heavy armor (pipe/jacket/hood/belt) toward the two
    // speed-flavored pieces, keeping the overall drop pool lighter.
    id: "sewer_skitter_loot",
    entries: [
      { itemId: itemId("blackwire_scrap"), rarity: "common", weight: 55 },
      { itemId: itemId("scrap_cloth"), rarity: "common", weight: 16 },
      { itemId: itemId("wraptape_gloves"), rarity: "common", weight: 12 },
      { itemId: itemId("sewer_treads"), rarity: "common", weight: 12 },
      { itemId: itemId("tarnished_coin"), rarity: "common", weight: 8 },
      { itemId: itemId("rustbound_ring"), rarity: "rare", weight: 1 }
    ]
  }
] as const satisfies readonly LootTableDefinition[];
