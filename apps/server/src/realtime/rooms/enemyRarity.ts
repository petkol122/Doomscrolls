import type { EnemyRarity } from "@doomscrolls/shared";
import type { Rng } from "./serverRng";

/**
 * Core 0.1 Foundation -- Enemy Rarity Tiers.
 *
 * Server-authoritative stat/loot scaling per rarity tier, applied once
 * at spawn time (see `initializeTownEnemies.ts` / `initializeCombatEnemies.ts`)
 * and read again whenever an enemy's content-defined damage is looked up
 * (`TownRoom.applyEnemyAggroDamage` / `CombatRoom.applyCombatEnemyAggroDamage`),
 * so a Champion/Elite's authored hp/damage advantage holds for its whole
 * lifetime, not just the initial spawn tick.
 */
export interface EnemyRarityMultiplier {
  readonly hp: number;
  readonly damage: number;
  /** Currency drop amount multiplier (rollCurrencyLoot). */
  readonly currency: number;
  /** Extra guaranteed loot-roll attempts on top of the normal roll (rollLoot). */
  readonly bonusLootRolls: number;
}

const ENEMY_RARITY_MULTIPLIERS: Readonly<Record<EnemyRarity, EnemyRarityMultiplier>> = {
  normal: { hp: 1, damage: 1, currency: 1, bonusLootRolls: 0 },
  champion: { hp: 1.5, damage: 1.2, currency: 1.5, bonusLootRolls: 1 },
  elite: { hp: 2, damage: 1.4, currency: 2, bonusLootRolls: 2 },
};

/** Tolerant of any plain string arriving from schema/content boundaries -- unrecognized values fall back to "normal". */
export function getEnemyRarityMultiplier(rarity: string): EnemyRarityMultiplier {
  return ENEMY_RARITY_MULTIPLIERS[rarity as EnemyRarity] ?? ENEMY_RARITY_MULTIPLIERS.normal;
}

/**
 * Roll a pack leader's rarity from a spawn zone's `leaderEliteChance` /
 * `leaderChampionChance` (both 0-1, absent = 0). Elite is checked first
 * so the two chances stay independent tiers rather than stacking ranges.
 */
export function rollEnemyRarity(
  rng: Rng,
  eliteChance: number | undefined,
  championChance: number | undefined,
): EnemyRarity {
  if (eliteChance !== undefined && eliteChance > 0 && rng.nextFloat() < eliteChance) {
    return "elite";
  }
  if (championChance !== undefined && championChance > 0 && rng.nextFloat() < championChance) {
    return "champion";
  }
  return "normal";
}
