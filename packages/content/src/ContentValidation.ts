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
  "flask_1"
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
  validateUniqueIds("class", registry.classes.all, errors);
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
  validateUniqueIds("objective", registry.objectives.all, errors);
  validateUniqueIds("townService", registry.townServices.all, errors);
  validateUniqueIds("vendorStock", registry.vendorStocks.all, errors);

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

  for (const characterClass of registry.classes.all) {
    validateLocalizedDefinition("class", characterClass, errors);

    if (!registry.skills.has(characterClass.startingSkillId)) {
      errors.push({ category: "class", id: characterClass.id, message: `Unknown starting skill id: ${characterClass.startingSkillId}` });
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
    "waypoint", "combat_edge", "area_label", "path_marker", "boundary_marker",
    "safe_area_marker", "rest_area_marker"
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

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function assertValidContentRegistry(registry: ContentRegistry): void {
  const result = validateContentRegistry(registry);

  if (!result.ok) {
    throw new ContentValidationError(result.errors.map((error) => `${error.category}:${error.id} - ${error.message}`));
  }
}