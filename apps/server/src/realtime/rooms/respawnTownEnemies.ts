import type { EnemyPresence } from "@doomscrolls/shared";

import type { TownRoomState } from "./TownRoomState";
import { clearWanderState } from "./wanderEnemies";

function resetEnemy(enemy: EnemyPresence): void {
  enemy.state = "idle";
  enemy.targetPlayerSessionId = "";
  enemy.x = enemy.spawnX;
  enemy.y = enemy.spawnY;
  enemy.hp = enemy.maxHp;
  enemy.defeated = false;
  enemy.nextAttackAtMs = 0;
  enemy.respawnAtMs = 0;
  enemy.attackLandingAtMs = 0;
  clearWanderState(enemy.id);
}

export function respawnTownEnemies(state: TownRoomState, now: number): void {
  state.enemies.forEach((enemy) => {
    if (!enemy.defeated) {
      if (!Number.isFinite(enemy.respawnAtMs) || enemy.respawnAtMs < 0) {
        enemy.respawnAtMs = 0;
      }
      // Guard against a stale telegraph from before the enemy was
      // marked defeated; clients should not see a warning marker on
      // a freshly respawned enemy.
      if (enemy.attackLandingAtMs > 0 && enemy.attackLandingAtMs < now) {
        enemy.attackLandingAtMs = 0;
      }
      return;
    }

    if (!Number.isFinite(enemy.respawnAtMs) || enemy.respawnAtMs <= 0) {
      return;
    }

    if (now >= enemy.respawnAtMs) {
      resetEnemy(enemy);
    }
  });
}
