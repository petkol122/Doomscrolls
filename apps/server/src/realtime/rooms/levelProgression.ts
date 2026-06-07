import { contentRegistry } from "@doomscrolls/content";

const DEFAULT_LEVEL_TABLE_ID = "level_1_to_10";

export type LevelProgressionSkipReason =
  | "missing_level_table"
  | "invalid_current_level"
  | "invalid_next_xp"
  | "missing_level_threshold";

export interface ResolvedLevelProgression {
  readonly xp: number;
  readonly level: number;
  readonly leveledUp: boolean;
}

export type LevelProgressionResult =
  | { readonly ok: true; readonly progression: ResolvedLevelProgression }
  | { readonly ok: false; readonly reason: LevelProgressionSkipReason };

export function tryResolveLevelProgression(
  currentLevel: number,
  nextXp: number,
): LevelProgressionResult {
  const levelTable = contentRegistry.levelTables.get(DEFAULT_LEVEL_TABLE_ID);

  if (levelTable === undefined) {
    return { ok: false, reason: "missing_level_table" };
  }

  if (!Number.isFinite(currentLevel) || currentLevel < 1) {
    return { ok: false, reason: "invalid_current_level" };
  }

  if (!Number.isFinite(nextXp) || nextXp < 0) {
    return { ok: false, reason: "invalid_next_xp" };
  }

  if (levelTable.levels.length === 0) {
    return { ok: false, reason: "missing_level_threshold" };
  }

  let resolvedLevel = 1;
  for (const threshold of levelTable.levels) {
    if (!Number.isFinite(threshold.requiredXp)) {
      return { ok: false, reason: "missing_level_threshold" };
    }

    if (nextXp < threshold.requiredXp) {
      break;
    }

    resolvedLevel = Math.max(resolvedLevel, threshold.level);
  }

  const normalizedCurrentLevel = Math.max(1, Math.floor(currentLevel));

  return {
    ok: true,
    progression: {
      xp: Math.max(0, Math.floor(nextXp)),
      level: Math.max(normalizedCurrentLevel, resolvedLevel),
      leveledUp: resolvedLevel > normalizedCurrentLevel,
    },
  };
}

export function resolveLevelProgression(
  currentLevel: number,
  nextXp: number,
): ResolvedLevelProgression {
  const result = tryResolveLevelProgression(currentLevel, nextXp);

  if (!result.ok) {
    if (result.reason === "missing_level_table") {
      throw new Error(`Missing level table content definition: ${DEFAULT_LEVEL_TABLE_ID}`);
    }

    if (result.reason === "missing_level_threshold") {
      throw new Error(`Invalid level table thresholds: ${DEFAULT_LEVEL_TABLE_ID}`);
    }

    if (result.reason === "invalid_current_level") {
      throw new Error(`Invalid current level: ${String(currentLevel)}`);
    }

    throw new Error(`Invalid next xp: ${String(nextXp)}`);
  }

  return result.progression;
}