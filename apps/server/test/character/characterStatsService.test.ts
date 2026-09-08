import { describe, expect, it } from "vitest";
import type { StatModifier } from "@doomscrolls/shared";
import { CharacterStatsService } from "../../src/character/CharacterStatsService";

/**
 * Core 0.10 -- first-ever unit coverage for `CharacterStatsService`.
 * Directly proves `calculateEquippedStats` folds a `damage` stat
 * modifier into `derived.damage`, independent of any room -- the fast,
 * isolated half of this build's two-layer verification (the other half
 * is the per-room integration proof that combat resolution actually
 * consumes the resulting number; see `test/combat/basicAttackDamage.test.ts`
 * and `test/combat/skillSlotCasting.test.ts`).
 *
 * Core 0.11 -- extended with the equivalent `armor` case: proves
 * `calculateEquippedStats` folds an `armor` stat modifier into
 * `derived.armor` the same way it does for `damage`. The per-room
 * integration proof that incoming damage actually consults the
 * resulting number lives in `test/combat/incomingDamageMitigation.test.ts`
 * and its `test/town/` equivalent.
 */
describe("CharacterStatsService.calculateEquippedStats", () => {
  const service = new CharacterStatsService();
  const basePrimaryStats = { power: 3, speed: 1, mind: 2, toughness: 3 };

  it("computes derived.damage as 1 + power with no equipped modifiers", () => {
    const result = service.calculateEquippedStats(basePrimaryStats, [], 1);
    expect(result.derived.damage).toBe(4);
  });

  it("adds an equipped weapon's damage modifier on top of the base value", () => {
    const modifiers: StatModifier[] = [{ target: "damage", operation: "add", value: 3 }];
    const baseline = service.calculateEquippedStats(basePrimaryStats, [], 1);
    const withWeapon = service.calculateEquippedStats(basePrimaryStats, modifiers, 1);

    expect(withWeapon.derived.damage).toBe(baseline.derived.damage + 3);
  });

  it("multiplies derived.damage when a modifier's operation is multiply", () => {
    const modifiers: StatModifier[] = [{ target: "damage", operation: "multiply", value: 2 }];
    const baseline = service.calculateEquippedStats(basePrimaryStats, [], 1);
    const withWeapon = service.calculateEquippedStats(basePrimaryStats, modifiers, 1);

    expect(withWeapon.derived.damage).toBe(baseline.derived.damage * 2);
  });

  it("computes derived.armor as 0 with no equipped modifiers", () => {
    const result = service.calculateEquippedStats(basePrimaryStats, [], 1);
    expect(result.derived.armor).toBe(0);
  });

  it("adds an equipped armor piece's armor modifier on top of the base value", () => {
    const modifiers: StatModifier[] = [{ target: "armor", operation: "add", value: 5 }];
    const withArmor = service.calculateEquippedStats(basePrimaryStats, modifiers, 1);

    expect(withArmor.derived.armor).toBe(5);
  });
});
