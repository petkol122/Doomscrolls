# Content Developer Guide

This guide explains how to add new content to Doomscrolls — enemies, items, spawn zones, and loot tables — using the existing data-driven pipeline.

All content definitions live in `packages/content/src/data/`. Each category has its own file (e.g. `enemies.ts`, `items.ts`). Localization keys live in `packages/localization/src/locales/en.ts`.

## Adding an Enemy

1. **Add localization keys** in `packages/localization/src/locales/en.ts`:

   ```ts
   "enemy.my_new_enemy.name": "My New Enemy",
   "enemy.my_new_enemy.description": "A fearsome new creature that haunts the sewers.",
   ```

2. **Register the enemy type** in `packages/content/src/data/types.ts`:

   Add the new id to the `EnemyId` union type:

   ```ts
   export type EnemyId = "trashboar_runt" | "trashboar_brute" | "trashboar_skitter" | "my_new_enemy";
   ```

3. **Add the enemy definition** in `packages/content/src/data/enemies.ts`:

   ```ts
   {
     id: "my_new_enemy",
     nameKey: "enemy.my_new_enemy.name" as ContentLocalizationKey,
     descriptionKey: "enemy.my_new_enemy.description" as ContentLocalizationKey,
     level: 1,
     maxHp: 15,
     damage: 3,
     armor: 1,
     moveSpeed: 1.0,
     attackRange: 1.1,
     attackCooldownMs: 1000,
     aggroRange: 6.0,
     leashRange: 9,
     xp: 8,
     lootTableId: "sewer_starter_loot",
     currencyDrop: { min: 2, max: 6 },
     spriteKey: "enemy_placeholder"
   },
   ```

4. **Add to a zone's `enemyIds`** in `packages/content/src/data/zones.ts` so the enemy can spawn there.

5. **(Optional) Create a spawn zone** — see "Adding a Spawn Zone" below.

6. **(Optional) Add to an objective's `targetEnemyIds`** in `packages/content/src/data/objectives.ts`.

## Adding an Item

1. **Add localization keys** in `packages/localization/src/locales/en.ts`:

   ```ts
   "item.my_new_item.name": "My New Item",
   "item.my_new_item.description": "A shiny new thing.",
   ```

2. **Register the item type** in `packages/content/src/data/types.ts`:

   Add the new id to the `ItemDefinitionId` type in `packages/shared` (likely `packages/shared/src/ItemTypes.ts`).

3. **Add the item definition** in `packages/content/src/data/items.ts`:

   ```ts
   {
     id: itemId("my_new_item"),
     nameKey: "item.my_new_item.name",
     descriptionKey: "item.my_new_item.description",
     category: "material",
     rarity: "common",
     size: { width: 1, height: 1 },
     allowedEquipmentSlots: [],
     stackable: true,
     maxStackSize: 99,
     statModifiers: [],
     iconKey: "item_placeholder"
   }
   ```

   For equippable items, set `allowedEquipmentSlots` to the relevant slots (e.g. `["weapon"]`), and add `statModifiers` with target/operation/value.

4. **Add to a loot table** — see "Adding a Loot Table" below.

## Adding a Spawn Zone

Spawn zones define where enemies appear in a zone.

1. **Add the spawn zone** in `packages/content/src/data/spawnZones.ts`:

   ```ts
   {
     id: "nightmarket_my_new_enemy_zone",
     zoneId: "nightmarket",
     enemyId: "my_new_enemy",
     count: 2,
     minX: 1000,
     maxX: 1400,
     minY: 800,
     maxY: 1200,
   },
   ```

   - `id`: unique identifier for this spawn zone
   - `zoneId`: must match an existing zone id
   - `enemyId`: must match an existing enemy id
   - `count`: number of enemies that spawn in this area (at least 1)
   - `minX`/`maxX`/`minY`/`maxY`: bounding box for spawn positions

2. Ensure the referenced `enemyId` exists in `enemies.ts` and the `zoneId` exists in `zones.ts`.

3. The enemy id must also be listed in the zone's `enemyIds` array in `zones.ts`.

## Adding a Loot Table

Loot tables define what items can drop from enemies.

1. **Add the loot table** in `packages/content/src/data/lootTables.ts`:

   ```ts
   {
     id: "my_loot_table",
     entries: [
       { itemId: itemId("blackwire_scrap"), rarity: "common", weight: 70 },
       { itemId: itemId("my_new_item"), rarity: "common", weight: 20 },
       { itemId: itemId("rustbound_ring"), rarity: "rare", weight: 1 }
     ]
   },
   ```

   - `id`: unique identifier for this loot table
   - `entries`: each entry specifies an `itemId`, optional `rarity`, and `weight`
   - Rarity must match the item's `rarity` in `items.ts`
   - Weight must be positive

2. **Optionally register the loot table id** in the `LootTableId` type in `types.ts` (if it doesn't already match the pattern).

3. **Reference the loot table** from an enemy's `lootTableId` field in `enemies.ts`.

## Adding a Zone

1. **Add the zone** in `packages/content/src/data/zones.ts`:

   ```ts
   {
     id: "my_new_zone",
     zoneId: zoneId("my_new_zone"),
     nameKey: "zone.my_new_zone.name",
     descriptionKey: "zone.my_new_zone.description",
     roomType: "combat",
     classification: "combat",
     maxPlayers: 4,
     enemyIds: ["my_new_enemy"],
     transitionZoneIds: ["nightmarket"],
     mapKey: "map_my_new_zone_placeholder",
     bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 800 }
   },
   ```

2. **Register the zone id** in the `ZoneContentId` type in `types.ts`.

3. **Add localization keys** for `nameKey` and `descriptionKey` in `en.ts`.

## Adding a World Prop

1. **Add the world prop** in `packages/content/src/data/worldProps.ts`:

   ```ts
   { id: "my_zone_my_prop_01", zoneId: "my_zone", kind: "crate", label: "Crate", x: 500, y: 400 },
   ```

   - `id`: unique identifier
   - `zoneId`: must reference an existing zone
   - `kind`: one of the valid `WorldPropKind` values (see `types.ts`)
   - `label`: currently a hardcoded English string (planned for future localization)

## Verification

After making any changes, run validation:

```bash
pnpm validate:0.1
pnpm validate:0.2
```

The validation will catch:
- Duplicate content IDs
- Missing localization keys
- Invalid zone/enemy/item/equipment-slot references
- Invalid bounds or coordinates
- Inconsistent rarity between loot entries and items
- Non-positive weights and prices

Content that fails validation will prevent the server/client from starting or building — this is by design.