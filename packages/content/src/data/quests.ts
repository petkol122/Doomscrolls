import type { ContentLocalizationKey, QuestContentDefinition } from "./types";

/**
 * Core 0.1 — Persistent Quest & Dialogue System foundation. One sample
 * quest offered by a "quest_giver" world prop (see worldProps.ts).
 */
export const quests: readonly QuestContentDefinition[] = [
  {
    id: "clear_the_rats",
    titleKey: "quest.clear_the_rats.title" as ContentLocalizationKey,
    descriptionKey: "quest.clear_the_rats.description" as ContentLocalizationKey,
    greetingKey: "quest.clear_the_rats.greeting" as ContentLocalizationKey,
    turnInKey: "quest.clear_the_rats.turn_in" as ContentLocalizationKey,
    completedKey: "quest.clear_the_rats.completed" as ContentLocalizationKey,
    xpReward: 10,
    copperReward: 8,
  },
] as const satisfies readonly QuestContentDefinition[];
