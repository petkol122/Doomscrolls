export { ContentRegistry, contentRegistry } from "./ContentRegistry";
export type { ContentCollection, ContentRegistryInput } from "./ContentRegistry";

export {
  assertValidContentRegistry,
  SUPPORTED_CORE_0_1_EQUIPMENT_SLOTS,
  SUPPORTED_STAT_MODIFIER_TARGETS,
  validateContentRegistry
} from "./ContentValidation";
export type { ContentValidationIssue, ContentValidationResult } from "./ContentValidation";

export { ContentValidationError } from "./ContentErrors";

export { origins } from "./data/origins";
export { classes } from "./data/classes";
export { passives } from "./data/passives";
export { skills } from "./data/skills";
export { enemies } from "./data/enemies";
export { items } from "./data/items";
export { lootTables } from "./data/lootTables";
export { zones } from "./data/zones";
export { spawnPoints } from "./data/spawnPoints";
export { levelTables } from "./data/levelTables";
export { equipmentSlots } from "./data/equipmentSlots";

export type {
  CharacterClassContentDefinition,
  ContentLocalizationKey,
  EnemyContentDefinition,
  EquipmentSlotCategory,
  EquipmentSlotContentDefinition,
  ItemContentDefinition,
  ItemRarity,
  ItemUseEffectDefinition,
  LevelTableDefinition,
  LootTableDefinition,
  OriginContentDefinition,
  PassiveContentDefinition,
  SkillContentDefinition,
  SkillTargetingMode,
  SpawnPointContentDefinition,
  SpawnPointContentId,
  ZoneContentDefinition,
  ZoneRoomType
} from "./data/types";
