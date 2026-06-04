import type { EnemyPresence } from "@doomscrolls/shared";

export interface ApplyEnemyDamageResult {
  readonly previousHp: number;
  readonly appliedDamage: number;
  readonly remainingHp: number;
}

export function applyEnemyDamage(
  enemy: EnemyPresence,
  requestedDamage: number,
): ApplyEnemyDamageResult {
  const previousHp = Number.isFinite(enemy.hp) ? enemy.hp : 0;
  const normalizedDamage = Number.isFinite(requestedDamage)
    ? Math.max(0, Math.floor(requestedDamage))
    : 0;
  const remainingHp = Math.max(0, previousHp - normalizedDamage);

  enemy.hp = remainingHp;

  return {
    previousHp,
    appliedDamage: Math.max(0, previousHp - remainingHp),
    remainingHp,
  };
}