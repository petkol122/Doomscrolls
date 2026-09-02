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
  },
  {
    // Core 0.16 — Slag Hound, Cinderworks' fast skirmisher. Same role
    // Skitter/Wretch play in their own zones: low HP, high move speed,
    // long aggro range, low individual threat but relentless.
    id: "slag_hound",
    nameKey: "enemy.slag_hound.name" as ContentLocalizationKey,
    descriptionKey: "enemy.slag_hound.description" as ContentLocalizationKey,
    level: 1,
    maxHp: 9,
    damage: 2,
    armor: 0,
    moveSpeed: 1.3,
    attackRange: 1.1,
    attackCooldownMs: 900,
    aggroRange: 8.5,
    leashRange: 11,
    xp: 6,
    lootTableId: "cinderworks_loot",
    currencyDrop: { min: 2, max: 8 },
    spriteKey: "enemy_slag_hound_placeholder"
  },
  {
    // Core 0.16 — Foundry Warden, Cinderworks' own heavy anchor (a new
    // enemy, not a reused Trashboar Brute, so the zone has two real
    // enemy types instead of one new + one reskin). Same heavy-attack
    // telegraph shape Trashboar Brute already uses.
    id: "foundry_warden",
    nameKey: "enemy.foundry_warden.name" as ContentLocalizationKey,
    descriptionKey: "enemy.foundry_warden.description" as ContentLocalizationKey,
    level: 2,
    maxHp: 34,
    damage: 4,
    heavyAttackDamage: 7,
    armor: 1,
    moveSpeed: 0.85,
    attackRange: 1.1,
    attackCooldownMs: 900,
    heavyAttackWindupMs: 1600,
    heavyAttackCooldownMs: 2500,
    heavyAttackChance: 0.35,
    aggroRange: 7.5,
    leashRange: 11,
    xp: 18,
    lootTableId: "cinderworks_loot",
    currencyDrop: { min: 4, max: 13 },
    spriteKey: "enemy_foundry_warden_placeholder"
  },
  {
    // Core 0.17 — Yard Drudge, Static Yard's own common/starter-tier
    // enemy. Static Yard previously had only static_wretch (skirmisher)
    // and a reused trashboar_brute (heavy) -- no tier of its own to
    // match Blackwire's common/skirmisher/heavy 3-role structure. Stats
    // mirror trashboar_runt's own common-tier shape.
    id: "yard_drudge",
    nameKey: "enemy.yard_drudge.name" as ContentLocalizationKey,
    descriptionKey: "enemy.yard_drudge.description" as ContentLocalizationKey,
    level: 1,
    maxHp: 11,
    damage: 2,
    armor: 0,
    moveSpeed: 0.85,
    attackRange: 1.1,
    attackCooldownMs: 1000,
    aggroRange: 6.5,
    leashRange: 9,
    xp: 5,
    lootTableId: "static_yard_loot",
    currencyDrop: { min: 2, max: 7 },
    spriteKey: "enemy_yard_drudge_placeholder"
  },
  {
    // Core 0.17 — Ash Rat, Cinderworks' own common/starter-tier enemy.
    // Same gap-fill as Yard Drudge above: Cinderworks previously had
    // only slag_hound (skirmisher) and foundry_warden (heavy).
    id: "ash_rat",
    nameKey: "enemy.ash_rat.name" as ContentLocalizationKey,
    descriptionKey: "enemy.ash_rat.description" as ContentLocalizationKey,
    level: 1,
    maxHp: 8,
    damage: 1,
    armor: 0,
    moveSpeed: 0.9,
    attackRange: 1.1,
    attackCooldownMs: 950,
    aggroRange: 6.0,
    leashRange: 8.5,
    xp: 4,
    lootTableId: "cinderworks_loot",
    currencyDrop: { min: 1, max: 5 },
    spriteKey: "enemy_ash_rat_placeholder"
  },
  {
    // Core 0.18 — Brine Crawler, Saltmere Docks' common/starter-tier
    // enemy. Unlike Static Yard/Cinderworks, this zone launches with
    // its full common/skirmisher/heavy role set from day one.
    id: "brine_crawler",
    nameKey: "enemy.brine_crawler.name" as ContentLocalizationKey,
    descriptionKey: "enemy.brine_crawler.description" as ContentLocalizationKey,
    level: 1,
    maxHp: 11,
    damage: 2,
    armor: 0,
    moveSpeed: 0.9,
    attackRange: 1.1,
    attackCooldownMs: 1000,
    aggroRange: 6.5,
    leashRange: 9,
    xp: 5,
    lootTableId: "saltmere_docks_loot",
    currencyDrop: { min: 2, max: 7 },
    spriteKey: "enemy_brine_crawler_placeholder"
  },
  {
    // Core 0.18 — Tide Stalker, Saltmere Docks' fast skirmisher.
    id: "tide_stalker",
    nameKey: "enemy.tide_stalker.name" as ContentLocalizationKey,
    descriptionKey: "enemy.tide_stalker.description" as ContentLocalizationKey,
    level: 1,
    maxHp: 9,
    damage: 2,
    armor: 0,
    moveSpeed: 1.3,
    attackRange: 1.1,
    attackCooldownMs: 900,
    aggroRange: 8.5,
    leashRange: 11,
    xp: 6,
    lootTableId: "saltmere_docks_loot",
    currencyDrop: { min: 2, max: 8 },
    spriteKey: "enemy_tide_stalker_placeholder"
  },
  {
    // Core 0.18 — Drowned Hauler, Saltmere Docks' heavy anchor. Same
    // heavy-attack telegraph shape every other zone's anchor already
    // uses (Trashboar Brute / Foundry Warden).
    id: "drowned_hauler",
    nameKey: "enemy.drowned_hauler.name" as ContentLocalizationKey,
    descriptionKey: "enemy.drowned_hauler.description" as ContentLocalizationKey,
    level: 2,
    maxHp: 34,
    damage: 4,
    heavyAttackDamage: 7,
    armor: 1,
    moveSpeed: 0.85,
    attackRange: 1.1,
    attackCooldownMs: 900,
    heavyAttackWindupMs: 1600,
    heavyAttackCooldownMs: 2500,
    heavyAttackChance: 0.35,
    aggroRange: 7.5,
    leashRange: 11,
    xp: 18,
    lootTableId: "saltmere_docks_loot",
    currencyDrop: { min: 4, max: 13 },
    spriteKey: "enemy_drowned_hauler_placeholder"
  }
] as const satisfies readonly EnemyContentDefinition[];
