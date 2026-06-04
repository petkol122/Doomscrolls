import type { EnemyPresence } from "@doomscrolls/shared";

export interface ApplyEnemyDamageResult {
  readonly previousHp: number;
  readonly appliedDamage: number;
  readonly remainingHp: number;
  readonly defeated: boolean;
  readonly respawnAtMs: number;
}

export const ENEMY_RESPAWN_DELAY_MS = 5_000;

export function applyEnemyDamage(
  enemy: EnemyPresence,
  requestedDamage: number,
): ApplyEnemyDamageResult {
  const previousHp = Number.isFinite(enemy.hp) ? enemy.hp : 0;

  if (enemy.defeated || previousHp <= 0) {
    enemy.hp = 0;
    enemy.defeated = true;
    if (!Number.isFinite(enemy.respawnAtMs) || enemy.respawnAtMs <= 0) {
      enemy.respawnAtMs = Date.now() + ENEMY_RESPAWN_DELAY_MS;
    }

    return {
      previousHp,
      appliedDamage: 0,
      remainingHp: 0,
      defeated: true,
      respawnAtMs: enemy.respawnAtMs,
    };
  }

  const normalizedDamage = Number.isFinite(requestedDamage)
    ? Math.max(0, Math.floor(requestedDamage))
    : 0;
  const remainingHp = Math.max(0, previousHp - normalizedDamage);

  enemy.hp = remainingHp;
  enemy.defeated = remainingHp <= 0;
  enemy.respawnAtMs = enemy.defeated ? Date.now() + ENEMY_RESPAWN_DELAY_MS : 0;

  return {
    previousHp,
    appliedDamage: Math.max(0, previousHp - remainingHp),
    remainingHp,
    defeated: enemy.defeated,
    respawnAtMs: enemy.respawnAtMs,
  };
}