import { contentRegistry } from "@doomscrolls/content";
import type { SpawnZoneDefinition } from "@doomscrolls/content";
import { EnemyPresence, type EnemyRarity } from "@doomscrolls/shared";

import { getEnemyRarityMultiplier, rollEnemyRarity } from "./enemyRarity";
import type { Rng } from "./serverRng";

/**
 * Core 0.1 Foundation -- Multi-Type Enemy Pack Spawning.
 *
 * Builds every `EnemyPresence` instance for one spawn-zone pocket: the
 * primary `enemyId`/`count` group (its first instance is the "pack
 * leader" and is the only one eligible for a rarity roll), plus any
 * additional `pack` member groups (always Normal rarity -- supporting
 * enemies, not leaders). Shared by `initializeTownEnemies` and
 * `initializeCombatEnemies`, which previously duplicated this exact
 * single-type spawn loop.
 */
export function buildPocketEnemies(zone: SpawnZoneDefinition, rng: Rng): EnemyPresence[] {
  const enemies: EnemyPresence[] = [];

  const groups: ReadonlyArray<{ readonly enemyId: string; readonly count: number; readonly isLeaderGroup: boolean }> = [
    { enemyId: zone.enemyId, count: zone.count, isLeaderGroup: true },
    ...(zone.pack ?? []).map((member) => ({ enemyId: member.enemyId, count: member.count, isLeaderGroup: false })),
  ];

  let instanceIndex = 0;
  for (const group of groups) {
    const enemyContent = contentRegistry.enemies.require(group.enemyId as never);

    for (let i = 0; i < group.count; i++) {
      const isLeader = group.isLeaderGroup && i === 0;
      const rarity: EnemyRarity = isLeader
        ? rollEnemyRarity(rng, zone.leaderEliteChance, zone.leaderChampionChance)
        : "normal";
      const multiplier = getEnemyRarityMultiplier(rarity);

      const x = rng.nextInt(zone.minX, zone.maxX + 1);
      const y = rng.nextInt(zone.minY, zone.maxY + 1);
      const id = `${zone.id}_${instanceIndex}`;
      instanceIndex += 1;

      const enemy = new EnemyPresence();
      enemy.id = id;
      enemy.enemyId = enemyContent.id;
      enemy.label = enemyContent.nameKey;
      enemy.rarity = rarity;
      enemy.spawnX = x;
      enemy.spawnY = y;
      enemy.x = x;
      enemy.y = y;
      enemy.state = "idle";
      enemy.targetPlayerSessionId = "";
      enemy.maxHp = Math.round(enemyContent.maxHp * multiplier.hp);
      enemy.hp = enemy.maxHp;
      enemy.defeated = false;
      enemy.nextAttackAtMs = 0;
      enemy.respawnAtMs = 0;
      enemy.attackLandingAtMs = 0;
      enemy.attackKind = "normal";
      enemy.nextHeavyAttackAtMs = 0;
      enemy.pathWaypoints = "";
      enemy.statusEffects = "";

      enemies.push(enemy);
    }
  }

  return enemies;
}
