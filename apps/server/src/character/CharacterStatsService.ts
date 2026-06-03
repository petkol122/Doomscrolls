import type { PrimaryStats } from "@doomscrolls/shared";
import type { StartingCharacterStats } from "./CharacterTypes";

/**
 * Core 0.1 starting stat calculator.
 *
 * Primary stats are additive: origin base stats + class base stats.
 * Derived stats are deterministic server-owned values:
 * - maxHp = 20 + toughness * 5
 * - damage = 1 + power
 * - armor = 0
 * - moveSpeed = 1 + speed * 0.02
 * - attackCooldownMs = max(500, 1100 - speed * 25)
 */
export class CharacterStatsService {
  public calculateStartingStats(originStats: PrimaryStats, classStats: PrimaryStats): StartingCharacterStats {
    const primary: PrimaryStats = {
      power: originStats.power + classStats.power,
      speed: originStats.speed + classStats.speed,
      mind: originStats.mind + classStats.mind,
      toughness: originStats.toughness + classStats.toughness,
    };

    return {
      primary,
      derived: {
        maxHp: 20 + primary.toughness * 5,
        damage: 1 + primary.power,
        armor: 0,
        moveSpeed: 1 + primary.speed * 0.02,
        attackCooldownMs: Math.max(500, 1100 - primary.speed * 25),
      },
    };
  }
}