import { EnemyPresence, type ZoneId } from "@doomscrolls/shared";
import { contentRegistry } from "@doomscrolls/content";
import type { CombatRoomState } from "./CombatRoomState";
import { createRng } from "./serverRng";

function hashSeed(str: string): number {
  let seed = 0;
  for (let i = 0; i < str.length; i++) {
    seed = (seed * 31 + str.charCodeAt(i)) | 0;
  }
  return seed >>> 0;
}

/**
 * CombatRoom enemy set initialiser.
 *
 * Task 268 — CombatRoom minimal real combat wiring.
 *
 * Core 0.4 Task 353 switches Blackwire Sewers onto the same content-driven
 * spawn-zone pipeline shape used by TownRoom. CombatRoom still stays thin;
 * it simply populates EnemyPresence from combat-zone spawn content.
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
export const COMBAT_SPAWN_BOX = {
  minX: 96,
  maxX: 180,
  minY: 420,
  maxY: 520,
} as const;

export function initializeCombatEnemies(
  state: CombatRoomState,
  zoneId: ZoneId,
): void {
  const rng = createRng(hashSeed(zoneId));

  for (const zone of contentRegistry.spawnZones) {
    if (zone.zoneId !== zoneId) {
      continue;
    }

    const enemyContent = contentRegistry.enemies.require(zone.enemyId);

    for (let i = 0; i < zone.count; i++) {
      const x = rng.nextInt(zone.minX, zone.maxX + 1);
      const y = rng.nextInt(zone.minY, zone.maxY + 1);
      const id = `${zone.id}_${i}`;

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
}
