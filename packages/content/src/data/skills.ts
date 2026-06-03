import type { SkillContentDefinition } from "./types";

export const skills = [
  {
    id: "heavy_strike",
    nameKey: "skill.heavy_strike.name",
    descriptionKey: "skill.heavy_strike.description",
    targeting: "target",
    range: 1.4,
    cooldownMs: 1000,
    baseDamage: 3
  }
] as const satisfies readonly SkillContentDefinition[];