import type { WorldPropPoint } from "@doomscrolls/content";
import { computeBuildingAvoidancePath } from "./buildingAvoidancePathfinding";
import { isSegmentBlockedByAnyPolygon } from "./pointInPolygon";
import {
  ENEMY_ATTACK_RANGE,
  ENEMY_RETURN_ARRIVAL_DISTANCE,
  moveEnemyTowardPoint,
  moveEnemyTowardTarget,
  type EnemyAiTarget,
} from "./enemyAiHelpers";

/**
 * Obstacle-avoidance wrapper around `moveEnemyTowardTarget` /
 * `moveEnemyTowardPoint` (enemyAiHelpers.ts, unchanged), reusing the same
 * building-footprint visibility-graph pathfinder player click-to-move
 * already uses (`computeBuildingAvoidancePath`) so a chasing or
 * returning enemy routes around obstacles instead of trying to walk
 * straight through them.
 *
 * Zero cost for zones with no obstacle geometry (all four combat
 * zones today): `buildingFootprints.length === 0` short-circuits
 * straight to the existing straight-line helper, so this file changes
 * nothing about current CombatRoom behavior until a zone actually
 * carries `building_footprint` props.
 *
 * Path recomputation only happens once the enemy's queued waypoints
 * run out *and* the direct line to its real target is still blocked
 * (`computeBuildingAvoidancePath` itself early-returns cheaply, without
 * building a visibility graph, whenever the direct line is clear) --
 * this keeps the per-tick cost bounded to a single segment/polygon
 * check in the common unobstructed case, with the Dijkstra solve only
 * running when a route is actually being (re)established.
 */

interface PathingEnemy {
  x: number;
  y: number;
  pathWaypoints: string;
}

function popNextWaypoint(enemy: PathingEnemy): WorldPropPoint | null {
  if (enemy.pathWaypoints.length === 0) {
    return null;
  }

  const parts = enemy.pathWaypoints.split(",");
  const x = Number(parts[0]);
  const y = Number(parts[1]);

  if (parts.length < 2 || !Number.isFinite(x) || !Number.isFinite(y)) {
    enemy.pathWaypoints = "";
    return null;
  }

  enemy.pathWaypoints = parts.slice(2).join(",");
  return { x, y };
}

function storeWaypoints(enemy: PathingEnemy, waypoints: readonly WorldPropPoint[]): void {
  enemy.pathWaypoints = waypoints.flatMap((point) => [point.x, point.y]).join(",");
}

/**
 * Advance one waypoint queued for `enemy` toward `finalTarget`, or -- if
 * the queue is empty -- resolve a fresh one via `computeBuildingAvoidancePath`
 * when the direct line is blocked. Shared by both the chase and
 * return-to-spawn variants below; `arrive` performs the actual per-step
 * movement (their arrival semantics differ: chase stops short at
 * `ENEMY_ATTACK_RANGE`, return snaps exactly onto the spawn point).
 */
function stepAlongAvoidancePath(
  enemy: PathingEnemy,
  finalTarget: EnemyAiTarget,
  moveSpeedUnitsPerSecond: number,
  deltaMs: number,
  buildingFootprints: readonly (readonly WorldPropPoint[])[],
  arrive: (currentLegTarget: EnemyAiTarget, isFinalLeg: boolean) => void,
): void {
  if (buildingFootprints.length === 0) {
    arrive(finalTarget, true);
    return;
  }

  if (enemy.pathWaypoints.length === 0) {
    const path = computeBuildingAvoidancePath(
      enemy.x,
      enemy.y,
      finalTarget.x,
      finalTarget.y,
      buildingFootprints,
    );
    // The path's last entry is just the target position at the moment
    // the route was computed -- drop it and let the final leg track
    // the caller's live `finalTarget` instead (the enemy's real chase
    // target keeps moving every tick). Only the intermediate corner
    // waypoints, if any, get queued.
    const intermediateWaypoints = path.slice(0, -1);
    if (intermediateWaypoints.length > 0) {
      storeWaypoints(enemy, intermediateWaypoints);
    }
  }

  if (enemy.pathWaypoints.length === 0) {
    arrive(finalTarget, true);
    return;
  }

  const [nextX, nextY] = enemy.pathWaypoints.split(",").map(Number);
  const legTarget: EnemyAiTarget = { x: nextX!, y: nextY! };

  if (isSegmentBlockedByAnyPolygon(enemy.x, enemy.y, legTarget.x, legTarget.y, buildingFootprints)) {
    // Stale route (target moved since the leg was computed): drop it
    // and recompute from the enemy's current position next tick rather
    // than walk into an obstacle.
    enemy.pathWaypoints = "";
    return;
  }

  arrive(legTarget, false);
  const distanceAfter = Math.hypot(enemy.x - legTarget.x, enemy.y - legTarget.y);

  // `moveEnemyTowardPoint` snaps exactly onto `legTarget` once within
  // `ENEMY_RETURN_ARRIVAL_DISTANCE`, so this reliably detects arrival
  // regardless of step size.
  if (distanceAfter <= ENEMY_RETURN_ARRIVAL_DISTANCE) {
    popNextWaypoint(enemy);
  }
}

/** Obstacle-avoidance chase step -- routes around `buildingFootprints` instead of walking through them. */
export function stepEnemyTowardTargetWithAvoidance(
  enemy: PathingEnemy,
  target: EnemyAiTarget,
  moveSpeedUnitsPerSecond: number,
  deltaMs: number,
  buildingFootprints: readonly (readonly WorldPropPoint[])[],
): void {
  stepAlongAvoidancePath(enemy, target, moveSpeedUnitsPerSecond, deltaMs, buildingFootprints, (legTarget, isFinalLeg) => {
    if (isFinalLeg) {
      moveEnemyTowardTarget(enemy, legTarget, moveSpeedUnitsPerSecond, deltaMs);
    } else {
      // Intermediate waypoints must be walked all the way onto (no
      // `ENEMY_ATTACK_RANGE` stand-off) so the enemy actually rounds
      // the obstacle corner before resuming the direct chase.
      moveEnemyTowardPoint(enemy, legTarget, moveSpeedUnitsPerSecond, deltaMs);
    }
  });
}

/** Obstacle-avoidance return-to-spawn step -- routes around `buildingFootprints` instead of walking through them. */
export function stepEnemyTowardPointWithAvoidance(
  enemy: PathingEnemy,
  target: EnemyAiTarget,
  moveSpeedUnitsPerSecond: number,
  deltaMs: number,
  buildingFootprints: readonly (readonly WorldPropPoint[])[],
): void {
  stepAlongAvoidancePath(enemy, target, moveSpeedUnitsPerSecond, deltaMs, buildingFootprints, (legTarget) => {
    moveEnemyTowardPoint(enemy, legTarget, moveSpeedUnitsPerSecond, deltaMs);
  });
}

export { ENEMY_ATTACK_RANGE };
