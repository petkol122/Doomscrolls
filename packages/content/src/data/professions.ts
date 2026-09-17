import type { ProfessionContentDefinition } from "./types";

/**
 * Milestone 0.3 -- Profession Training System. Baseline Life Skill
 * professions trainable at the Pawn Shop / Army Surplus vendor (see
 * docs/architecture/WORLD_VISION_AND_ECONOMY.md section 3). Only Tier 1
 * exists today for salvaging/fishing/cooking; `gunsmithing` is defined
 * as a named profession with no purchasable tiers yet.
 */
export const professions = [
  {
    id: "salvaging",
    nameKey: "profession.salvaging.name",
    descriptionKey: "profession.salvaging.description",
    tiers: [{ tier: 1, costCopper: 20 }]
  },
  {
    id: "fishing",
    nameKey: "profession.fishing.name",
    descriptionKey: "profession.fishing.description",
    tiers: [{ tier: 1, costCopper: 15 }]
  },
  {
    id: "cooking",
    nameKey: "profession.cooking.name",
    descriptionKey: "profession.cooking.description",
    tiers: [{ tier: 1, costCopper: 15 }]
  },
  {
    id: "gunsmithing",
    nameKey: "profession.gunsmithing.name",
    descriptionKey: "profession.gunsmithing.description",
    tiers: []
  }
] as const satisfies readonly ProfessionContentDefinition[];
