import { describe, expect, it } from "vitest";
import { contentRegistry, validateContentRegistry } from "@doomscrolls/content";

/**
 * Core 0.16 -- `assertValidContentRegistry` (checks every enemy's loot
 * table reference, every zone's enemy/transition ids, every loot entry's
 * item id, every localization key content actually references, etc.)
 * already runs on server boot (`main.ts`), but nothing in the automated
 * test suite exercised it -- a typo in hand-written content data would
 * only surface at runtime server start, not in CI. This is a permanent
 * regression asset for all content, not just this build's additions.
 */
describe("content registry validation", () => {
  it("has no referential-integrity errors across the full content registry", () => {
    const result = validateContentRegistry(contentRegistry);

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
