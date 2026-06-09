import { EnemyPresence, type ZoneId } from "@doomscrolls/shared";
import { contentRegistry } from "@doomscrolls/content";
import type { CombatRoomState } from "./CombatRoomState";

/**
 * CombatRoom enemy set initialiser.
 *
 * Task 268 — CombatRoom minimal real combat wiring.
 *
 * Core 0.1 ships a small fixed combat enemy set (3 × Trashboar Runt)
 * on a single hard-coded combat spawn box. The Blackwire Sewers
 * zone has no `spawnZones` content yet, so this helper uses an
 * in-file box instead of looping over `contentRegistry.spawnZones`.
 *
 * Enemy ids are deterministic so reconnecting clients see the same
 * instance ids across joins. The exact box is intentionally
 * conservative and well within the Blackwire Sewers content bounds
 * (no out-of-bounds spawn), but the box itself is **not** a map
 * definition and is explicitly documented as temporary.
 *
 * This helper mirrors the *shape* of `initializeTownEnemies`
 * (returns nothing, mutates `state.enemies` in place) so the rest
 * of the room can treat CombatRoom enemies exactly like TownRoom
 * enemies and reuse the shared `validateAttackIntent` /
 * `applyEnemyDamage` / `enemyAiHelpers` modules.
 */
export const COMBAT_ENEMY_CONTENT_ID = "trashboar_runt";
export const COMBAT_SPAWN_BOX = {
  minX: 900,
  maxX: 1200,
  minY: 900,
  maxY: 1200,
} as const;
export const COMBAT_ENEMY_COUNT = 3;

export function initializeCombatEnemies(
  state: CombatRoomState,
  _zoneId: ZoneId,
): void {
  const enemyContent = contentRegistry.enemies.require(COMBAT_ENEMY_CONTENT_ID as never);
  const { minX, maxX, minY, maxY } = COMBAT_SPAWN_BOX;

  for (let i = 0; i < COMBAT_ENEMY_COUNT; i++) {
    // Even spread along the X axis inside the box; the Y axis stays
    // at the midpoint. Deterministic, so the layout is identical
    // every time the room is created.
    const x = Math.round(minX + ((maxX - minX) * i) / Math.max(1, COMBAT_ENEMY_COUNT - 1));
    const y = Math.round((minY + maxY) / 2);
    const id = `combat_${COMBAT_ENEMY_CONTENT_ID}_${i}`;

    const enemy = new EnemyPresence();
    enemy.id = id;
    enemy.enemyId = enemyContent.id;
    enemy.label = enemyContent.nameKey;
    enemy.spawnX = x;
    enemy.spawnY = y;
    enemy.x = x;
    enemy.y = y;
    enemy.state = "idle";
    enemy.targetPlayerSessionId = "";
    enemy.hp = enemyContent.maxHp;
    enemy.maxHp = enemyContent.maxHp;
    enemy.defeated = false;
    enemy.nextAttackAtMs = 0;
    enemy.respawnAtMs = 0;
    enemy.attackLandingAtMs = 0;
    enemy.attackKind = "normal";
    enemy.nextHeavyAttackAtMs = 0;

    state.enemies.set(enemy.id, enemy);
  }
}
