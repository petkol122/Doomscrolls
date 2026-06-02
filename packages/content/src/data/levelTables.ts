import type { LevelTableDefinition } from "./types";

export const levelTables = [
  {
    id: "level_1_to_10",
    levels: [
      { level: 1, requiredXp: 0 },
      { level: 2, requiredXp: 20 },
      { level: 3, requiredXp: 50 },
      { level: 4, requiredXp: 90 },
      { level: 5, requiredXp: 140 },
      { level: 6, requiredXp: 210 },
      { level: 7, requiredXp: 300 },
      { level: 8, requiredXp: 420 },
      { level: 9, requiredXp: 560 },
      { level: 10, requiredXp: 740 }
    ]
  }
] as const satisfies readonly LevelTableDefinition[];