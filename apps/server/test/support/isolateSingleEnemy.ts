import type { EnemyPresence } from "@doomscrolls/shared";

/**
 * Core 0.24 -- real multi-enemy aggro (each enemy independently
 * targets the nearest alive player) is in scope and works, which
 * means a test that co-locates a player with one specific enemy's
 * spawn point can unintentionally also pull a second enemy from the
 * same spawn pocket, if that enemy's own spawn point happens to fall
 * within its own aggro range of the chosen position (pockets are
 * deliberately tight -- see `docs/CORE_BUILD_0_24_PLAN.md`, Question
 * 2). That is correct, intended behavior, not a bug -- but it breaks
 * a test that wants to isolate exactly one enemy's behavior.
 *
 * Moves every enemy except `keepEnemyId` far away from the action and
 * clears its targeting state, so it can never interfere with a
 * single-enemy test scenario.
 */
export function isolateSingleEnemy(
  enemies: Map<string, EnemyPresence> | { forEach: (cb: (enemy: EnemyPresence, id: string) => void) => void },
  keepEnemyId: string,
): void {
  const FAR_AWAY_OFFSET = 1_000_000;
  enemies.forEach((enemy, id) => {
    if (id === keepEnemyId) {
      return;
    }
    enemy.x = FAR_AWAY_OFFSET;
    enemy.y = FAR_AWAY_OFFSET;
    enemy.spawnX = FAR_AWAY_OFFSET;
    enemy.spawnY = FAR_AWAY_OFFSET;
    enemy.targetPlayerSessionId = "";
    enemy.state = "idle";
    enemy.nextAttackAtMs = 0;
    enemy.attackLandingAtMs = 0;
  });
}
