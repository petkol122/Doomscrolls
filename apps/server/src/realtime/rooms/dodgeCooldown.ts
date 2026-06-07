import type { PlayerPresence } from "./PlayerPresence";

/**
 * Task 095 — Player Dodge Intent Foundation.
 *
 * The dodge cooldown is a server-owned, intentionally simple, fixed
 * value. There is no per-character stat, no stamina resource, and no
 * skill system. The cooldown exists so a player cannot dodge
 * continuously, but it is intentionally short (1.5s) and constant
 * across all characters for Core 0.1.
 */
export const DEFAULT_DODGE_COOLDOWN_MS = 1500;

/**
 * Fixed dodge distance in world units. Used by the applyDodgeIntent
 * helper. The dodge is intentionally not scaled by speed / class
 * / origin in this foundation batch.
 */
export const DEFAULT_DODGE_DISTANCE = 60;

export function isDodgeReady(
  player: PlayerPresence | undefined,
  now: number,
): boolean {
  if (player === undefined) {
    return false;
  }
  const nextDodgeAt = Number.isFinite(player.nextDodgeAt) ? player.nextDodgeAt : 0;
  return now >= nextDodgeAt;
}

/**
 * Mark the player's next dodge availability as `now + cooldownMs`.
 * Returns the new `nextDodgeAt` timestamp.
 */
export function consumeDodgeCooldown(
  player: PlayerPresence,
  now: number,
  cooldownMs: number = DEFAULT_DODGE_COOLDOWN_MS,
): number {
  player.nextDodgeAt = now + cooldownMs;
  return player.nextDodgeAt;
}
