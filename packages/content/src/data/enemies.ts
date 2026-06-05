import type { ContentLocalizationKey, EnemyContentDefinition } from "./types";

export const enemies = [
  {
    id: "trashboar_runt",
    nameKey: "enemy.trashboar_runt.name",
    descriptionKey: "enemy.trashboar_runt.description",
    level: 1,
    maxHp: 12,
    damage: 2,
    armor: 0,
    moveSpeed: 0.8,
    attackRange: 1.1,
    attackCooldownMs: 1300,
    aggroRange: 5,
    xp: 5,
    lootTableId: "sewer_starter_loot",
    spriteKey: "enemy_trashboar_runt_placeholder"
  },
  {
    id: "trashboar_brute",
    nameKey: "enemy.trashboar_brute.name" as ContentLocalizationKey,
    descriptionKey: "enemy.trashboar_brute.description" as ContentLocalizationKey,
    level: 2,
    maxHp: 30,
    damage: 2,
    armor: 0,
    moveSpeed: 0.8,
    attackRange: 1.1,
    attackCooldownMs: 1300,
    aggroRange: 5,
    xp: 15,
    lootTableId: "sewer_starter_loot",
    spriteKey: "enemy_trashboar_runt_placeholder"
  }
] as const satisfies readonly EnemyContentDefinition[];