import { describe, expect, it } from "vitest";
import { contentRegistry } from "@doomscrolls/content";

/**
 * Core 0.33 follow-up -- the client's enemy placeholder view
 * (worldSessionEnemyPlaceholderView.ts) used to derive an enemy's visual
 * from a hardcoded substring match on the enemy's opaque instance id
 * (`enemy.id.includes("trashboar_brute")`, etc.), silently defaulting
 * every other real enemy type to a generic "runt" look -- a real
 * content-driven-rule violation (see the enemy investigation). The fix
 * replaced that with a real lookup: `contentRegistry.enemies.get(enemy.
 * enemyId).spriteKey`, keyed against each enemy's own real content field.
 *
 * That fix only works if `spriteKey` genuinely distinguishes every real
 * enemy type -- which it did NOT before this build (trashboar_runt,
 * trashboar_skitter, and trashboar_brute all shared the literal same
 * `"enemy_trashboar_runt_placeholder"` string, an authoring gap that
 * would have collapsed all three into one visual once the client
 * started reading spriteKey for real). This is a permanent regression
 * asset for that data, not just this build's fix -- content validation
 * (ContentValidation.ts) checks referential integrity but not sprite-key
 * uniqueness, so nothing else in the suite would catch this reappearing.
 */
describe("enemy spriteKey identity", () => {
  it("every enemy defines a spriteKey", () => {
    for (const enemy of contentRegistry.enemies.all) {
      expect(enemy.spriteKey, `${enemy.id} is missing spriteKey`).toBeDefined();
      expect(enemy.spriteKey.length, `${enemy.id}'s spriteKey must not be empty`).toBeGreaterThan(0);
    }
  });

  it("no two distinct enemy types share a spriteKey (the exact regression this build fixed)", () => {
    const spriteKeyToEnemyIds = new Map<string, string[]>();
    for (const enemy of contentRegistry.enemies.all) {
      const existing = spriteKeyToEnemyIds.get(enemy.spriteKey) ?? [];
      existing.push(enemy.id);
      spriteKeyToEnemyIds.set(enemy.spriteKey, existing);
    }

    const collisions = [...spriteKeyToEnemyIds.entries()].filter(([, ids]) => ids.length > 1);
    expect(collisions, `spriteKey collisions found: ${JSON.stringify(collisions)}`).toEqual([]);
  });

  it("the three real Trashboar variants specifically have distinct spriteKeys", () => {
    const runt = contentRegistry.enemies.require("trashboar_runt" as never);
    const skitter = contentRegistry.enemies.require("trashboar_skitter" as never);
    const brute = contentRegistry.enemies.require("trashboar_brute" as never);

    expect(runt.spriteKey).toBe("enemy_trashboar_runt_placeholder");
    expect(skitter.spriteKey).toBe("enemy_trashboar_skitter_placeholder");
    expect(brute.spriteKey).toBe("enemy_trashboar_brute_placeholder");

    const distinctKeys = new Set([runt.spriteKey, skitter.spriteKey, brute.spriteKey]);
    expect(distinctKeys.size).toBe(3);
  });

  it("all 12 real enemy types across every zone resolve to 12 distinct spriteKeys", () => {
    const allSpriteKeys = new Set(contentRegistry.enemies.all.map((enemy) => enemy.spriteKey));
    expect(contentRegistry.enemies.all.length).toBe(12);
    expect(allSpriteKeys.size).toBe(12);
  });
});
