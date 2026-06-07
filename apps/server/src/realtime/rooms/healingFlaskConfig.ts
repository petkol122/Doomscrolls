import type { PlayerPresence } from "./PlayerPresence";

// ---------------------------------------------------------------------------
// Task 096 — Basic Healing Flask Foundation.
//
// Server-owned, intentionally simple constants for the basic healing
// flask. There is no per-character stat, no flask affixes, no belt
// system, no refill rules, no shop / vendor and no persistence yet:
//   - the flask is granted a fixed number of charges on join / respawn
//   - each charge heals a fixed amount, clamped to maxHp
//   - each charge has a fixed cooldown
//   - the cooldown timestamp is stored on the player presence
//
// The client never sets, computes or trusts any of these values; it
// only reads `flaskCharges` / `nextFlaskAt` from the synced room state
// and shows safe feedback text from the server reply.
// ---------------------------------------------------------------------------

/**
 * Fixed amount healed per successful flask charge, in HP. Core 0.1
 * uses a single value across all characters / origins / classes.
 */
export const HEALING_FLASK_HEAL_AMOUNT = 25;

/**
 * Fixed per-charge cooldown in milliseconds.
 */
export const HEALING_FLASK_COOLDOWN_MS = 1500;

/**
 * Fixed number of charges a player has on join / respawn.
 */
export const HEALING_FLASK_MAX_CHARGES = 3;

export function isFlaskReady(
  player: PlayerPresence | undefined,
  now: number,
): boolean {
  if (player === undefined) {
    return false;
  }
  const nextFlaskAt = Number.isFinite(player.nextFlaskAt) ? player.nextFlaskAt : 0;
  return now >= nextFlaskAt;
}

export function consumeFlaskCooldown(
  player: PlayerPresence,
  now: number,
  cooldownMs: number = HEALING_FLASK_COOLDOWN_MS,
): number {
  player.nextFlaskAt = now + cooldownMs;
  return player.nextFlaskAt;
}

/**
 * Restore the flask state to a freshly-respawned / freshly-joined
 * state: full charges and a ready cooldown.
 */
export function restoreFlaskToFull(player: PlayerPresence): void {
  player.maxFlaskCharges = HEALING_FLASK_MAX_CHARGES;
  player.flaskCharges = HEALING_FLASK_MAX_CHARGES;
  player.nextFlaskAt = 0;
}
