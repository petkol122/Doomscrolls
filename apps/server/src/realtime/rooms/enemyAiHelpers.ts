import type { EnemyState } from "@doomscrolls/shared";

/**
 * Shared enemy AI helper functions.
 *
 * Extracted from `TownRoom.ts` (Task 268 — CombatRoom minimal real combat
 * wiring) so the same primitive operations are reusable by both rooms
 * without copying the full TownRoom implementation into a new file.
 *
 * Each function is a pure, side-effect-only-on-`enemy` operation that
 * does not know about Colyseus, PlayerPresence, TownRoom, CombatRoom or
 * the world. Rooms pass the relevant presence/enemy entries into them.
 *
 * Out of scope here:
 *  - enemy->player damage application
 *  - enemy telegraph/landing timing
 *  - loot, XP, objectives
 *  - pathfinding
 *  - collision
 *  - map awareness
 */

export const ENEMY_ATTACK_RANGE = 44;
export const ENEMY_RETURN_ARRIVAL_DISTANCE = 1;
export const ENEMY_RETURN_REACQUIRE_BUFFER = 8;

export interface EnemyAiTarget {
  readonly x: number;
  readonly y: number;
}

export interface EnemyAiMut {
  x: number;
  y: number;
  state: EnemyState;
  targetPlayerSessionId: string;
  nextAttackAtMs: number;
  attackLandingAtMs: number;
}

/**
 * Step an enemy toward a target point at the supplied world-units-per-second
 * speed, without entering the engagement radius (combat stops at
 * `ENEMY_ATTACK_RANGE` so the enemy does not overlap the target).
 */
export function moveEnemyTowardTarget(
  enemy: { x: number; y: number },
  target: EnemyAiTarget,
  moveSpeedUnitsPerSecond: number,
  deltaMs: number,
): void {
  if (
    !Number.isFinite(moveSpeedUnitsPerSecond) ||
    moveSpeedUnitsPerSecond <= 0 ||
    !Number.isFinite(deltaMs) ||
    deltaMs <= 0
  ) {
    return;
  }

  const deltaX = target.x - enemy.x;
  const deltaY = target.y - enemy.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance <= ENEMY_ATTACK_RANGE) {
    return;
  }

  const maxDistance = moveSpeedUnitsPerSecond * (deltaMs / 1000);
  const distanceToTravel = Math.min(maxDistance, distance - ENEMY_ATTACK_RANGE);
  if (distanceToTravel <= 0) {
    return;
  }

  const scale = distanceToTravel / distance;
  enemy.x += deltaX * scale;
  enemy.y += deltaY * scale;
}

/**
 * Step an enemy toward a target point at the supplied world-units-per-second
 * speed. Arrival is when the enemy is within `ENEMY_RETURN_ARRIVAL_DISTANCE`
 * of the target; the enemy snaps to the exact target coordinates on arrival.
 */
export function moveEnemyTowardPoint(
  enemy: { x: number; y: number },
  target: EnemyAiTarget,
  moveSpeedUnitsPerSecond: number,
  deltaMs: number,
): void {
  if (
    !Number.isFinite(moveSpeedUnitsPerSecond) ||
    moveSpeedUnitsPerSecond <= 0 ||
    !Number.isFinite(deltaMs) ||
    deltaMs <= 0
  ) {
    return;
  }

  const deltaX = target.x - enemy.x;
  const deltaY = target.y - enemy.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance <= ENEMY_RETURN_ARRIVAL_DISTANCE) {
    enemy.x = target.x;
    enemy.y = target.y;
    return;
  }

  const maxDistance = moveSpeedUnitsPerSecond * (deltaMs / 1000);
  const distanceToTravel = Math.min(maxDistance, distance);
  if (distanceToTravel <= 0) {
    return;
  }

  const scale = distanceToTravel / distance;
  enemy.x += deltaX * scale;
  enemy.y += deltaY * scale;
}

/**
 * Clear the enemy's current target player and switch the enemy into the
 * "returning" state. Used when the target goes out of aggro range, out of
 * leash range, dies or disconnects.
 */
export function clearEnemyTargetAndReturn(enemy: EnemyAiMut): void {
  enemy.targetPlayerSessionId = "";
  enemy.state = "returning";
  enemy.nextAttackAtMs = 0;
  enemy.attackLandingAtMs = 0;
}

/**
 * Reset the enemy's combat-targeting state back to "idle". Used when the
 * enemy has fully returned to its spawn point and is ready to wander or
 * re-acquire a target.
 */
export function resetEnemyCombatState(enemy: EnemyAiMut): void {
  enemy.targetPlayerSessionId = "";
  enemy.state = "idle";
  enemy.nextAttackAtMs = 0;
  enemy.attackLandingAtMs = 0;
}
