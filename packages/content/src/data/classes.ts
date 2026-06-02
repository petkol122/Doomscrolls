import type { CharacterClassContentDefinition } from "./types";

export const classes = [
  {
    id: "gravewalker",
    nameKey: "class.gravewalker.name",
    descriptionKey: "class.gravewalker.description",
    startingSkillId: "heavy_strike",
    baseStats: { power: 3, speed: 1, mind: 2, toughness: 3 }
  }
] as const satisfies readonly CharacterClassContentDefinition[];