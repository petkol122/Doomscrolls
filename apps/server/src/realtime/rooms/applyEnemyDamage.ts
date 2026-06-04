import type { EnemyPresence } from "@doomscrolls/shared";

export interface ApplyEnemyDamageResult {
  readonly previousHp: number;
  readonly appliedDamage: number;
  readonly remainingHp: number;
  readonly defeated: boolean;
}

export function applyEnemyDamage(
  enemy: EnemyPresence,
  requestedDamage: number,
): ApplyEnemyDamageResult {
  const previousHp = Number.isFinite(enemy.hp) ? enemy.hp : 0;

  if (enemy.defeated || previousHp <= 0) {
    enemy.hp = 0;
    enemy.defeated = true;

    return {
      previousHp,
      appliedDamage: 0,
      remainingHp: 0,
      defeated: true,
    };
  }

  const normalizedDamage = Number.isFinite(requestedDamage)
    ? Math.max(0, Math.floor(requestedDamage))
    : 0;
  const remainingHp = Math.max(0, previousHp - normalizedDamage);

  enemy.hp = remainingHp;
  enemy.defeated = remainingHp <= 0;

  return {
    previousHp,
    appliedDamage: Math.max(0, previousHp - remainingHp),
    remainingHp,
    defeated: enemy.defeated,
  };
}