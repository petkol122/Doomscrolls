import type { CharacterClassContentDefinition } from "./types";

export const classes = [
  {
    id: "gravewalker",
    nameKey: "class.gravewalker.name",
    descriptionKey: "class.gravewalker.description",
    startingSkillId: "heavy_strike",
    // Core 0.7 — right-click ("secondary") and hotkey ("tertiary")
    // combat skill slots, content-driven per class.
    secondarySkillId: "grave_spark",
    tertiarySkillId: "bone_splinter",
    baseStats: { power: 3, speed: 1, mind: 2, toughness: 3 }
  },
  {
    // Core 0.9 — Ironclad: a close-range physical bruiser, contrasting
    // Gravewalker's longer-range caster-ish lean. Tankier and slower
    // (higher power/toughness, no speed/mind) with a melee-flavored
    // secondary/tertiary skill pair (shatter_blow/groundbreaker).
    id: "ironclad",
    nameKey: "class.ironclad.name",
    descriptionKey: "class.ironclad.description",
    startingSkillId: "heavy_strike",
    secondarySkillId: "shatter_blow",
    tertiarySkillId: "groundbreaker",
    baseStats: { power: 4, speed: 0, mind: 0, toughness: 5 }
  }
] as const satisfies readonly CharacterClassContentDefinition[];