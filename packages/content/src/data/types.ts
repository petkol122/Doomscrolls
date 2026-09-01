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

export type SkillId = "heavy_strike" | "grave_spark" | "bone_splinter" | "shatter_blow" | "groundbreaker";
export type EnemyId = "trashboar_runt" | "trashboar_brute" | "trashboar_skitter" | "static_wretch";
export type LootTableId = "sewer_starter_loot" | "sewer_brute_loot" | "sewer_skitter_loot" | "static_yard_loot";
export type LevelTableId = "level_1_to_10";
export type ObjectiveId = "cull_trashboars" | "break_the_brute" | "sewer_cleanup";
export type ZoneContentId = "nightmarket" | "blackwire_sewers" | "static_yard";
export type ItemRarity = "common" | "rare" | "epic";
export type SkillTargetingMode = "target";
export type ZoneRoomType = "town" | "combat";
export type ZoneClassification = "safe_hub" | "combat" | "test_hybrid";
export type SpawnPointContentId =
  | "nightmarket_spawn"
  | "nightmarket_blackwire_combat_entry"
  | "nightmarket_services_return"
  | "nightmarket_static_yard_combat_entry";
export type CombatInteractableId = "combat_return_to_nightmarket" | "static_yard_return_to_nightmarket";
export type EquipmentSlotCategory = "weapon" | "armor" | "accessory" | "belt" | "flask";
export type WorldPropKind = "crate" | "lamp" | "debris" | "junk" | "ambient_rat" | "ambient_pig" | "ambient_chicken" | "loot_container" | "vendor" | "town_service" | "waypoint" | "combat_edge" | "combat_return_gate" | "area_label" | "path_marker" | "boundary_marker" | "safe_area_marker" | "rest_area_marker";
export type VendorId = "nightmarket_suspicious_vendor";
export type TownServiceId = "nightmarket_stash_keeper" | "nightmarket_trainer" | "nightmarket_waypoint" | "nightmarket_suspicious_vendor";
export type TownServiceKind = "vendor" | "stash" | "trainer" | "waypoint";

export interface TownServiceContentDefinition {
  readonly id: TownServiceId;
  readonly serviceId: TownServiceId;
  readonly serviceKind: TownServiceKind;
  readonly labelKey: ContentLocalizationKey;
  readonly unavailableMessageKey: ContentLocalizationKey;
}

export interface VendorStockEntryDefinition {
  readonly id: string;
  readonly vendorId: VendorId;
  readonly itemId: ItemDefinitionId;
  readonly priceCopper: number;
}

export interface SpawnZoneDefinition {
  readonly id: string;
  readonly zoneId: string;
  readonly enemyId: EnemyId;
  readonly count: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

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
  /**
   * Core 0.7 — the skill cast by the right-click ("secondary") and
   * hotkey ("tertiary") skill slots. Content-driven so the slot
   * handlers (TownRoom/CombatRoom) resolve range/damage/cooldown from
   * `skills.ts` instead of hardcoded per-skill constants.
   */
  readonly secondarySkillId: SkillId;
  readonly tertiarySkillId: SkillId;
  readonly baseStats: PrimaryStats;
}

export interface SkillContentDefinition extends LocalizedContentDefinition {
  readonly id: SkillId;
  readonly targeting: SkillTargetingMode;
  readonly range: number;
  readonly cooldownMs: number;
  readonly baseDamage: number;
}

export interface EnemyCurrencyDropDefinition {
  readonly min: number;
  readonly max: number;
}

export interface EnemyContentDefinition extends LocalizedContentDefinition {
  readonly id: EnemyId;
  readonly level: number;
  readonly maxHp: number;
  readonly damage: number;
  readonly heavyAttackDamage?: number;
  readonly armor: number;
  readonly moveSpeed: number;
  readonly attackRange: number;
  readonly attackCooldownMs: number;
  readonly heavyAttackWindupMs?: number;
  readonly heavyAttackCooldownMs?: number;
  readonly heavyAttackChance?: number;
  readonly aggroRange: number;
  readonly leashRange: number;
  readonly xp: number;
  readonly lootTableId: LootTableId;
  readonly currencyDrop?: EnemyCurrencyDropDefinition;
  readonly spriteKey: string;
}

export interface ZoneContentBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface ZoneContentRestAreaBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface ZoneContentDefinition extends LocalizedContentDefinition {
  readonly id: ZoneContentId;
  readonly zoneId: ZoneId;
  readonly roomType: ZoneRoomType;
  readonly classification: ZoneClassification;
  readonly maxPlayers: number;
  readonly enemyIds: readonly EnemyId[];
  readonly transitionZoneIds: readonly ZoneContentId[];
  readonly mapKey: string;
  readonly bounds: ZoneContentBounds;
  /**
   * Optional rectangular boundary for a physical town rest/replenish area.
   * When set and the player is inside these bounds, the server triggers
   * `applyTownRestRefill` (HP + healing flask charges) on a periodic tick.
   * Absent = no physical rest area in this zone.
   */
  readonly restAreaBounds?: ZoneContentRestAreaBounds;
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
  readonly rarity?: ItemRarity;
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

export interface ObjectiveContentDefinition {
  readonly id: ObjectiveId;
  readonly titleKey: ContentLocalizationKey;
  readonly descriptionKey: ContentLocalizationKey;
  /**
   * Optional repeatability flag for future objective types.
   *
   * Core 0.4 does not implement repeatable objectives yet. When omitted,
   * objectives are treated as non-repeatable by default.
   */
  readonly repeatable?: boolean;
  readonly targetEnemyIds: readonly EnemyId[];
  readonly requiredKills: number;
  readonly xpReward: number;
  readonly copperReward: number;
  /**
   * Optional zone ID where this objective's target enemies can be found.
   * Used by the client to display location information.
   */
  readonly zoneId?: ZoneContentId;
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
  readonly descriptionKey?: ContentLocalizationKey;
  readonly category: EquipmentSlotCategory;
  readonly activeInCore01: boolean;
}

export interface WorldPropContentDefinition {
  readonly id: string;
  readonly zoneId: ZoneContentId;
  readonly kind: WorldPropKind;
  readonly label: string;
  readonly labelKey?: ContentLocalizationKey;
  readonly x: number;
  readonly y: number;
}
