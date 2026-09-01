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
    expect(secondary).toEqual({ skillId: "grave_spark", range: 96, damage: 3, cooldownMs: 1500 });

    const tertiary = resolveSkillSlotDefinition("tertiary", "gravewalker");
    expect(tertiary).toEqual({ skillId: "bone_splinter", range: 140, damage: 5, cooldownMs: 2600 });
  });

  it("resolves Ironclad's own, different secondary/tertiary skills", () => {
    const secondary = resolveSkillSlotDefinition("secondary", "ironclad");
    expect(secondary).toEqual({ skillId: "shatter_blow", range: 64, damage: 6, cooldownMs: 1300 });

    const tertiary = resolveSkillSlotDefinition("tertiary", "ironclad");
    expect(tertiary).toEqual({ skillId: "groundbreaker", range: 80, damage: 10, cooldownMs: 3200 });
  });
});
