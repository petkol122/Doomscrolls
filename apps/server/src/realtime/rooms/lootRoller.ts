import type { LootTableEntryDefinition } from "@doomscrolls/content";
import type { ItemDefinitionId, WeightedEntry } from "@doomscrolls/shared";
import { createRng } from "./serverRng";

/**
 * Explicit no-drop weighted entry.
 */
export interface NoDropLootEntry {
  readonly kind: "no_drop";
  readonly weight: number;
}

/**
 * Weighted item loot entry used by the generic server loot roller.
 */
export interface ItemLootEntry {
  readonly kind: "item";
  readonly itemId: ItemDefinitionId;
  readonly weight: number;
}

/**
 * Weighted loot entries accepted by the generic server loot roller.
 */
export type LootRollEntry = ItemLootEntry | NoDropLootEntry;

/**
 * Result of rolling a loot table.
 */
export interface LootRollResult {
  readonly itemId: ItemDefinitionId | null;
  readonly dropped: boolean;
}

/**
 * Options for loot roll.
 */
export interface LootRollOptions {
  /** Optional configured no-drop weight added to the weighted roll. */
  readonly noDropWeight?: number;
}

function validateWeight(weight: number, context: string): void {
  if (!Number.isFinite(weight)) {
    throw new Error(`${context}: weight must be finite`);
  }

  if (weight < 0) {
    throw new Error(`${context}: weight must be non-negative`);
  }
}

function toWeightedEntries(entries: readonly LootRollEntry[]): WeightedEntry<string>[] {
  return entries.map((entry) => {
    validateWeight(entry.weight, "rollLootTable");

    return {
      id: entry.kind === "item" ? entry.itemId : "__no_drop__",
      weight: entry.weight,
    };
  });
}

function normalizeLootEntries(
  entries: readonly LootRollEntry[],
  options?: LootRollOptions,
): WeightedEntry<string>[] {
  if (entries.length === 0) {
    throw new Error("rollLootTable: table cannot be empty");
  }

  const weightedEntries = toWeightedEntries(entries);
  const noDropWeight = options?.noDropWeight;

  if (noDropWeight !== undefined) {
    validateWeight(noDropWeight, "rollLootTable");
    weightedEntries.push({ id: "__no_drop__", weight: noDropWeight });
  }

  const totalWeight = weightedEntries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    throw new Error("rollLootTable: total weight must be greater than zero");
  }

  return weightedEntries;
}

/**
 * Convert existing content loot-table entries into generic loot-roll entries.
 */
export function toLootRollEntries(
  entries: readonly LootTableEntryDefinition[],
): readonly LootRollEntry[] {
  return entries.map((entry) => ({
    kind: "item",
    itemId: entry.itemId,
    weight: entry.weight,
  }));
}

/**
 * Roll weighted loot entries using deterministic server RNG.
 */
export function rollLootTable(
  seed: number,
  entries: readonly LootRollEntry[],
  options?: LootRollOptions,
): LootRollResult {
  return createLootRoller(seed).roll(entries, options);
}

/**
 * Creates a deterministic loot roller using the provided seed.
 * The same seed always produces the same loot roll sequence.
 */
export function createLootRoller(seed: number) {
  const rng = createRng(seed);

  return {
    roll,
    rollContentTable,
  };

  /**
   * Roll generic weighted loot entries and return a selected item or no-drop.
   */
  function roll(
    entries: readonly LootRollEntry[],
    options?: LootRollOptions,
  ): LootRollResult {
    const weightedEntries = normalizeLootEntries(entries, options);
    const result = rng.pickWeighted(weightedEntries);

    if (result.id === "__no_drop__") {
      return {
        itemId: null,
        dropped: false,
      };
    }

    return {
      itemId: result.id as ItemDefinitionId,
      dropped: true,
    };
  }

  /**
   * Roll existing content loot-table entries.
   */
  function rollContentTable(
    entries: readonly LootTableEntryDefinition[],
    options?: LootRollOptions,
  ): LootRollResult {
    return roll(toLootRollEntries(entries), options);
  }
}