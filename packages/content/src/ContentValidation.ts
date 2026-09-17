import { en } from "@doomscrolls/localization";
import type { EquipmentSlot, StatModifierTarget } from "@doomscrolls/shared";
import { ContentValidationError } from "./ContentErrors";
import type { ContentRegistry } from "./ContentRegistry";
import type { ContentLocalizationKey, ZoneContentId } from "./data/types";

export const SUPPORTED_CORE_0_1_EQUIPMENT_SLOTS = [
  "weapon",
  "head",
  "chest",
  "hands",
  "feet",
  "ring_1",
  "amulet",
  "belt",
  "flask_1",
  "flask_2",
  "flask_3",
  "flask_4"
] as const satisfies readonly EquipmentSlot[];

export const SUPPORTED_STAT_MODIFIER_TARGETS = [
  "power",
  "speed",
  "mind",
  "toughness",
  "maxHp",
  "damage",
  "armor",
  "moveSpeed",
  "attackCooldownMs"
] as const satisfies readonly StatModifierTarget[];

export interface ContentValidationIssue {
  readonly category: string;
  readonly id: string;
  readonly message: string;
}

export type ContentValidationResult =
  | { readonly ok: true; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly ContentValidationIssue[] };

function validateUniqueIds(
  category: string,
  definitions: readonly { readonly id: string }[],
  errors: ContentValidationIssue[]
): void {
  const seen = new Set<string>();

  for (const definition of definitions) {
    if (seen.has(definition.id)) {
      errors.push({ category, id: definition.id, message: "Duplicate content id." });
    }

    seen.add(definition.id);
  }
}

function validateLocalizedDefinition(
  category: string,
  definition: { readonly id: string; readonly nameKey: ContentLocalizationKey; readonly descriptionKey?: ContentLocalizationKey },
  errors: ContentValidationIssue[]
): void {
  if (en[definition.nameKey] === undefined) {
    errors.push({ category, id: definition.id, message: `Missing English localization key: ${definition.nameKey}` });
  }

  if (definition.descriptionKey !== undefined && en[definition.descriptionKey] === undefined) {
    errors.push({ category, id: definition.id, message: `Missing English localization key: ${definition.descriptionKey}` });
  }
}

export function validateContentRegistry(registry: ContentRegistry): ContentValidationResult {
  const errors: ContentValidationIssue[] = [];

  validateUniqueIds("origin", registry.origins.all, errors);
  validateUniqueIds("passive", registry.passives.all, errors);
  validateUniqueIds("profession", registry.professions.all, errors);
  validateUniqueIds("class", registry.classes.all, errors);
  validateUniqueIds("currency", registry.currencies.all, errors);
  validateUniqueIds("skill", registry.skills.all, errors);
  validateUniqueIds("enemy", registry.enemies.all, errors);
  validateUniqueIds("item", registry.items.all, errors);
  validateUniqueIds("lootTable", registry.lootTables.all, errors);
  validateUniqueIds("zone", registry.zones.all, errors);
  validateUniqueIds("levelTable", registry.levelTables.all, errors);
  validateUniqueIds("equipmentSlot", registry.equipmentSlots.all, errors);
  validateUniqueIds("spawnZone", registry.spawnZones, errors);
  validateUniqueIds("spawnPoint", registry.spawnPoints.all, errors);
  validateUniqueIds("worldProp", registry.worldProps.all, errors);
  validateUniqueIds("visualAsset", registry.visualAssets.all, errors);
  validateUniqueIds("objective", registry.objectives.all, errors);
  validateUniqueIds("quest", registry.quests.all, errors);
  validateUniqueIds("townService", registry.townServices.all, errors);
  validateUniqueIds("vendorStock", registry.vendorStocks.all, errors);
  validateUniqueIds("lore", registry.lore.all, errors);
  validateUniqueIds("world", registry.worlds.all, errors);
  validateUniqueIds("continent", registry.continents.all, errors);
  validateUniqueIds("area", registry.areas.all, errors);

  for (const origin of registry.origins.all) {
    validateLocalizedDefinition("origin", origin, errors);

    for (const passiveId of origin.passiveIds) {
      if (!registry.passives.has(passiveId)) {
        errors.push({ category: "origin", id: origin.id, message: `Unknown passive id: ${passiveId}` });
      }
    }

    if (!registry.zones.has(origin.startingZoneId)) {
      errors.push({ category: "origin", id: origin.id, message: `Unknown starting zone id: ${origin.startingZoneId}` });
    }

    for (const classId of origin.allowedClassIds) {
      if (!registry.classes.has(classId)) {
        errors.push({ category: "origin", id: origin.id, message: `Unknown allowed class id: ${classId}` });
      }
    }
  }

  for (const passive of registry.passives.all) {
    validateLocalizedDefinition("passive", passive, errors);
  }

  // ── Milestone 0.3 -- Profession Training System ──
  for (const profession of registry.professions.all) {
    validateLocalizedDefinition("profession", profession, errors);

    let previousTier = 0;
    for (const tierDef of profession.tiers) {
      if (tierDef.tier !== previousTier + 1) {
        errors.push({ category: "profession", id: profession.id, message: `Tiers must be sequential starting at 1: got tier ${tierDef.tier} after ${previousTier}.` });
      }
      if (tierDef.costCopper <= 0) {
        errors.push({ category: "profession", id: profession.id, message: `Tier ${tierDef.tier} costCopper must be positive.` });
      }
      previousTier = tierDef.tier;
    }
  }

  for (const characterClass of registry.classes.all) {
    validateLocalizedDefinition("class", characterClass, errors);

    if (!registry.skills.has(characterClass.startingSkillId)) {
      errors.push({ category: "class", id: characterClass.id, message: `Unknown starting skill id: ${characterClass.startingSkillId}` });
    }

    if (!registry.skills.has(characterClass.secondarySkillId)) {
      errors.push({ category: "class", id: characterClass.id, message: `Unknown secondary skill id: ${characterClass.secondarySkillId}` });
    }

    if (!registry.skills.has(characterClass.tertiarySkillId)) {
      errors.push({ category: "class", id: characterClass.id, message: `Unknown tertiary skill id: ${characterClass.tertiarySkillId}` });
    }
  }

  for (const skill of registry.skills.all) {
    validateLocalizedDefinition("skill", skill, errors);
  }

  for (const enemy of registry.enemies.all) {
    validateLocalizedDefinition("enemy", enemy, errors);

    if (!registry.lootTables.has(enemy.lootTableId)) {
      errors.push({ category: "enemy", id: enemy.id, message: `Unknown loot table id: ${enemy.lootTableId}` });
    }
  }

  for (const zone of registry.zones.all) {
    validateLocalizedDefinition("zone", zone, errors);

    for (const enemyId of zone.enemyIds) {
      if (!registry.enemies.has(enemyId)) {
        errors.push({ category: "zone", id: zone.id, message: `Unknown enemy id: ${enemyId}` });
      }
    }

    for (const transitionZoneId of zone.transitionZoneIds) {
      if (!registry.zones.has(transitionZoneId)) {
        errors.push({ category: "zone", id: zone.id, message: `Unknown transition zone id: ${transitionZoneId}` });
      }
    }

    // Core 0.32 — every zone belongs to exactly one real-world Area.
    if (!registry.areas.has(zone.areaId)) {
      errors.push({ category: "zone", id: zone.id, message: `Unknown area id: ${zone.areaId}` });
    }

    const bounds = zone.bounds;

    if (bounds.minX >= bounds.maxX) {
      errors.push({ category: "zone", id: zone.id, message: `Bounds minX (${bounds.minX}) must be less than maxX (${bounds.maxX}).` });
    }

    if (bounds.minY >= bounds.maxY) {
      errors.push({ category: "zone", id: zone.id, message: `Bounds minY (${bounds.minY}) must be less than maxY (${bounds.maxY}).` });
    }

    if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.maxX) || !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxY)) {
      errors.push({ category: "zone", id: zone.id, message: "Bounds values must be finite numbers." });
    }

    const restAreaBounds = zone.restAreaBounds;
    if (restAreaBounds) {
      if (!Number.isFinite(restAreaBounds.minX) || !Number.isFinite(restAreaBounds.maxX) || !Number.isFinite(restAreaBounds.minY) || !Number.isFinite(restAreaBounds.maxY)) {
        errors.push({ category: "zone", id: zone.id, message: "Rest area bounds values must be finite numbers." });
      }

      if (restAreaBounds.minX >= restAreaBounds.maxX) {
        errors.push({ category: "zone", id: zone.id, message: `Rest area bounds minX (${restAreaBounds.minX}) must be less than maxX (${restAreaBounds.maxX}).` });
      }

      if (restAreaBounds.minY >= restAreaBounds.maxY) {
        errors.push({ category: "zone", id: zone.id, message: `Rest area bounds minY (${restAreaBounds.minY}) must be less than maxY (${restAreaBounds.maxY}).` });
      }

      // Ensure rest area bounds are within zone bounds
      if (
        restAreaBounds.minX < bounds.minX ||
        restAreaBounds.maxX > bounds.maxX ||
        restAreaBounds.minY < bounds.minY ||
        restAreaBounds.maxY > bounds.maxY
      ) {
        errors.push({
          category: "zone",
          id: zone.id,
          message: `Rest area bounds (${restAreaBounds.minX}, ${restAreaBounds.minY}) - (${restAreaBounds.maxX}, ${restAreaBounds.maxY}) must be within zone bounds (${bounds.minX}, ${bounds.minY}) - (${bounds.maxX}, ${bounds.maxY}).`,
        });
      }
    }

    if (zone.groundTileKey !== undefined) {
      const asset = registry.visualAssets.get(zone.groundTileKey);
      if (asset === undefined) {
        errors.push({ category: "zone", id: zone.id, message: `Unknown ground tile key: ${zone.groundTileKey}` });
      } else if (asset.category !== "ground_tile") {
        errors.push({ category: "zone", id: zone.id, message: `groundTileKey "${zone.groundTileKey}" is not a ground_tile visual asset.` });
      }
    }
  }

  for (const item of registry.items.all) {
    validateLocalizedDefinition("item", item, errors);

    for (const slot of item.allowedEquipmentSlots) {
      if (!registry.equipmentSlots.has(slot)) {
        errors.push({ category: "item", id: item.id, message: `Unknown allowed equipment slot: ${slot}` });
      }
    }

    for (const modifier of item.statModifiers) {
      if (!SUPPORTED_STAT_MODIFIER_TARGETS.includes(modifier.target)) {
        errors.push({ category: "item", id: item.id, message: `Unsupported stat modifier target: ${modifier.target}` });
      }
    }

    if (item.stackable && item.maxStackSize <= 1) {
      errors.push({ category: "item", id: item.id, message: "Stackable items must have maxStackSize greater than 1." });
    }

    if (!item.stackable && item.maxStackSize !== 1) {
      errors.push({ category: "item", id: item.id, message: "Non-stackable items must have maxStackSize of 1." });
    }
  }

  for (const lootTable of registry.lootTables.all) {
    for (const entry of lootTable.entries) {
      if (!registry.items.has(entry.itemId)) {
        errors.push({ category: "lootTable", id: lootTable.id, message: `Unknown item id: ${entry.itemId}` });
      }

      if (entry.rarity !== undefined) {
        const item = registry.items.get(entry.itemId);
        if (item !== undefined && item.rarity !== entry.rarity) {
          errors.push({
            category: "lootTable",
            id: lootTable.id,
            message: `Loot entry rarity mismatch for item: ${entry.itemId}`
          });
        }
      }

      if (entry.weight <= 0) {
        errors.push({ category: "lootTable", id: lootTable.id, message: `Loot weight must be positive for item: ${entry.itemId}` });
      }
    }
  }

  for (const levelTable of registry.levelTables.all) {
    const levelOne = levelTable.levels.find((entry) => entry.level === 1);

    if (levelOne === undefined) {
      errors.push({ category: "levelTable", id: levelTable.id, message: "Level table must contain level 1." });
    } else if (levelOne.requiredXp !== 0) {
      errors.push({ category: "levelTable", id: levelTable.id, message: "Level 1 required XP must be 0." });
    }

    let previousRequiredXp = Number.NEGATIVE_INFINITY;

    for (const threshold of levelTable.levels) {
      if (threshold.requiredXp < previousRequiredXp) {
        errors.push({ category: "levelTable", id: levelTable.id, message: "Level thresholds must be non-decreasing." });
      }

      previousRequiredXp = threshold.requiredXp;
    }
  }

  for (const equipmentSlot of registry.equipmentSlots.all) {
    if (!SUPPORTED_CORE_0_1_EQUIPMENT_SLOTS.includes(equipmentSlot.id)) {
      errors.push({ category: "equipmentSlot", id: equipmentSlot.id, message: "Unsupported Core 0.1 equipment slot id." });
    }

    validateLocalizedDefinition("equipmentSlot", equipmentSlot, errors);
  }

  const activeSlotIds = registry.equipmentSlots.all.filter((slot) => slot.activeInCore01).map((slot) => slot.id);

  for (const supportedSlot of SUPPORTED_CORE_0_1_EQUIPMENT_SLOTS) {
    if (!activeSlotIds.includes(supportedSlot)) {
      errors.push({ category: "equipmentSlot", id: supportedSlot, message: "Missing active Core 0.1 equipment slot." });
    }
  }

  // ── Spawn zone validation ──
  for (const spawnZone of registry.spawnZones) {
    if (!registry.zones.has(spawnZone.zoneId as ZoneContentId)) {
      errors.push({ category: "spawnZone", id: spawnZone.id, message: `Unknown zone id: ${spawnZone.zoneId}` });
    }

    if (!registry.enemies.has(spawnZone.enemyId)) {
      errors.push({ category: "spawnZone", id: spawnZone.id, message: `Unknown enemy id: ${spawnZone.enemyId}` });
    }

    if (spawnZone.count < 1) {
      errors.push({ category: "spawnZone", id: spawnZone.id, message: "Spawn count must be at least 1." });
    }

    if (spawnZone.minX >= spawnZone.maxX) {
      errors.push({ category: "spawnZone", id: spawnZone.id, message: `minX (${spawnZone.minX}) must be less than maxX (${spawnZone.maxX}).` });
    }

    if (spawnZone.minY >= spawnZone.maxY) {
      errors.push({ category: "spawnZone", id: spawnZone.id, message: `minY (${spawnZone.minY}) must be less than maxY (${spawnZone.maxY}).` });
    }

    if (!Number.isFinite(spawnZone.minX) || !Number.isFinite(spawnZone.maxX) || !Number.isFinite(spawnZone.minY) || !Number.isFinite(spawnZone.maxY)) {
      errors.push({ category: "spawnZone", id: spawnZone.id, message: "Bounds values must be finite numbers." });
    }

    for (const member of spawnZone.pack ?? []) {
      if (!registry.enemies.has(member.enemyId)) {
        errors.push({ category: "spawnZone", id: spawnZone.id, message: `Unknown pack member enemy id: ${member.enemyId}` });
      }
      if (member.count < 1) {
        errors.push({ category: "spawnZone", id: spawnZone.id, message: "Pack member count must be at least 1." });
      }
    }

    for (const [field, value] of [
      ["leaderEliteChance", spawnZone.leaderEliteChance],
      ["leaderChampionChance", spawnZone.leaderChampionChance],
    ] as const) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1)) {
        errors.push({ category: "spawnZone", id: spawnZone.id, message: `${field} must be between 0 and 1.` });
      }
    }
  }

  // ── Spawn point validation ──
  for (const spawnPoint of registry.spawnPoints.all) {
    if (!registry.zones.has(spawnPoint.zoneId)) {
      errors.push({ category: "spawnPoint", id: spawnPoint.id, message: `Unknown zone id: ${spawnPoint.zoneId}` });
    }

    if (!Number.isFinite(spawnPoint.x) || !Number.isFinite(spawnPoint.y)) {
      errors.push({ category: "spawnPoint", id: spawnPoint.id, message: "Coordinates must be finite numbers." });
    }

    if (spawnPoint.labelKey !== undefined && en[spawnPoint.labelKey] === undefined) {
      errors.push({ category: "spawnPoint", id: spawnPoint.id, message: `Missing English localization key: ${spawnPoint.labelKey}` });
    }
  }

  // ── World prop validation ──
  const VALID_WORLD_PROP_KINDS = [
    "crate", "lamp", "debris", "junk", "ambient_rat", "ambient_pig",
    "ambient_chicken", "loot_container", "vendor", "town_service",
    "waypoint", "combat_edge", "combat_return_gate", "area_label", "path_marker", "boundary_marker",
    "safe_area_marker", "rest_area_marker", "building_footprint", "street_surface", "water_surface",
    "zone_transition", "quest_giver"
  ] as const;

  for (const prop of registry.worldProps.all) {
    if (!registry.zones.has(prop.zoneId)) {
      errors.push({ category: "worldProp", id: prop.id, message: `Unknown zone id: ${prop.zoneId}` });
    }

    if (!(VALID_WORLD_PROP_KINDS as readonly string[]).includes(prop.kind)) {
      errors.push({ category: "worldProp", id: prop.id, message: `Unknown world prop kind: ${prop.kind}` });
    }

    if (!Number.isFinite(prop.x) || !Number.isFinite(prop.y)) {
      errors.push({ category: "worldProp", id: prop.id, message: "Coordinates must be finite numbers." });
    }

    if (prop.labelKey !== undefined && en[prop.labelKey] === undefined) {
      errors.push({ category: "worldProp", id: prop.id, message: `Missing English localization key: ${prop.labelKey}` });
    }

    // A loot_container must have its own real loot table -- interactValidation.ts
    // reads this field directly rather than hardcoding an enemy id as a
    // stand-in loot-table key, so this must always resolve to a real row.
    if (prop.kind === "loot_container") {
      if (prop.lootTableId === undefined) {
        errors.push({ category: "worldProp", id: prop.id, message: "loot_container props must set lootTableId." });
      } else if (!registry.lootTables.has(prop.lootTableId)) {
        errors.push({ category: "worldProp", id: prop.id, message: `Unknown lootTableId: ${prop.lootTableId}` });
      }
    }

    // A zone_transition door must declare which real zone it leads to.
    if (prop.kind === "zone_transition") {
      if (prop.targetZoneId === undefined) {
        errors.push({ category: "worldProp", id: prop.id, message: "zone_transition props must set targetZoneId." });
      } else if (!registry.zones.has(prop.targetZoneId)) {
        errors.push({ category: "worldProp", id: prop.id, message: `Unknown targetZoneId: ${prop.targetZoneId}` });
      }
    }

    // A quest_giver must declare which real quest it offers/turns in.
    if (prop.kind === "quest_giver") {
      if (prop.questId === undefined) {
        errors.push({ category: "worldProp", id: prop.id, message: "quest_giver props must set questId." });
      } else if (!registry.quests.has(prop.questId)) {
        errors.push({ category: "worldProp", id: prop.id, message: `Unknown questId: ${prop.questId}` });
      }
    }

    // A building_footprint/street_surface/water_surface must carry its
    // own real outline -- these kinds are rendered as an arbitrary
    // polygon, not one of the fixed-size primitive shapes every other
    // kind uses.
    if (prop.kind === "building_footprint" || prop.kind === "street_surface" || prop.kind === "water_surface") {
      if (prop.points === undefined || prop.points.length < 3) {
        errors.push({ category: "worldProp", id: prop.id, message: `${prop.kind} props must set points with at least 3 vertices.` });
      } else {
        for (const point of prop.points) {
          if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
            errors.push({ category: "worldProp", id: prop.id, message: `${prop.kind} points must be finite numbers.` });
            break;
          }
        }
      }
    }
  }

  // ── Visual asset validation ──
  const VALID_VISUAL_ASSET_CATEGORIES = ["ground_tile", "enemy_sprite", "player_sprite", "prop_sprite", "item_icon", "hp_bar", "rarity_frame"] as const;

  for (const asset of registry.visualAssets.all) {
    if (!(VALID_VISUAL_ASSET_CATEGORIES as readonly string[]).includes(asset.category)) {
      errors.push({ category: "visualAsset", id: asset.id, message: `Unknown visual asset category: ${asset.category}` });
    }

    if (asset.path.length === 0) {
      errors.push({ category: "visualAsset", id: asset.id, message: "path must not be empty." });
    }

    if (!asset.path.startsWith("/")) {
      errors.push({ category: "visualAsset", id: asset.id, message: `path must be root-relative (start with "/"): ${asset.path}` });
    }

    if (!Number.isFinite(asset.sourceWidth) || asset.sourceWidth <= 0 || !Number.isFinite(asset.sourceHeight) || asset.sourceHeight <= 0) {
      errors.push({ category: "visualAsset", id: asset.id, message: "sourceWidth/sourceHeight must be positive finite numbers." });
    }

    if (asset.frameWidth !== undefined || asset.frameHeight !== undefined || asset.frameCount !== undefined) {
      if (
        asset.frameWidth === undefined || asset.frameWidth <= 0 ||
        asset.frameHeight === undefined || asset.frameHeight <= 0 ||
        asset.frameCount === undefined || asset.frameCount <= 0
      ) {
        errors.push({ category: "visualAsset", id: asset.id, message: "frameWidth/frameHeight/frameCount must all be set and positive when any one is set." });
      } else if (asset.frameWidth * asset.frameCount !== asset.sourceWidth || asset.frameHeight !== asset.sourceHeight) {
        errors.push({ category: "visualAsset", id: asset.id, message: "frameWidth * frameCount must equal sourceWidth, and frameHeight must equal sourceHeight." });
      }
    }

    // An item_icon row that matches no item's iconKey is orphaned data
    // (most likely a typo) -- it can never be looked up by real content.
    if (asset.category === "item_icon" && !registry.items.all.some((item) => item.iconKey === asset.id)) {
      errors.push({ category: "visualAsset", id: asset.id, message: `item_icon asset id does not match any item's iconKey: ${asset.id}` });
    }
  }

  // ── Objective validation ──
  for (const objective of registry.objectives.all) {
    if (en[objective.titleKey] === undefined) {
      errors.push({ category: "objective", id: objective.id, message: `Missing English localization key: ${objective.titleKey}` });
    }

    if (en[objective.descriptionKey] === undefined) {
      errors.push({ category: "objective", id: objective.id, message: `Missing English localization key: ${objective.descriptionKey}` });
    }

    for (const enemyId of objective.targetEnemyIds) {
      if (!registry.enemies.has(enemyId)) {
        errors.push({ category: "objective", id: objective.id, message: `Unknown target enemy id: ${enemyId}` });
      }
    }

    if (objective.requiredKills < 1) {
      errors.push({ category: "objective", id: objective.id, message: "requiredKills must be at least 1." });
    }

    if (objective.xpReward < 0) {
      errors.push({ category: "objective", id: objective.id, message: "xpReward must be non-negative." });
    }

    if (objective.copperReward < 0) {
      errors.push({ category: "objective", id: objective.id, message: "copperReward must be non-negative." });
    }

    if (objective.zoneId !== undefined && !registry.zones.has(objective.zoneId)) {
      errors.push({ category: "objective", id: objective.id, message: `Unknown zone id: ${objective.zoneId}` });
    }
  }

  // ── Quest validation ──
  for (const quest of registry.quests.all) {
    for (const key of [quest.titleKey, quest.descriptionKey, quest.greetingKey, quest.turnInKey, quest.completedKey]) {
      if (en[key] === undefined) {
        errors.push({ category: "quest", id: quest.id, message: `Missing English localization key: ${key}` });
      }
    }

    if (quest.xpReward < 0) {
      errors.push({ category: "quest", id: quest.id, message: "xpReward must be non-negative." });
    }

    if (quest.copperReward < 0) {
      errors.push({ category: "quest", id: quest.id, message: "copperReward must be non-negative." });
    }
  }

  // ── Town service validation ──
  const VALID_TOWN_SERVICE_KINDS = ["vendor", "stash", "trainer", "waypoint"] as const;

  for (const service of registry.townServices.all) {
    if (en[service.labelKey] === undefined) {
      errors.push({ category: "townService", id: service.id, message: `Missing English localization key: ${service.labelKey}` });
    }

    if (en[service.unavailableMessageKey] === undefined) {
      errors.push({ category: "townService", id: service.id, message: `Missing English localization key: ${service.unavailableMessageKey}` });
    }

    if (!(VALID_TOWN_SERVICE_KINDS as readonly string[]).includes(service.serviceKind)) {
      errors.push({ category: "townService", id: service.id, message: `Unknown town service kind: ${service.serviceKind}` });
    }
  }

  // ── Vendor stock validation ──
  for (const stock of registry.vendorStocks.all) {
    if (!registry.items.has(stock.itemId)) {
      errors.push({ category: "vendorStock", id: stock.id, message: `Unknown item id: ${stock.itemId}` });
    }

    if (stock.priceCopper <= 0) {
      errors.push({ category: "vendorStock", id: stock.id, message: "priceCopper must be positive." });
    }
  }

  // ── Lore validation ──
  // Every lore entry must resolve to a real content ID of its declared
  // kind, so prose lore can't silently drift out of sync with content
  // the way it has in design docs.
  for (const entry of registry.lore.all) {
    if (en[entry.titleKey] === undefined) {
      errors.push({ category: "lore", id: entry.id, message: `Missing English localization key: ${entry.titleKey}` });
    }

    if (en[entry.bodyKey] === undefined) {
      errors.push({ category: "lore", id: entry.id, message: `Missing English localization key: ${entry.bodyKey}` });
    }

    switch (entry.targetKind) {
      case "class":
        if (!registry.classes.has(entry.targetId)) {
          errors.push({ category: "lore", id: entry.id, message: `Unknown class id: ${entry.targetId}` });
        }
        break;
      case "origin":
        if (!registry.origins.has(entry.targetId)) {
          errors.push({ category: "lore", id: entry.id, message: `Unknown origin id: ${entry.targetId}` });
        }
        break;
      case "zone":
        if (!registry.zones.has(entry.targetId)) {
          errors.push({ category: "lore", id: entry.id, message: `Unknown zone id: ${entry.targetId}` });
        }
        break;
      case "enemy":
        if (!registry.enemies.has(entry.targetId)) {
          errors.push({ category: "lore", id: entry.id, message: `Unknown enemy id: ${entry.targetId}` });
        }
        break;
    }
  }

  // ── World / Continent / Area validation (Core 0.32 — World Map Foundation) ──
  for (const world of registry.worlds.all) {
    validateLocalizedDefinition("world", world, errors);
  }

  for (const continent of registry.continents.all) {
    validateLocalizedDefinition("continent", continent, errors);

    if (!registry.worlds.has(continent.worldId)) {
      errors.push({ category: "continent", id: continent.id, message: `Unknown world id: ${continent.worldId}` });
    }
  }

  for (const area of registry.areas.all) {
    validateLocalizedDefinition("area", area, errors);

    if (!registry.continents.has(area.continentId)) {
      errors.push({ category: "area", id: area.id, message: `Unknown continent id: ${area.continentId}` });
    }

    if (!Number.isFinite(area.latitude) || area.latitude < -90 || area.latitude > 90) {
      errors.push({ category: "area", id: area.id, message: `latitude must be a finite number between -90 and 90: ${area.latitude}` });
    }

    if (!Number.isFinite(area.longitude) || area.longitude < -180 || area.longitude > 180) {
      errors.push({ category: "area", id: area.id, message: `longitude must be a finite number between -180 and 180: ${area.longitude}` });
    }
  }

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function assertValidContentRegistry(registry: ContentRegistry): void {
  const result = validateContentRegistry(registry);

  if (!result.ok) {
    throw new ContentValidationError(result.errors.map((error) => `${error.category}:${error.id} - ${error.message}`));
  }
}