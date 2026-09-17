import { describe, expect, it } from "vitest";
import { resolveSkillSlotDefinition } from "../../src/realtime/rooms/skillSlotContent";

/**
 * Regression for Core 0.9's real fix: `resolveSkillSlotDefinition` used to
 * hardcode `DEFAULT_CLASS_ID = "gravewalker"` and ignore any class
 * argument entirely. Every class would have silently resolved through
 * Gravewalker's skill mapping. This is the fast, direct proof that the
 * `classKey` parameter is actually consulted, not just accepted and
 * ignored -- no room/server needed.
 */
describe("resolveSkillSlotDefinition", () => {
  it("resolves Gravewalker's own secondary/tertiary skills", () => {
    const secondary = resolveSkillSlotDefinition("secondary", "gravewalker");
    expect(secondary).toEqual({
      skillId: "grave_spark", range: 96, damage: 3, cooldownMs: 1500, manaCost: 12, maxRank: 5, damagePerRank: 2,
      // Core 0.2 -- grave_spark applies a "slow" debuff on hit.
      appliesEffect: "slow", effectDurationMs: 2500, effectMagnitude: 0.35,
    });

    const tertiary = resolveSkillSlotDefinition("tertiary", "gravewalker");
    expect(tertiary).toEqual({
      skillId: "bone_splinter", range: 140, damage: 5, cooldownMs: 2600, manaCost: 20, maxRank: 5, damagePerRank: 3,
      // Core 0.2 -- bone_splinter applies a "bleed" DoT on hit.
      appliesEffect: "bleed", effectDurationMs: 4000, effectMagnitude: 2,
    });
  });

  it("resolves Ironclad's own, different secondary/tertiary skills", () => {
    const secondary = resolveSkillSlotDefinition("secondary", "ironclad");
    expect(secondary).toEqual({
      skillId: "shatter_blow", range: 64, damage: 6, cooldownMs: 1300, manaCost: 12, maxRank: 5, damagePerRank: 2,
      // Core 0.2 -- shatter_blow applies a brief "stun" on hit.
      appliesEffect: "stun", effectDurationMs: 700, effectMagnitude: 0,
    });

    const tertiary = resolveSkillSlotDefinition("tertiary", "ironclad");
    expect(tertiary).toEqual({
      skillId: "groundbreaker", range: 80, damage: 10, cooldownMs: 3200, manaCost: 22, maxRank: 5, damagePerRank: 3,
      // Core 0.2 -- groundbreaker applies a longer "stun" on hit.
      appliesEffect: "stun", effectDurationMs: 1400, effectMagnitude: 0,
    });
  });

  /**
   * Core 0.14 -- the new "primary" slot resolves the class's
   * `startingSkillId` (heavy_strike for both current classes), a field
   * every class definition already carried but that no slot had ever
   * consulted before this build.
   */
  it("resolves both classes' primary slot to their startingSkillId (heavy_strike)", () => {
    const gravewalkerPrimary = resolveSkillSlotDefinition("primary", "gravewalker");
    expect(gravewalkerPrimary).toEqual({ skillId: "heavy_strike", range: 64, damage: 3, cooldownMs: 1000, manaCost: 0, maxRank: 5, damagePerRank: 1 });

    const ironcladPrimary = resolveSkillSlotDefinition("primary", "ironclad");
    expect(ironcladPrimary).toEqual({ skillId: "heavy_strike", range: 64, damage: 3, cooldownMs: 1000, manaCost: 0, maxRank: 5, damagePerRank: 1 });
  });
});
