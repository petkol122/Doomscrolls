import { classes } from "./data/classes";
import { enemies } from "./data/enemies";
import { equipmentSlots } from "./data/equipmentSlots";
import { items } from "./data/items";
import { levelTables } from "./data/levelTables";
import { lootTables } from "./data/lootTables";
import { objectives } from "./data/objectives";
import { origins } from "./data/origins";
import { passives } from "./data/passives";
import { skills } from "./data/skills";
import { spawnPoints } from "./data/spawnPoints";
import { worldProps } from "./data/worldProps";
import { spawnZones } from "./data/spawnZones";
import { zones } from "./data/zones";
import type {
  CharacterClassContentDefinition,
  EnemyContentDefinition,
  EquipmentSlotContentDefinition,
  ItemContentDefinition,
  LevelTableDefinition,
  LootTableDefinition,
  ObjectiveContentDefinition,
  OriginContentDefinition,
  PassiveContentDefinition,
  SkillContentDefinition,
  SpawnPointContentDefinition,
  WorldPropContentDefinition,
  SpawnZoneDefinition,
  ZoneContentDefinition
} from "./data/types";

export interface ContentCollection<TDefinition extends { readonly id: string }> {
  readonly all: readonly TDefinition[];
  readonly map: ReadonlyMap<TDefinition["id"], TDefinition>;
  get(id: TDefinition["id"]): TDefinition | undefined;
  require(id: TDefinition["id"]): TDefinition;
  has(id: TDefinition["id"]): boolean;
}

export interface ContentRegistryInput {
  readonly origins: readonly OriginContentDefinition[];
  readonly passives: readonly PassiveContentDefinition[];
  readonly classes: readonly CharacterClassContentDefinition[];
  readonly skills: readonly SkillContentDefinition[];
  readonly enemies: readonly EnemyContentDefinition[];
  readonly items: readonly ItemContentDefinition[];
  readonly lootTables: readonly LootTableDefinition[];
  readonly objectives: readonly ObjectiveContentDefinition[];
  readonly zones: readonly ZoneContentDefinition[];
  readonly levelTables: readonly LevelTableDefinition[];
  readonly equipmentSlots: readonly EquipmentSlotContentDefinition[];
  readonly spawnPoints: readonly SpawnPointContentDefinition[];
  readonly worldProps: readonly WorldPropContentDefinition[];
  readonly spawnZones: readonly SpawnZoneDefinition[];
}

function createCollection<TDefinition extends { readonly id: string }>(
  categoryName: string,
  definitions: readonly TDefinition[]
): ContentCollection<TDefinition> {
  const map = new Map<TDefinition["id"], TDefinition>();

  for (const definition of definitions) {
    map.set(definition.id, definition);
  }

  return {
    all: definitions,
    map,
    get(id) {
      return map.get(id);
    },
    require(id) {
      const definition = map.get(id);

      if (definition === undefined) {
        throw new Error(`Missing ${categoryName} content definition: ${id}`);
      }

      return definition;
    },
    has(id) {
      return map.has(id);
    }
  };
}

export class ContentRegistry {
  public readonly origins: ContentCollection<OriginContentDefinition>;
  public readonly passives: ContentCollection<PassiveContentDefinition>;
  public readonly classes: ContentCollection<CharacterClassContentDefinition>;
  public readonly skills: ContentCollection<SkillContentDefinition>;
  public readonly enemies: ContentCollection<EnemyContentDefinition>;
  public readonly items: ContentCollection<ItemContentDefinition>;
  public readonly lootTables: ContentCollection<LootTableDefinition>;
  public readonly objectives: ContentCollection<ObjectiveContentDefinition>;
  public readonly zones: ContentCollection<ZoneContentDefinition>;
  public readonly levelTables: ContentCollection<LevelTableDefinition>;
  public readonly equipmentSlots: ContentCollection<EquipmentSlotContentDefinition>;
  public readonly spawnPoints: ContentCollection<SpawnPointContentDefinition>;
  public readonly worldProps: ContentCollection<WorldPropContentDefinition>;
  public readonly spawnZones: readonly SpawnZoneDefinition[];

  public constructor(input: ContentRegistryInput) {
    this.origins = createCollection("origin", input.origins);
    this.passives = createCollection("passive", input.passives);
    this.classes = createCollection("class", input.classes);
    this.skills = createCollection("skill", input.skills);
    this.enemies = createCollection("enemy", input.enemies);
    this.items = createCollection("item", input.items);
    this.lootTables = createCollection("loot table", input.lootTables);
    this.objectives = createCollection("objective", input.objectives);
    this.zones = createCollection("zone", input.zones);
    this.levelTables = createCollection("level table", input.levelTables);
    this.equipmentSlots = createCollection("equipment slot", input.equipmentSlots);
    this.spawnPoints = createCollection("spawn point", input.spawnPoints);
    this.worldProps = createCollection("world prop", input.worldProps);
    this.spawnZones = input.spawnZones;
  }
}

export const contentRegistry = new ContentRegistry({
  origins,
  passives,
  classes,
  skills,
  enemies,
  items,
  lootTables,
  objectives,
  zones,
  levelTables,
  equipmentSlots,
  spawnPoints,
  worldProps,
  spawnZones
});
