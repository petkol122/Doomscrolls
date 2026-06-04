import { contentRegistry } from "@doomscrolls/content";

const DEFAULT_LEVEL_TABLE_ID = "level_1_to_10";

export interface ResolvedLevelProgression {
  readonly xp: number;
  readonly level: number;
  readonly leveledUp: boolean;
}

export function resolveLevelProgression(currentLevel: number, nextXp: number): ResolvedLevelProgression {
  const levelTable = contentRegistry.levelTables.get(DEFAULT_LEVEL_TABLE_ID);

  if (levelTable === undefined) {
    throw new Error(`Missing level table content definition: ${DEFAULT_LEVEL_TABLE_ID}`);
  }

  let resolvedLevel = 1;
  for (const threshold of levelTable.levels) {
    if (nextXp < threshold.requiredXp) {
      break;
    }
    resolvedLevel = Math.max(resolvedLevel, threshold.level);
  }

  const normalizedCurrentLevel = Math.max(1, Math.floor(currentLevel));

  return {
    xp: Math.max(0, Math.floor(nextXp)),
    level: Math.max(normalizedCurrentLevel, resolvedLevel),
    leveledUp: resolvedLevel > normalizedCurrentLevel,
  };
}