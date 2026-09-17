import { contentRegistry } from "@doomscrolls/content";
import type { AffixRarityTier, RolledAffix } from "@doomscrolls/shared";
import { createRng } from "./serverRng";

/**
 * Milestone 0.3 -- Server-Authoritative Item Rarity & Random Affix Engine.
 *
 * Rolls a rarity tier and a set of affixes for a freshly-dropped item
 * instance, using the same deterministic seeded RNG (`serverRng.ts`)
 * every other server-side roll (loot table, currency) already uses.
 * Called once at drop time (`spawnWorldLootOnEnemyDefeat.ts`); the
 * result is persisted verbatim on pickup and never re-rolled.
 *
 * Legendary is simplified to "every affix in the pool, each at its max
 * roll" rather than curated per-item unique affix sets -- a real unique
 * system (fixed, item-specific affixes) is a larger content-authoring
 * effort out of scope here; this still satisfies "fixed high-stat
 * affixes" for a legendary drop.
 */
const TIER_WEIGHTS: readonly { readonly tier: AffixRarityTier; readonly weight: number }[] = [
  { tier: "normal", weight: 55 },
  { tier: "magic", weight: 28 },
  { tier: "rare", weight: 13 },
  { tier: "legendary", weight: 4 },
];

const MAGIC_AFFIX_RANGE = { min: 1, max: 2 } as const;
const RARE_AFFIX_RANGE = { min: 3, max: 4 } as const;

export interface RolledItemAffixes {
  readonly tier: AffixRarityTier;
  readonly affixes: readonly RolledAffix[];
}

function rollTier(rng: ReturnType<typeof createRng>): AffixRarityTier {
  const pick = rng.pickWeighted(TIER_WEIGHTS.map((entry) => ({ id: entry.tier, weight: entry.weight })));
  return pick.id;
}

function affixCountForTier(tier: AffixRarityTier, rng: ReturnType<typeof createRng>): number {
  const pool = contentRegistry.affixes.all;
  if (tier === "normal") {
    return 0;
  }
  if (tier === "magic") {
    return Math.min(pool.length, rng.nextInt(MAGIC_AFFIX_RANGE.min, MAGIC_AFFIX_RANGE.max + 1));
  }
  if (tier === "rare") {
    return Math.min(pool.length, rng.nextInt(RARE_AFFIX_RANGE.min, RARE_AFFIX_RANGE.max + 1));
  }
  return pool.length;
}

/** Fisher-Yates shuffle using the same seeded RNG, so which affixes are
 *  picked (not just their values) is fully deterministic per seed. */
function shuffled<T>(items: readonly T[], rng: ReturnType<typeof createRng>): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1);
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) {
      continue;
    }
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/**
 * Rolls a rarity tier and, for magic/rare/legendary, a distinct subset
 * of the affix pool with values rolled within each affix's own
 * `min..max` range (legendary rolls every affix at its `max`).
 */
export function rollItemAffixes(seed: number): RolledItemAffixes {
  const rng = createRng(seed);
  const tier = rollTier(rng);
  const count = affixCountForTier(tier, rng);
  if (count === 0) {
    return { tier, affixes: [] };
  }

  const chosen = shuffled(contentRegistry.affixes.all, rng).slice(0, count);
  const affixes: RolledAffix[] = chosen.map((definition) => ({
    affixId: definition.id,
    kind: definition.kind,
    nameKey: definition.nameKey,
    target: definition.target,
    operation: definition.operation,
    value: tier === "legendary" ? definition.max : rng.nextInt(definition.min, definition.max + 1),
  }));

  return { tier, affixes };
}
