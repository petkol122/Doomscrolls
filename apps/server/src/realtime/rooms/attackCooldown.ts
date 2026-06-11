import type { PlayerPresence } from "./PlayerPresence";

// Task 206 -- lower default attack cooldown for snappier Diablo-like
// combat feel. Task 306 -- reduced from 700 ms to 600 ms as part of
// the combat feel tuning batch. The server is still the sole authority
// for cooldown timing; clients may not influence it.
export const DEFAULT_ATTACK_COOLDOWN_MS = 600;

export function resolveAttackCooldownMs(value: number | null | undefined): number {
  return Number.isFinite(value) && value !== undefined && value !== null && value >= 100
    ? value
    : DEFAULT_ATTACK_COOLDOWN_MS;
}

export function isAttackReady(
  player: PlayerPresence | undefined,
  now: number,
): boolean {
  if (player === undefined) {
    return false;
  }

  const nextAttackAt = Number.isFinite(player.nextAttackAt) ? player.nextAttackAt : 0;
  return now >= nextAttackAt;
}

export function consumeAttackCooldown(
  player: PlayerPresence,
  now: number,
): { readonly cooldownMs: number; readonly nextAttackAt: number } {
  const cooldownMs = resolveAttackCooldownMs(player.attackCooldownMs);
  player.attackCooldownMs = cooldownMs;
  player.lastAttackAt = now;
  player.nextAttackAt = now + cooldownMs;

  return {
    cooldownMs,
    nextAttackAt: player.nextAttackAt,
  };
}
