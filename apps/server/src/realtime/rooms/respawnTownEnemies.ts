import type { EnemyPresence } from "@doomscrolls/shared";

import type { TownRoomState } from "./TownRoomState";

function resetEnemy(enemy: EnemyPresence): void {
  enemy.hp = enemy.maxHp;
  enemy.defeated = false;
  enemy.respawnAtMs = 0;
}

export function respawnTownEnemies(state: TownRoomState, now: number): void {
  state.enemies.forEach((enemy) => {
    if (!enemy.defeated) {
      if (!Number.isFinite(enemy.respawnAtMs) || enemy.respawnAtMs < 0) {
        enemy.respawnAtMs = 0;
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