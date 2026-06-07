import type { ContentLocalizationKey, ObjectiveContentDefinition } from "./types";

export const objectives: readonly ObjectiveContentDefinition[] = [
  {
    id: "cull_trashboars",
    titleKey: "objective.cull_trashboars.title" as ContentLocalizationKey,
    descriptionKey: "objective.cull_trashboars.description" as ContentLocalizationKey,
    targetEnemyIds: ["trashboar_runt", "trashboar_brute"],
    requiredKills: 3,
    xpReward: 5,
  },
] as const;