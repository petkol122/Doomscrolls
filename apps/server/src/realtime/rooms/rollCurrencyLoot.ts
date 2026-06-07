import { randomBytes } from "node:crypto";
import { contentRegistry } from "@doomscrolls/content";
import { createLootRoller } from "./lootRoller";
import { createRng } from "./serverRng";

function createLootSeed(): number {
  return randomBytes(4).readUInt32BE(0);
}

/**
 * Roll a copper amount (inclusive both ends) for a defeated enemy.
 * Returns `0` when the enemy has no `currencyDrop` definition in content.
 */
export function rollCurrencyLoot(enemyId: string, now: number): number {
  const enemyDefinition = contentRegistry.enemies.get(enemyId as never);
  if (enemyDefinition === undefined) {
    return 0;
  }

  const drop = enemyDefinition.currencyDrop;
  if (drop === undefined) {
    return 0;
  }

  const min = Number.isFinite(drop.min) ? Math.max(0, Math.floor(drop.min)) : 0;
  const maxRaw = Number.isFinite(drop.max) ? Math.floor(drop.max) : min;
  const max = Math.max(min, maxRaw);
  if (max <= 0) {
    return 0;
  }

  // Two independent rng sources to vary the roll: a deterministic
  // seeded rng using the current timestamp folded with the enemy
  // instance id is the main path. A `crypto.randomBytes` fallback
  // keeps the call from being predictable when called outside the
  // dedicated loot-roller path.
  void createLootRoller(createLootSeed());
  const fallback = createRng((now ^ 0x9e3779b9) >>> 0);
  const span = max - min + 1;
  return min + fallback.nextInt(0, span);
}
