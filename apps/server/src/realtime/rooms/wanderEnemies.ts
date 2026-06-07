const WANDER_SPEED_MULTIPLIER = 0.4;
const WANDER_RADIUS = 60;
const WANDER_COOLDOWN_MS = 2000;

interface EnemyWanderState {
  targetX: number;
  targetY: number;
  nextPickAtMs: number;
}

const wanderState = new Map<string, EnemyWanderState>();

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickWanderTarget(spawnX: number, spawnY: number, now: number): EnemyWanderState {
  return {
    targetX: spawnX + randomInRange(-WANDER_RADIUS, WANDER_RADIUS),
    targetY: spawnY + randomInRange(-WANDER_RADIUS, WANDER_RADIUS),
    nextPickAtMs: now + WANDER_COOLDOWN_MS,
  };
}

export function applyWanderMovement(
  enemy: { readonly id: string; readonly spawnX: number; readonly spawnY: number; x: number; y: number; readonly state: string; readonly defeated: boolean },
  moveSpeedUnitsPerSecond: number,
  deltaMs: number,
  now: number,
): void {
  if (enemy.defeated || enemy.state !== "idle") {
    return;
  }

  if (!Number.isFinite(moveSpeedUnitsPerSecond) || moveSpeedUnitsPerSecond <= 0) {
    return;
  }

  let state = wanderState.get(enemy.id);

  if (state === undefined || now >= state.nextPickAtMs) {
    state = pickWanderTarget(enemy.spawnX, enemy.spawnY, now);
    wanderState.set(enemy.id, state);
  }

  const deltaX = state.targetX - enemy.x;
  const deltaY = state.targetY - enemy.y;
  const distance = Math.hypot(deltaX, deltaY);
  const arrivalDistance = 8;

  if (distance <= arrivalDistance) {
    enemy.x = state.targetX;
    enemy.y = state.targetY;
    state.nextPickAtMs = now + WANDER_COOLDOWN_MS;
    return;
  }

  const wanderSpeed = moveSpeedUnitsPerSecond * WANDER_SPEED_MULTIPLIER;
  const maxDistance = wanderSpeed * (deltaMs / 1000);
  const distanceToTravel = Math.min(maxDistance, distance);

  if (distanceToTravel <= 0) {
    return;
  }

  const scale = distanceToTravel / distance;
  enemy.x += deltaX * scale;
  enemy.y += deltaY * scale;
}

/**
 * Clear wander state for enemies from a specific zone when the room resets
 * or for a specific enemy when it respawns.
 */
export function clearWanderState(enemyId: string): void {
  wanderState.delete(enemyId);
}

export function clearAllWanderState(): void {
  wanderState.clear();
}