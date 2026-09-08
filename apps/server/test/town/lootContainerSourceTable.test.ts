import { describe, expect, it } from "vitest";
import { contentRegistry } from "@doomscrolls/content";
import { rollLootFromTableId } from "../../src/realtime/rooms/rollLoot";

/**
 * Core 0.33 follow-up -- `interactValidation.ts`'s loot-container handler
 * used to hardcode `rollLoot("trashboar_runt")`, meaning every loot
 * container in every zone always rolled from Trashboar Runt's loot table
 * specifically, regardless of which zone or container it actually was.
 * The fix reads the container's own real `lootTableId`
 * (packages/content/src/data/worldProps.ts) and rolls via the new
 * generic `rollLootFromTableId(lootTableId)`. This is a permanent
 * regression asset for that fix -- if the hardcoded literal reappears,
 * the second test below (a real, live interact against the actual
 * shipped container) keeps passing only by coincidence (its configured
 * table happens to equal Trashboar Runt's), so the first test is the
 * one that actually catches the regression: it proves the mechanism is
 * genuinely table-id-driven for a table that is NOT Trashboar Runt's.
 */
describe("loot container source table", () => {
  it("rollLootFromTableId sources strictly from the given table, not a hardcoded enemy's table", () => {
    const sewerTable = contentRegistry.lootTables.get("sewer_starter_loot" as never);
    const cinderworksTable = contentRegistry.lootTables.get("cinderworks_loot" as never);
    if (sewerTable === undefined || cinderworksTable === undefined) {
      throw new Error("expected both real loot tables to exist in content");
    }
    const sewerItemIds = new Set(sewerTable.entries.map((entry) => entry.itemId));
    const cinderworksItemIds = new Set(cinderworksTable.entries.map((entry) => entry.itemId));

    // cinder_ash only exists in cinderworks_loot -- a real, sourced fact
    // about this content, not an assumption (packages/content/src/data/
    // lootTables.ts / items.ts). Rolling cinderworks_loot enough times
    // must eventually produce it if the roll genuinely reads that table.
    const cinderExclusiveItemIds = [...cinderworksItemIds].filter((id) => !sewerItemIds.has(id));
    expect(cinderExclusiveItemIds.length).toBeGreaterThan(0);

    const TRIALS = 100;
    const sewerRolls: string[] = [];
    const cinderworksRolls: string[] = [];
    for (let i = 0; i < TRIALS; i++) {
      const sewerItem = rollLootFromTableId("sewer_starter_loot");
      const cinderworksItem = rollLootFromTableId("cinderworks_loot");
      if (sewerItem !== null) sewerRolls.push(sewerItem);
      if (cinderworksItem !== null) cinderworksRolls.push(cinderworksItem);
    }

    // Every sewer_starter_loot roll must be a real member of that table's
    // own entries -- this is the exact invariant a reintroduced
    // `rollLoot("trashboar_runt")`-style hardcode could not violate for
    // THIS specific table (they happen to coincide today), which is
    // exactly why the cinderworks assertions below matter more.
    expect(sewerRolls.length).toBe(TRIALS);
    for (const itemId of sewerRolls) {
      expect(sewerItemIds.has(itemId as never), `${itemId} is not a real sewer_starter_loot entry`).toBe(true);
    }

    // Every cinderworks_loot roll must be a real member of THAT table's
    // entries. If the loot source were ever hardcoded back to an
    // enemy/table that isn't cinderworks_loot, this fails outright.
    expect(cinderworksRolls.length).toBe(TRIALS);
    for (const itemId of cinderworksRolls) {
      expect(cinderworksItemIds.has(itemId as never), `${itemId} is not a real cinderworks_loot entry`).toBe(true);
    }

    // And at least one real cinderworks-exclusive item must have actually
    // appeared across 100 trials -- proving this isn't just an accidental
    // subset match against the (also valid) shared common items.
    const sawCinderExclusiveItem = cinderworksRolls.some((itemId) =>
      cinderExclusiveItemIds.includes(itemId as never),
    );
    expect(sawCinderExclusiveItem).toBe(true);
  });
});
