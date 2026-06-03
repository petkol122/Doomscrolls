import type {
  CharacterClassKey,
  EquipmentSlot,
  ItemCategory,
  ItemDefinitionId,
  OriginKey,
  PassiveKey,
  PrimaryStats,
  SpawnPointId,
  StatModifier,
  ZoneId
} from "@doomscrolls/shared";
import type { LocalizationKey } from "@doomscrolls/localization";

export type ContentLocalizationKey = LocalizationKey;

export type SkillId = "heavy_strike";
export type EnemyId = "trashboar_runt";
export type LootTableId = "sewer_starter_loot";
export type LevelTableId = "level_1_to_10";
export type ZoneContentId = "nightmarket" | "blackwire_sewers";
export type ItemRarity = "common";
export type SkillTargetingMode = "target";
export type ZoneRoomType = "town" | "combat";
export type SpawnPointContentId = "nightmarket_spawn";
export type EquipmentSlotCategory = "weapon" | "armor" | "accessory" | "belt" | "flask";

export interface LocalizedContentDefinition {
  readonly id: string;
  readonly nameKey: ContentLocalizationKey;
  readonly descriptionKey: ContentLocalizationKey;
}

export interface OriginContentDefinition extends LocalizedContentDefinition {
  readonly id: OriginKey;
  readonly passiveIds: readonly PassiveKey[];
  readonly startingZoneId: ZoneContentId;
  readonly allowedClassIds: readonly CharacterClassKey[];
  readonly baseStats: PrimaryStats;
}

export interface PassiveContentDefinition extends LocalizedContentDefinition {
  readonly id: PassiveKey;
}

export interface CharacterClassContentDefinition extends LocalizedContentDefinition {
  readonly id: CharacterClassKey;
  readonly startingSkillId: SkillId;
  readonly baseStats: PrimaryStats;
}

export interface SkillContentDefinition extends LocalizedContentDefinition {
  readonly id: SkillId;
  readonly targeting: SkillTargetingMode;
  readonly range: number;
  readonly cooldownMs: number;
  readonly baseDamage: number;
}

export interface EnemyContentDefinition extends LocalizedContentDefinition {
  readonly id: EnemyId;
  readonly level: number;
  readonly maxHp: number;
  readonly damage: number;
  readonly armor: number;
  readonly moveSpeed: number;
  readonly attackRange: number;
  readonly attackCooldownMs: number;
  readonly aggroRange: number;
  readonly xp: number;
  readonly lootTableId: LootTableId;
  readonly spriteKey: string;
}

export interface ZoneContentBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface ZoneContentDefinition extends LocalizedContentDefinition {
  readonly id: ZoneContentId;
  readonly zoneId: ZoneId;
  readonly roomType: ZoneRoomType;
  readonly maxPlayers: number;
  readonly enemyIds: readonly EnemyId[];
  readonly transitionZoneIds: readonly ZoneContentId[];
  readonly mapKey: string;
  readonly bounds: ZoneContentBounds;
}

export interface ItemUseEffectDefinition {
  readonly type: "restoreHpInstant";
  readonly value: number;
  readonly charges: number;
}

export interface ItemContentDefinition extends LocalizedContentDefinition {
  readonly id: ItemDefinitionId;
  readonly category: ItemCategory;
  readonly rarity: ItemRarity;
  readonly size: { readonly width: number; readonly height: number };
  readonly allowedEquipmentSlots: readonly EquipmentSlot[];
  readonly stackable: boolean;
  readonly maxStackSize: number;
  readonly statModifiers: readonly StatModifier[];
  readonly durabilityMax?: number;
  readonly useEffect?: ItemUseEffectDefinition;
  readonly iconKey: string;
}

export interface LootTableEntryDefinition {
  readonly itemId: ItemDefinitionId;
  readonly weight: number;
}

export interface LootTableDefinition {
  readonly id: LootTableId;
  readonly entries: readonly LootTableEntryDefinition[];
}

export interface LevelThresholdDefinition {
  readonly level: number;
  readonly requiredXp: number;
}

export interface LevelTableDefinition {
  readonly id: LevelTableId;
  readonly levels: readonly LevelThresholdDefinition[];
}

export interface SpawnPointContentDefinition {
  readonly id: SpawnPointContentId;
  readonly spawnPointId: SpawnPointId;
  readonly zoneId: ZoneContentId;
  readonly x: number;
  readonly y: number;
  readonly labelKey?: ContentLocalizationKey;
}

export interface EquipmentSlotContentDefinition {
  readonly id: EquipmentSlot;
  readonly nameKey: ContentLocalizationKey;
  readonly category: EquipmentSlotCategory;
  readonly activeInCore01: boolean;
}