import type { ContentLocalizationKey, ObjectiveContentDefinition } from "./types";

export const objectives: readonly ObjectiveContentDefinition[] = [
  {
    id: "cull_trashboars",
    titleKey: "objective.cull_trashboars.title" as ContentLocalizationKey,
    descriptionKey: "objective.cull_trashboars.description" as ContentLocalizationKey,
    targetEnemyIds: ["trashboar_runt", "trashboar_brute"],
    requiredKills: 3,
    xpReward: 5,
    copperReward: 3,
  },
  {
    id: "break_the_brute",
    titleKey: "objective.break_the_brute.title" as ContentLocalizationKey,
    descriptionKey: "objective.break_the_brute.description" as ContentLocalizationKey,
    targetEnemyIds: ["trashboar_brute"],
    requiredKills: 1,
    xpReward: 10,
    copperReward: 6,
  },
] as const satisfies readonly ObjectiveContentDefinition[];

/**
 * Ordered sequence of objective IDs offered by the Notice Board.
 * The first uncompleted objective is shown; after completion and reward
 * grant, the player re-interacts to advance to the next in the sequence.
 * Only one objective is active at a time.
 */
export const NOTICE_BOARD_OBJECTIVE_SEQUENCE: readonly string[] = [
  "cull_trashboars",
  "break_the_brute",
] as const;