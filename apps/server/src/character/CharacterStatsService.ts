import type { DerivedStats, PrimaryStats, StatModifier } from "@doomscrolls/shared";
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
 * - attackCooldownMs = max(500, 1000 - speed * 25)
 *   (Task 306: reduced base from 1100 to 1000 for snappier
 *    starting attack cadence — ~925 ms at speed 3 vs 1025 ms)
 */
export class CharacterStatsService {
  private static readonly MAX_HP_PER_LEVEL = 3;

  public calculateStartingStats(originStats: PrimaryStats, classStats: PrimaryStats): StartingCharacterStats {
    return this.calculateLevelScaledStats(originStats, classStats, 1);
  }

  public calculateLevelScaledStats(
    originStats: PrimaryStats,
    classStats: PrimaryStats,
    level: number,
  ): StartingCharacterStats {
    const primary = this.buildPrimaryStats({
      power: originStats.power + classStats.power,
      speed: originStats.speed + classStats.speed,
      mind: originStats.mind + classStats.mind,
      toughness: originStats.toughness + classStats.toughness,
    });

    return {
      primary,
      derived: this.calculateDerivedStats(primary, level),
    };
  }

  public calculateEquippedStats(
    basePrimaryStats: PrimaryStats,
    modifiers: readonly StatModifier[],
    level: number = 1,
  ): StartingCharacterStats {
    const primary = this.applyPrimaryModifiers(basePrimaryStats, modifiers);
    const derived = this.applyDerivedModifiers(this.calculateDerivedStats(primary, level), modifiers);

    return { primary, derived };
  }

  private buildPrimaryStats(input: PrimaryStats): PrimaryStats {
    return {
      power: input.power,
      speed: input.speed,
      mind: input.mind,
      toughness: input.toughness,
    };
  }

  private calculateDerivedStats(primary: PrimaryStats, level: number = 1): DerivedStats {
    const normalizedLevel = Math.max(1, Math.floor(level));
    const levelHpBonus = (normalizedLevel - 1) * CharacterStatsService.MAX_HP_PER_LEVEL;

    return {
      maxHp: 20 + primary.toughness * 5 + levelHpBonus,
      damage: 1 + primary.power,
      armor: 0,
      moveSpeed: 1 + primary.speed * 0.02,
      // Task 306: base 1000 (was 1100) gives ~925 ms at speed 3
      // instead of 1025 ms — a modest feel improvement while
      // keeping the 500 ms hard floor for high-speed builds.
      attackCooldownMs: Math.max(500, 1000 - primary.speed * 25),
    };
  }

  private applyPrimaryModifiers(
    basePrimaryStats: PrimaryStats,
    modifiers: readonly StatModifier[],
  ): PrimaryStats {
    let power = basePrimaryStats.power;
    let speed = basePrimaryStats.speed;
    let mind = basePrimaryStats.mind;
    let toughness = basePrimaryStats.toughness;

    for (const modifier of modifiers) {
      switch (modifier.target) {
        case "power":
          power = modifier.operation === "multiply" ? power * modifier.value : power + modifier.value;
          break;
        case "speed":
          speed = modifier.operation === "multiply" ? speed * modifier.value : speed + modifier.value;
          break;
        case "mind":
          mind = modifier.operation === "multiply" ? mind * modifier.value : mind + modifier.value;
          break;
        case "toughness":
          toughness = modifier.operation === "multiply" ? toughness * modifier.value : toughness + modifier.value;
          break;
        default:
          break;
      }
    }

    return { power, speed, mind, toughness };
  }

  private applyDerivedModifiers(
    baseDerivedStats: DerivedStats,
    modifiers: readonly StatModifier[],
  ): DerivedStats {
    let maxHp = baseDerivedStats.maxHp;
    let damage = baseDerivedStats.damage;
    let armor = baseDerivedStats.armor;
    let moveSpeed = baseDerivedStats.moveSpeed;
    let attackCooldownMs = baseDerivedStats.attackCooldownMs;

    for (const modifier of modifiers) {
      switch (modifier.target) {
        case "maxHp":
          maxHp = modifier.operation === "multiply" ? maxHp * modifier.value : maxHp + modifier.value;
          break;
        case "damage":
          damage = modifier.operation === "multiply" ? damage * modifier.value : damage + modifier.value;
          break;
        case "armor":
          armor = modifier.operation === "multiply" ? armor * modifier.value : armor + modifier.value;
          break;
        case "moveSpeed":
          moveSpeed = modifier.operation === "multiply" ? moveSpeed * modifier.value : moveSpeed + modifier.value;
          break;
        case "attackCooldownMs":
          attackCooldownMs = modifier.operation === "multiply"
            ? attackCooldownMs * modifier.value
            : attackCooldownMs + modifier.value;
          break;
        default:
          break;
      }
    }

    return {
      maxHp: Math.max(1, maxHp),
      damage,
      armor,
      moveSpeed: Math.max(0.01, moveSpeed),
      attackCooldownMs: Math.max(1, attackCooldownMs),
    };
  }
}