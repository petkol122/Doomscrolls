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
export type EnemyId = "trashboar_runt" | "trashboar_brute" | "trashboar_skitter" | "static_wretch" | "slag_hound" | "foundry_warden" | "yard_drudge" | "ash_rat" | "brine_crawler" | "tide_stalker" | "drowned_hauler" | "arc_sentinel";
export type LootTableId = "sewer_starter_loot" | "sewer_brute_loot" | "sewer_skitter_loot" | "static_yard_loot" | "cinderworks_loot" | "saltmere_docks_loot";
export type LevelTableId = "level_1_to_10";
export type ObjectiveId = "cull_trashboars" | "break_the_brute" | "sewer_cleanup" | "skitter_hunt" | "static_cleanup" | "sewer_patrol" | "slag_hunt" | "foundry_purge" | "drudge_patrol" | "ash_cull" | "brine_cull" | "tide_hunt" | "hauler_purge" | "arc_purge" | "yard_patrol" | "cinder_patrol" | "dock_patrol";
export type ZoneContentId = "namesti_republiky" | "blackwire_sewers" | "static_yard" | "cinderworks" | "saltmere_docks";
// Core 0.32 — World Map Foundation. A real-world world/continent/area
// hierarchy the existing zones migrate under. Content/UI-layer only:
// the server and protocol have no notion of any of these three ids.
export type WorldContentId = "earth";
export type ContinentContentId = "europe";
export type AreaContentId = "pilsen";
export type ItemRarity = "common" | "rare" | "epic";
export type SkillTargetingMode = "target";
export type ZoneRoomType = "town" | "combat";
export type ZoneClassification = "safe_hub" | "combat" | "test_hybrid";
export type SpawnPointContentId = "namesti_republiky_spawn";
export type CombatInteractableId = "combat_return_to_town" | "static_yard_return_to_town" | "cinderworks_return_to_town" | "saltmere_docks_return_to_town";
export type EquipmentSlotCategory = "weapon" | "armor" | "accessory" | "belt" | "flask";
export type WorldPropKind = "crate" | "lamp" | "debris" | "junk" | "ambient_rat" | "ambient_pig" | "ambient_chicken" | "loot_container" | "vendor" | "town_service" | "waypoint" | "combat_edge" | "combat_return_gate" | "area_label" | "path_marker" | "boundary_marker" | "safe_area_marker" | "rest_area_marker" | "building_footprint" | "street_surface";
export type VisualAssetCategory = "ground_tile" | "enemy_sprite" | "player_sprite" | "prop_sprite" | "item_icon" | "hp_bar" | "rarity_frame";
export type VendorId = never;
export type TownServiceId = never;
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

/**
 * Core 0.33 — Nightmarket Real City-Center Expansion. The single scale
 * constant every zone's `bounds` is measured against when it is meant to
 * represent a real-world footprint: game units per real-world meter.
 *
 * Derived, not invented: Nightmarket's own pre-0.33 bounds (5000 x 3600)
 * divided almost exactly evenly by Namesti Republiky's real dimensions
 * (193m x 139m) on both axes independently (~25.906 and ~25.899, ~0.03%
 * apart) -- a coincidence confirmed via full git-history audit (the bounds
 * were tuned three times, always for gameplay spacing/aggro feel, never
 * against real geography; see docs/CORE_BUILD_0_33_PLAN.md Question 2).
 * Adopted deliberately here rather than left as an unexplained coincidence,
 * since it costs nothing (no existing zone needed rescaling) and gives
 * every future real-world-grounded zone one consistent constant to use.
 */
export const WORLD_UNITS_PER_METER = 25.9;

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
  /**
   * Core 0.32 — which real-world Area this zone belongs to. Every zone
   * has exactly one parent Area; an Area may have many zones (the
   * child holds the single-parent reference, matching how
   * `OriginContentDefinition.startingZoneId` already models a
   * child-references-parent relationship elsewhere in this file).
   */
  readonly areaId: AreaContentId;
  readonly bounds: ZoneContentBounds;
  /**
   * Optional rectangular boundary for a physical town rest/replenish area.
   * When set and the player is inside these bounds, the server triggers
   * `applyTownRestRefill` (HP + healing flask charges) on a periodic tick.
   * Absent = no physical rest area in this zone.
   */
  readonly restAreaBounds?: ZoneContentRestAreaBounds;
  /**
   * Core 0.22 — optional semantic key into `visualAssets` for this zone's
   * ground/floor tile texture. Absent = the client renders its existing
   * flat placeholder fill unchanged. Isometric art integration is being
   * rolled out one zone at a time (see docs/CORE_BUILD_0_22_PLAN.md);
   * this field is how a zone opts in once its tiles are mapped.
   */
  readonly groundTileKey?: string;
}

/**
 * Core 0.32 — World Map Foundation. A real-world `world -> continent ->
 * area` hierarchy, minimal by design: World/Continent carry nothing
 * beyond identity/localization (they exist to prove the hierarchy
 * holds, not because any current feature reads a continent-level
 * property), and Area carries only what the map screen and the
 * scalability check need. No classification/gating field of any kind
 * -- city-vs-safe-town distinction and level-gating are both out of
 * scope for this build (see docs/CORE_BUILD_0_32_PLAN.md).
 */
export interface WorldContentDefinition extends LocalizedContentDefinition {
  readonly id: WorldContentId;
}

export interface ContinentContentDefinition extends LocalizedContentDefinition {
  readonly id: ContinentContentId;
  readonly worldId: WorldContentId;
}

export interface AreaContentDefinition extends LocalizedContentDefinition {
  readonly id: AreaContentId;
  readonly continentId: ContinentContentId;
  /** Real-world coordinates (WGS84 degrees), used to place this area's marker on the map screen. */
  readonly latitude: number;
  readonly longitude: number;
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
  /**
   * Required for `kind: "loot_container"` props (see ContentValidation.ts).
   * The container's own real loot table -- interactValidation.ts reads
   * this instead of hardcoding an enemy id as a stand-in loot-table key,
   * so a loot container in any zone rolls from that zone's own real loot
   * pool, not another zone's borrowed table.
   */
  readonly lootTableId?: LootTableId;
  /**
   * Core 0.35 -- required for `kind: "building_footprint"` and
   * `"street_surface"` (see ContentValidation.ts): the prop's real-world
   * outline as a closed polygon, in the same absolute zone-local world
   * units as `x`/`y`. `x`/`y` remain the shape's own centroid (label
   * anchor, depth-sort key); `points` is the actual geometry the client
   * renders. Deliberately NOT registered as an interactable anywhere
   * (see `initializeTownInteractables.ts`'s allowlist) -- these are
   * solid-looking world geometry only, never clickable.
   */
  readonly points?: readonly WorldPropPoint[];
}

export interface WorldPropPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Core 0.22 — maps a semantic key (e.g. "ground_stone") to an actual
 * asset file, so rendering code can look up textures by key and never
 * reference a specific file/pack directly. Swapping the underlying art
 * pack later means editing this data, not any rendering code.
 */
export interface VisualAssetContentDefinition {
  readonly id: string;
  readonly category: VisualAssetCategory;
  /** Path under the client's public/ directory, e.g. "/assets/isobricks.png". */
  readonly path: string;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  /**
   * Core 0.23 — present only for a multi-frame sprite sheet (category
   * "hp_bar" today). `frameWidth`/`frameHeight` describe one frame in
   * the sheet at `path`; `frameCount` is how many frames it contains.
   * Absent for a single-image asset.
   */
  readonly frameWidth?: number;
  readonly frameHeight?: number;
  readonly frameCount?: number;
}
