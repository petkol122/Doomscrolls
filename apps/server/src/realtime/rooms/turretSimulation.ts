import type { MapSchema } from "@colyseus/schema";
import { TurretPresence, type EnemyPresence } from "@doomscrolls/shared";
import { applyEnemyDamage, type ApplyEnemyDamageResult } from "./applyEnemyDamage";

/**
 * Milestone 0.3 -- Netrunner Urban-Magic Class Archetype. Same structural-
 * state convention as `projectileSimulation.ts`/`groundAoeResolution.ts`.
 */
export interface TurretSimulationState {
  readonly enemies: MapSchema<EnemyPresence>;
  readonly turrets: MapSchema<TurretPresence>;
}

let nextTurretSequence = 0;

export interface SpawnTurretParams {
  readonly skillId: string;
  readonly ownerSessionId: string;
  readonly x: number;
  readonly y: number;
  readonly attackRange: number;
  readonly attackDamage: number;
  readonly attackIntervalMs: number;
  readonly durationMs: number;
  readonly now: number;
}

export function spawnTurret(state: TurretSimulationState, params: SpawnTurretParams): string {
  const id = `turret:${params.ownerSessionId}:${params.now}:${nextTurretSequence++}`;
  const turret = new TurretPresence();
  turret.id = id;
  turret.skillId = params.skillId;
  turret.ownerSessionId = params.ownerSessionId;
  turret.x = params.x;
  turret.y = params.y;
  turret.attackRange = params.attackRange;
  turret.attackDamage = params.attackDamage;
  turret.attackIntervalMs = params.attackIntervalMs;
  turret.nextAttackAtMs = params.now;
  turret.spawnedAtMs = params.now;
  turret.expiresAtMs = params.now + params.durationMs;
  state.turrets.set(id, turret);
  return id;
}

export interface TurretShot {
  readonly turret: TurretPresence;
  readonly enemy: EnemyPresence;
  readonly damageResult: ApplyEnemyDamageResult;
}

/**
 * Advances every active turret by one tick: expired turrets are removed,
 * and any turret whose attack cadence has come due fires at the nearest
 * non-defeated enemy within `attackRange` (a no-op tick if none are in
 * range). Turret damage bypasses the player's own targeting/range checks
 * entirely -- the turret is its own autonomous attacker once deployed.
 */
export function stepTurrets(
  state: TurretSimulationState,
  now: number,
  onShot: (shot: TurretShot) => void,
): void {
  const toRemove: string[] = [];

  state.turrets.forEach((turret) => {
    if (now >= turret.expiresAtMs) {
      toRemove.push(turret.id);
      return;
    }
    if (now < turret.nextAttackAtMs) {
      return;
    }

    let closestEnemy: EnemyPresence | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;
    state.enemies.forEach((enemy) => {
      if (enemy.defeated || enemy.hp <= 0) {
        return;
      }
      const distance = Math.hypot(enemy.x - turret.x, enemy.y - turret.y);
      if (distance <= turret.attackRange && distance < closestDistance) {
        closestDistance = distance;
        closestEnemy = enemy;
      }
    });

    turret.nextAttackAtMs = now + turret.attackIntervalMs;
    if (closestEnemy === undefined) {
      return;
    }

    const damageResult = applyEnemyDamage(closestEnemy, turret.attackDamage);
    onShot({ turret, enemy: closestEnemy, damageResult });
  });

  for (const id of toRemove) {
    state.turrets.delete(id);
  }
}
