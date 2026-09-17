import type { MapSchema } from "@colyseus/schema";
import { ProjectilePresence, type EnemyPresence } from "@doomscrolls/shared";

/**
 * Milestone 0.2 -- Server-Authoritative Projectiles & Ground-Targeted AoE
 * Skills. Structural state shape shared by `TownRoomState` and
 * `CombatRoomState`, matching this codebase's existing convention of
 * typing simulation helpers against the fields they actually need (see
 * `stepTownRoomMovement`'s own parameter shape) instead of importing a
 * concrete room state class into both rooms.
 */
export interface ProjectileSimulationState {
  readonly enemies: MapSchema<EnemyPresence>;
  readonly projectiles: MapSchema<ProjectilePresence>;
}

const ARRIVAL_EPSILON = 10;
let nextProjectileSequence = 0;

export interface SpawnProjectileParams {
  readonly skillId: string;
  readonly ownerSessionId: string;
  readonly originX: number;
  readonly originY: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly targetEnemyId: string;
  readonly speed: number;
  readonly damage: number;
  readonly appliesEffect?: "bleed" | "slow" | "stun" | "burn" | "emp_dot" | "haste" | undefined;
  readonly effectDurationMs?: number | undefined;
  readonly effectMagnitude?: number | undefined;
  readonly now: number;
}

export function spawnProjectile(
  state: ProjectileSimulationState,
  params: SpawnProjectileParams,
): string {
  const id = `projectile:${params.ownerSessionId}:${params.now}:${nextProjectileSequence++}`;
  const projectile = new ProjectilePresence();
  projectile.id = id;
  projectile.skillId = params.skillId;
  projectile.ownerSessionId = params.ownerSessionId;
  projectile.originX = params.originX;
  projectile.originY = params.originY;
  projectile.x = params.originX;
  projectile.y = params.originY;
  projectile.targetX = params.targetX;
  projectile.targetY = params.targetY;
  projectile.targetEnemyId = params.targetEnemyId;
  projectile.speed = params.speed;
  projectile.damage = params.damage;
  projectile.appliesEffect = params.appliesEffect ?? "";
  projectile.effectDurationMs = params.effectDurationMs ?? 0;
  projectile.effectMagnitude = params.effectMagnitude ?? 0;
  projectile.spawnedAtMs = params.now;
  state.projectiles.set(id, projectile);
  return id;
}

/**
 * Advances every in-flight projectile by `deltaMs` and resolves impacts.
 * A homed projectile (`targetEnemyId` set) chases the live enemy position
 * while that enemy still exists and isn't defeated; otherwise it keeps
 * flying toward the last known point so it never jitters or teleports.
 * `onImpact` receives the enemy it hit (`undefined` = a miss, the homed
 * target died or left mid-flight) and must apply damage/effects itself.
 */
export function stepProjectiles(
  state: ProjectileSimulationState,
  deltaMs: number,
  now: number,
  onImpact: (projectile: ProjectilePresence, enemy: EnemyPresence | undefined) => void,
): void {
  const toRemove: string[] = [];

  state.projectiles.forEach((projectile) => {
    const homedEnemy = projectile.targetEnemyId.length > 0
      ? state.enemies.get(projectile.targetEnemyId)
      : undefined;
    const isHomedTargetLive = homedEnemy !== undefined && !homedEnemy.defeated && homedEnemy.hp > 0;
    const targetX = isHomedTargetLive ? homedEnemy.x : projectile.targetX;
    const targetY = isHomedTargetLive ? homedEnemy.y : projectile.targetY;
    if (isHomedTargetLive) {
      projectile.targetX = targetX;
      projectile.targetY = targetY;
    }

    const dx = targetX - projectile.x;
    const dy = targetY - projectile.y;
    const distance = Math.hypot(dx, dy);
    const stepDistance = (projectile.speed * deltaMs) / 1000;

    if (distance <= ARRIVAL_EPSILON || stepDistance >= distance) {
      onImpact(projectile, isHomedTargetLive ? homedEnemy : undefined);
      toRemove.push(projectile.id);
      return;
    }

    projectile.x += (dx / distance) * stepDistance;
    projectile.y += (dy / distance) * stepDistance;
  });

  for (const id of toRemove) {
    state.projectiles.delete(id);
  }
}
