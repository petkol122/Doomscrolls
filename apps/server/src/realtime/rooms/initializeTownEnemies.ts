import { contentRegistry } from "@doomscrolls/content";
import { EnemyPresence, type ZoneId } from "@doomscrolls/shared";

import type { TownRoomState } from "./TownRoomState";

const NIGHTMARKET_TRASHBOAR_PLACEHOLDER_ID = "nightmarket_trashboar_runt_01";

/**
 * Task 058 — Basic Enemy Placeholder Foundation Batch
 *
 * Adds a single static synced enemy placeholder to the room state.
 * This is intentionally data/display only:
 * no AI, aggro, movement, combat, damage, loot, XP, death, or persistence.
 */
export function initializeTownEnemies(
  state: TownRoomState,
  zoneId: ZoneId,
): void {
  if (zoneId !== "nightmarket") {
    return;
  }

  const trashboarRuntContent = contentRegistry.enemies.require("trashboar_runt");

  const enemy = new EnemyPresence();
  enemy.id = NIGHTMARKET_TRASHBOAR_PLACEHOLDER_ID;
  enemy.enemyId = trashboarRuntContent.id;
  enemy.label = trashboarRuntContent.nameKey;
  enemy.x = 240;
  enemy.y = 160;
  enemy.hp = trashboarRuntContent.maxHp;
  enemy.maxHp = trashboarRuntContent.maxHp;
  enemy.defeated = false;
  enemy.nextAttackAtMs = 0;
  enemy.respawnAtMs = 0;

  state.enemies.set(enemy.id, enemy);
}