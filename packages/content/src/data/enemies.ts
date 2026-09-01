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
    // Task 306: reduced from 1180 ms to 1050 ms for snappier pressure
    attackCooldownMs: 1050,
    aggroRange: 6.5,
    leashRange: 9,
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
    heavyAttackDamage: 6,
    armor: 0,
    moveSpeed: 0.9,
    attackRange: 1.1,
    // Task 306: reduced from 980 ms to 850 ms — Brute already hits
    // harder so a faster cadence makes it feel more threatening
    attackCooldownMs: 850,
    heavyAttackWindupMs: 1500,
    heavyAttackCooldownMs: 2400,
    heavyAttackChance: 0.34,
    aggroRange: 7.5,
    leashRange: 11,
    xp: 15,
    lootTableId: "sewer_brute_loot",
    currencyDrop: { min: 4, max: 12 },
    spriteKey: "enemy_trashboar_runt_placeholder"
  },
  {
    // Trashboar Skitter — a smaller, faster runt cousin.
    // Lower HP / damage / XP, but faster move speed and longer aggro range.
    // Spawns 1–2 near the first sewer edge pocket to add minor variety.
    // Uses existing AI, telegraph, loot, XP and render systems; no new states.
    id: "trashboar_skitter",
    nameKey: "enemy.trashboar_skitter.name" as ContentLocalizationKey,
    descriptionKey: "enemy.trashboar_skitter.description" as ContentLocalizationKey,
    level: 1,
    maxHp: 8,
    damage: 1,
    armor: 0,
    moveSpeed: 1.25,
    attackRange: 1.1,
    // Task 306: reduced from 1100 ms to 980 ms for a faster-on-its-feet
    // runt variant — reinforces the Skitter's "faster cousin" identity
    attackCooldownMs: 980,
    aggroRange: 7.0,
    leashRange: 9.5,
    xp: 3,
    // Task 357 (Core 0.5): Skitter now uses its own loot table instead of
    // sharing Runt's, so the three enemy archetypes each feel distinct.
    lootTableId: "sewer_skitter_loot",
    currencyDrop: { min: 1, max: 4 },
    spriteKey: "enemy_trashboar_runt_placeholder"
  },
  {
    // Core 0.6 — Static Wretch, Static Yard's own enemy. A scavenger left
    // twitchy and hyper-alert by constant exposure to live cabling.
    // Reuses the exact existing AI-state shape (idle/aggro/chase/attack/
    // leash/defeat/respawn) and content schema; only stats/behavior
    // numbers are new, distinguishing it from every Trashboar variant.
    id: "static_wretch",
    nameKey: "enemy.static_wretch.name" as ContentLocalizationKey,
    descriptionKey: "enemy.static_wretch.description" as ContentLocalizationKey,
    level: 1,
    maxHp: 10,
    damage: 2,
    armor: 0,
    moveSpeed: 1.0,
    attackRange: 1.1,
    attackCooldownMs: 900,
    aggroRange: 8.0,
    leashRange: 10.5,
    xp: 6,
    lootTableId: "static_yard_loot",
    currencyDrop: { min: 2, max: 8 },
    spriteKey: "enemy_static_wretch_placeholder"
  }
] as const satisfies readonly EnemyContentDefinition[];
