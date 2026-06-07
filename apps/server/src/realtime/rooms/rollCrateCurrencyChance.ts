import { createRng } from "./serverRng";

/**
 * Task 188 — Basic Loot Container Currency Chance
 *
 * Roll a small copper amount for a shared loot container.
 *
 * The container has a fixed chance to also drop a small amount of
 * copper alongside (or instead of) its item loot. The amount is a
 * small integer in {@link CRATE_CURRENCY_MIN}-{@link CRATE_CURRENCY_MAX}
 * inclusive; `0` means "no currency drop this open".
 *
 * The roll is server-authoritative and uses a deterministic seeded RNG
 * folded with the container id and current timestamp, so the chance
 * is consistent and not predictable from the client. Client code never
 * decides currency drops.
 */
export const CRATE_CURRENCY_DROP_CHANCE = 0.35;
export const CRATE_CURRENCY_MIN = 1;
export const CRATE_CURRENCY_MAX = 5;

/**
 * Container id -> 32-bit seed hash, kept here so the crate currency
 * helper is self-contained and the chance is reusable across rooms.
 */
function hashContainerId(containerId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < containerId.length; i += 1) {
    hash ^= containerId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function rollCrateCurrencyChance(
  containerId: string,
  now: number,
): number {
  const seedBase = (hashContainerId(containerId) ^ (now >>> 0)) >>> 0;
  const rng = createRng(seedBase);
  const chanceRoll = rng.nextFloat();
  if (chanceRoll >= CRATE_CURRENCY_DROP_CHANCE) {
    return 0;
  }
  const span = CRATE_CURRENCY_MAX - CRATE_CURRENCY_MIN + 1;
  return CRATE_CURRENCY_MIN + rng.nextInt(0, span);
}
