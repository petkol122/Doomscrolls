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
    moveSpeed: 0.84,
    attackRange: 1.1,
    attackCooldownMs: 1325,
    aggroRange: 5.1,
    leashRange: 7,
    xp: 5,
    lootTableId: "sewer_starter_loot",
    currencyDrop: { min: 2, max: 7 },
    spriteKey: "enemy_trashboar_runt_placeholder"
  },
  {
    id: "trashboar_brute",
    nameKey: "enemy.trashboar_brute.name" as ContentLocalizationKey,
    descriptionKey: "enemy.trashboar_brute.description" as ContentLocalizationKey,
    level: 2,
    maxHp: 30,
    damage: 3,
    armor: 0,
    moveSpeed: 0.9,
    attackRange: 1.1,
    attackCooldownMs: 1100,
    aggroRange: 5.6,
    leashRange: 8,
    xp: 15,
    lootTableId: "sewer_starter_loot",
    spriteKey: "enemy_trashboar_runt_placeholder"
  }
] as const satisfies readonly EnemyContentDefinition[];
