import type {
  CharacterClassKey,
  CurrencyId,
  EquipmentSlot,
  ItemCategory,
  ItemDefinitionId,
  OriginKey,
  PassiveKey,
  ProfessionId,
  PrimaryStats,
  SpawnPointId,
  StatModifier,
  ZoneId
} from "@doomscrolls/shared";
import type { LocalizationKey } from "@doomscrolls/localization";

export type ContentLocalizationKey = LocalizationKey;

export type SkillId = "heavy_strike" | "grave_spark" | "bone_splinter" | "shatter_blow" | "groundbreaker" | "malware_surge" | "overclock_turret" | "aerosol_flash" | "adrenaline_stim";
export type EnemyId = "trashboar_runt" | "trashboar_brute" | "trashboar_skitter" | "static_wretch" | "slag_hound" | "foundry_warden" | "yard_drudge" | "ash_rat" | "brine_crawler" | "tide_stalker" | "drowned_hauler" | "arc_sentinel";
export type LootTableId = "sewer_starter_loot" | "sewer_brute_loot" | "sewer_skitter_loot" | "static_yard_loot" | "cinderworks_loot" | "saltmere_docks_loot";
export type LevelTableId = "level_1_to_10";
export type ObjectiveId = "cull_trashboars" | "break_the_brute" | "sewer_cleanup" | "skitter_hunt" | "static_cleanup" | "sewer_patrol" | "slag_hunt" | "foundry_purge" | "drudge_patrol" | "ash_cull" | "brine_cull" | "tide_hunt" | "hauler_purge" | "arc_purge" | "yard_patrol" | "cinder_patrol" | "dock_patrol";
// Core 0.1 — Persistent Quest & Dialogue System foundation. One quest id
// today; more can be added to this union as content grows.
export type QuestId = "clear_the_rats";
export type ZoneContentId = "namesti_republiky" | "blackwire_sewers" | "static_yard" | "cinderworks" | "saltmere_docks" | "pilsen_namesti" | "pilsen_cathedral_interior" | "pilsen_bory";
// Core 0.32 — World Map Foundation. A real-world world/continent/area
// hierarchy the existing zones migrate under. Content/UI-layer only:
// the server and protocol have no notion of any of these three ids.
export type WorldContentId = "earth";
export type ContinentContentId = "europe";
export type AreaContentId = "pilsen";
export type ItemRarity = "common" | "rare" | "epic";
/**
 * Milestone 0.3 -- Street Alchemist Class Archetype. `"self_buff"` casts
 * apply the skill's `appliesEffect` to the caster instead of an enemy/
 * ground point -- no `targetEnemyId`/ground point is ever expected, and
 * the cast always resolves instantly (see `adrenaline_stim`).
 */
export type SkillTargetingMode = "target" | "ground_aoe" | "self_buff";
export type ZoneRoomType = "town" | "combat";
export type ZoneClassification = "safe_hub" | "combat" | "test_hybrid";
export type SpawnPointContentId = "namesti_republiky_spawn";
export type CombatInteractableId = "combat_return_to_town" | "static_yard_return_to_town" | "cinderworks_return_to_town" | "saltmere_docks_return_to_town";
export type EquipmentSlotCategory = "weapon" | "armor" | "accessory" | "belt" | "flask";
export type WorldPropKind = "crate" | "lamp" | "debris" | "junk" | "ambient_rat" | "ambient_pig" | "ambient_chicken" | "loot_container" | "vendor" | "town_service" | "waypoint" | "combat_edge" | "combat_return_gate" | "area_label" | "path_marker" | "boundary_marker" | "safe_area_marker" | "rest_area_marker" | "building_footprint" | "street_surface" | "water_surface" | "zone_transition" | "quest_giver";
export type VisualAssetCategory = "ground_tile" | "enemy_sprite" | "player_sprite" | "prop_sprite" | "item_icon" | "hp_bar" | "rarity_frame";
// Milestone 0.3 -- Pawn Shop / Army Surplus Vendor. First real vendor
// content: an army-surplus-and-pawn shop in pilsen_namesti trading in
// CZK, buying back gear and offering profession training.
// Milestone 0.3 (Namesti Republiky Building Doorway Vendors) added the
// four Pilsen Square doorway vendors below -- see worldProps.ts/
// townServices.ts/vendorStocks.ts.
export type VendorId = "army_surplus_pawn" | "lekarna_vendor" | "cisarsky_dum_vendor" | "tech_hub_vendor" | "hostinec_pub_vendor";
export type TownServiceId = VendorId;
export type TownServiceKind = "vendor" | "stash" | "trainer" | "waypoint";

/**
 * Milestone 0.3 -- Profession Training System. `ProfessionId` (imported
 * from `@doomscrolls/shared`) is the single source of truth so
 * server-side persistence code can reference it without depending on
 * this content package (see `packages/shared/src/profession/ProfessionTypes.ts`,
 * the same pattern `CurrencyId` already uses for the wallet).
 * `gunsmithing` is defined here as a named profession but has no
 * purchasable tiers yet -- only salvaging/fishing/cooking are trainable
 * at the Pawn Shop today.
 */
export interface ProfessionTierDefinition {
  readonly tier: number;
  readonly costCopper: number;
}

export interface ProfessionContentDefinition extends LocalizedContentDefinition {
  readonly id: ProfessionId;
  /** Ascending by `tier`, starting at 1. Empty = not trainable yet. */
  readonly tiers: readonly ProfessionTierDefinition[];
}

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

/**
 * Milestone 0.3 -- Multi-Currency Wallet Engine. One currency a
 * character's wallet can hold. `czkPerUnit` is the exchange rate into
 * CZK (the Net Worth base unit, see `calculatePlayerNetWorth`) --
 * `isCosmeticOnly` currencies (Street Cred) carry no `czkPerUnit`-driven
 * value and are never counted toward Net Worth, keeping cosmetic
 * progression strictly non-pay-to-win.
 */
export interface CurrencyContentDefinition extends LocalizedContentDefinition {
  readonly id: CurrencyId;
  readonly symbol: string;
  readonly czkPerUnit: number;
  readonly isRegionalPrimary: boolean;
  readonly isCosmeticOnly: boolean;
  readonly iconKey: string;
}

/**
 * Core 0.1 Foundation -- Enemy Rarity Tiers & Multi-Type Pack Spawning.
 * An additional enemy type spawned alongside a spawn zone's primary
 * `enemyId`/`count`, e.g. 2 supporting Skitter runts around a Brute pack
 * leader. Purely additive so every existing single-type spawn zone
 * (no `pack` field) keeps spawning exactly as before.
 */
export interface SpawnPackMemberDefinition {
  readonly enemyId: EnemyId;
  readonly count: number;
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
  /**
   * Optional additional enemy types spawned in this same pocket
   * alongside the primary `enemyId`/`count` (e.g. runts flanking a
   * brute pack leader). Absent = single-type pocket, unchanged from
   * pre-0.1-Foundation behavior.
   */
  readonly pack?: readonly SpawnPackMemberDefinition[];
  /**
   * Chance (0-1) the pocket's pack leader (the first enemy instance
   * spawned from the primary `enemyId`) rolls Elite rarity instead of
   * Normal. Checked before `leaderChampionChance`. Absent/0 = never.
   */
  readonly leaderEliteChance?: number;
  /**
   * Chance (0-1) the pocket's pack leader rolls Champion rarity
   * instead of Normal (only rolled when the Elite roll above misses).
   * Absent/0 = never.
   */
  readonly leaderChampionChance?: number;
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
  /**
   * Core 0.1 Foundation -- mana cost deducted from the caster's pool
   * before the cast is accepted. 0 = free (the basic-attack-flavored
   * `heavy_strike` primary slot).
   */
  readonly manaCost: number;
  /**
   * Highest rank a player can allocate skill points into for this
   * skill. Every skill starts at rank 1 (already castable, matching
   * pre-existing behavior) -- points spent beyond that raise the rank
   * up to this cap, each rank adding `damagePerRank` bonus damage.
   */
  readonly maxRank: number;
  readonly damagePerRank: number;
  /**
   * Core 0.2 -- Status Effects & Debuff System. Optional status effect a
   * successful cast applies to its target, alongside the skill's own
   * damage. Absent = the skill is damage-only (unchanged pre-0.2
   * behavior). Every field below must be present for the effect to
   * apply -- see `resolveSkillSlotDefinition`.
   */
  readonly appliesEffect?: "bleed" | "slow" | "stun" | "burn" | "emp_dot" | "haste";
  readonly effectDurationMs?: number;
  readonly effectMagnitude?: number;
  /**
   * Milestone 0.3 -- Street Alchemist Class Archetype. Optional second
   * status effect applied alongside `appliesEffect` (e.g. `aerosol_flash`
   * applies Burn as its primary effect and Slow as this one) -- absent =
   * single-effect, unchanged pre-0.3 behavior. Every field below must be
   * present for the secondary effect to apply -- see
   * `applySkillEffectIfDefined`.
   */
  readonly appliesSecondaryEffect?: "bleed" | "slow" | "stun" | "burn" | "emp_dot" | "haste";
  readonly secondaryEffectDurationMs?: number;
  readonly secondaryEffectMagnitude?: number;
  /**
   * Milestone 0.2 -- Server-Authoritative Projectiles & Ground-Targeted
   * AoE Skills. `isProjectile`/`projectileSpeed` (units/sec) mark a
   * `targeting: "target"` skill as travel-time instead of instant-hit;
   * `aoeRadius` is required when `targeting` is `"ground_aoe"`.
   */
  readonly isProjectile?: boolean;
  readonly projectileSpeed?: number;
  readonly aoeRadius?: number;
  /**
   * Milestone 0.3 -- Netrunner Urban-Magic Class Archetype. Marks a
   * `targeting: "ground_aoe"` skill as summoning a stationary, automated
   * turret at the targeted point instead of resolving an instant AoE hit
   * -- see `overclock_turret` and `apps/server/src/realtime/rooms/
   * turretSimulation.ts`. `aoeRadius` doubles as the turret's `attackRange`
   * and `baseDamage`/rank bonuses as its per-shot `attackDamage`; every
   * field below must be present for a turret to actually spawn.
   */
  readonly spawnsTurret?: boolean;
  readonly turretDurationMs?: number;
  readonly turretAttackIntervalMs?: number;
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
  /**
   * Core 0.2 -- Status Effects & Debuff System. Optional status effect a
   * landed heavy attack applies to its target, alongside the existing
   * `heavyAttackDamage`. Absent = the heavy attack is damage-only
   * (unchanged pre-0.2 behavior). Every field below must be present for
   * the effect to apply -- see `applyEnemyAggroDamage`'s heavy-attack
   * landing branch.
   */
  readonly heavyAttackAppliesEffect?: "bleed" | "slow" | "stun" | "burn";
  readonly heavyAttackEffectDurationMs?: number;
  readonly heavyAttackEffectMagnitude?: number;
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
  /**
   * Core 0.36 -- optional camera-rotation correction (degrees, clockwise)
   * for real-world-grounded zones whose Overpass lat/lon -> world-unit
   * conversion didn't come out with geographic north pointing straight up
   * on screen. Applied once, at render/projection time
   * (`worldProjection.ts`'s `worldToScreenDebugTopDown`/
   * `screenToWorldDebugTopDown`), around the current camera bounds'
   * center -- it never touches `bounds`, `WORLD_UNITS_PER_METER`, or any
   * prop's stored `x`/`y`. Absent = 0 = unchanged. namesti_republiky
   * deliberately leaves this unset: its own conversion already places
   * +X=east/+Y=south, which the existing top-down projection already
   * renders with north up (see docs/CORE_BUILD_0_33_PLAN.md).
   */
  readonly northRotationDeg?: number;
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

/**
 * Milestone 0.3 -- 4-Slot Flask Belt. `"restoreHpInstant"` is the
 * original healing-flask effect; `"restoreManaInstant"` and
 * `"restoreStaminaInstant"` extend the same shape to mana flasks and to
 * a stamina/utility flask -- since this codebase has no stamina
 * resource pool, its `value` is instead a dodge-cooldown reduction in
 * milliseconds (see `applyFlaskSlotIntent`).
 */
export type ItemUseEffectType = "restoreHpInstant" | "restoreManaInstant" | "restoreStaminaInstant";

export interface ItemUseEffectDefinition {
  readonly type: ItemUseEffectType;
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
  /**
   * Milestone 0.3 -- Multi-Currency Wallet Engine. Base CZK value used by
   * `calculatePlayerNetWorth` for an equipped instance of this item.
   * Absent = the Net Worth calculation falls back to a per-`rarity`
   * default (see `NET_WORTH_RARITY_FALLBACK_CZK`).
   */
  readonly baseValueCzk?: number;
}

export type AffixKind = "prefix" | "suffix";

/**
 * Milestone 0.3 -- Server-Authoritative Item Rarity & Random Affix Engine.
 * A rollable stat range an item instance can roll at drop time (see
 * `apps/server/src/realtime/rooms/affixRollEngine.ts`). Distinct from
 * `ItemRarity` above, which is a fixed tag on the item's own template,
 * not something rolled per-drop.
 */
export interface AffixContentDefinition {
  readonly id: string;
  readonly kind: AffixKind;
  readonly nameKey: ContentLocalizationKey;
  readonly target: StatModifier["target"];
  readonly operation: StatModifier["operation"];
  readonly min: number;
  readonly max: number;
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

/**
 * Core 0.1 — Persistent Quest & Dialogue System foundation. A quest a
 * "quest_giver" world prop offers: a greeting shown before it's
 * accepted, a turn-in line shown while accepted-but-not-complete, and a
 * completed line shown afterward. Deliberately flat (no objective steps
 * or branching dialogue tree) -- this is the minimal accept/complete
 * loop the foundation needs; a richer quest step system can build on
 * top of this shape later.
 */
export interface QuestContentDefinition {
  readonly id: QuestId;
  readonly titleKey: ContentLocalizationKey;
  readonly descriptionKey: ContentLocalizationKey;
  readonly greetingKey: ContentLocalizationKey;
  readonly turnInKey: ContentLocalizationKey;
  readonly completedKey: ContentLocalizationKey;
  readonly xpReward: number;
  readonly copperReward: number;
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
   * Core 0.35 -- required for `kind: "building_footprint"`,
   * `"street_surface"`, and (Core 0.37) `"water_surface"` (see
   * ContentValidation.ts): the prop's real-world
   * outline as a closed polygon, in the same absolute zone-local world
   * units as `x`/`y`. `x`/`y` remain the shape's own centroid (label
   * anchor, depth-sort key); `points` is the actual geometry the client
   * renders. Deliberately NOT registered as an interactable anywhere
   * (see `initializeTownInteractables.ts`'s allowlist) -- these are
   * solid-looking world geometry only, never clickable.
   */
  readonly points?: readonly WorldPropPoint[];
  /**
   * Required for `kind: "zone_transition"` (see ContentValidation.ts): the
   * zone this door/entrance moves the player into on interact.
   */
  readonly targetZoneId?: ZoneContentId;
  /**
   * Required for `kind: "quest_giver"` (see ContentValidation.ts): the
   * quest this NPC offers/turns in on interact.
   */
  readonly questId?: QuestId;
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
