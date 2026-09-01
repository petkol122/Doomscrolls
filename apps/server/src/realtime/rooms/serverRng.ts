import type { WeightedEntry, WeightedPickResult } from "@doomscrolls/shared";

/**
 * RNG state holding the internal seed value.
 */
interface RngState {
  a: number;
}

/**
 * Deterministic seeded RNG using a mulberry32 algorithm.
 * This is intentionally predictable when seeded, enabling reproducible tests.
 * Runtime loot/rolls must use an unpredictable seed (e.g., from crypto or game state).
 */
export interface Rng {
  /**
   * Generate next random float in [0, 1).
   */
  nextFloat(): number;
  /**
   * Generate random integer in [min, exclusiveMax).
   * Both bounds must be integers; exclusiveMax must be > min.
   */
  nextInt(min: number, exclusiveMax: number): number;
  /**
   * Pick one entry from a weighted table using deterministic RNG.
   * Throws on invalid input.
   */
  pickWeighted<TId extends string>(entries: WeightedEntry<TId>[]): WeightedPickResult<TId>;
}

/**
 * Create a deterministic seeded RNG.
 * The same seed always produces the same sequence.
 */
export function createRng(seed: number): Rng {
  const state: RngState = { a: seed >>> 0 };

  /**
   * Mulberry32 random float generator.
   * Returns value in [0, 1).
   */
  function nextFloat(): number {
    const t = (state.a += 0x6d2b79f5);
    let r = t;
    r = Math.imul(t ^ (t >>> 16), 0x85ebca77);
    r ^= r >>> 13;
    r = Math.imul(r, 0xc2b2ae3d);
    r ^= r >>> 15;
    return (r >>> 0) / 4294967296;
  }

  /**
   * Generate random integer in [min, exclusiveMax).
   */
  function nextInt(min: number, exclusiveMax: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(exclusiveMax)) {
      throw new Error("nextInt bounds must be integers");
    }
    if (exclusiveMax <= min) {
      throw new Error("nextInt exclusiveMax must be greater than min");
    }
    const range = exclusiveMax - min;
    return min + Math.floor(nextFloat() * range);
  }

  /**
   * Pick one entry from a weighted table using deterministic RNG.
   * Throws on invalid input.
   */
  function pickWeighted<TId extends string>(
    entries: WeightedEntry<TId>[],
  ): WeightedPickResult<TId> {
    if (entries.length === 0) {
      throw new Error("pickWeighted: table cannot be empty");
    }

    let totalWeight = 0;
    for (const entry of entries) {
      if (!Number.isFinite(entry.weight)) {
        throw new Error("pickWeighted: weight must be finite");
      }
      if (entry.weight < 0) {
        throw new Error("pickWeighted: weight must be non-negative");
      }
      totalWeight += entry.weight;
    }

    if (totalWeight === 0) {
      throw new Error("pickWeighted: total weight cannot be zero");
    }

    const roll = nextFloat() * totalWeight;
    let cumulative = 0;

    for (const entry of entries) {
      cumulative += entry.weight;
      if (roll < cumulative) {
        return { id: entry.id, weight: entry.weight };
      }
    }

    // Fallback to last entry (handles floating point edge case)
    // entries is guaranteed non-empty due to the check above
    const last = entries[entries.length - 1];
    if (last === undefined) {
      throw new Error("pickWeighted: missing fallback entry");
    }
    return { id: last.id, weight: last.weight };
  }

  return { nextFloat, nextInt, pickWeighted };
}
