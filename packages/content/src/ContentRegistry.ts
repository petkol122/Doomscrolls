import { affixes } from "./data/affixes";
import { areas } from "./data/areas";
import { classes } from "./data/classes";
import { continents } from "./data/continents";
import { currencies } from "./data/currencies";
import { enemies } from "./data/enemies";
import { equipmentSlots } from "./data/equipmentSlots";
import { items } from "./data/items";
import { levelTables } from "./data/levelTables";
import { lootTables } from "./data/lootTables";
import { lore } from "./data/lore";
import { objectives } from "./data/objectives";
import { quests } from "./data/quests";
import { origins } from "./data/origins";
import { passives } from "./data/passives";
import { professions } from "./data/professions";
import { skills } from "./data/skills";
import { spawnPoints } from "./data/spawnPoints";
import { vendorStocks } from "./data/vendorStocks";
import { townServices } from "./data/townServices";
import { worldProps } from "./data/worldProps";
import { spawnZones } from "./data/spawnZones";
import { visualAssets } from "./data/visualAssets";
import { worlds } from "./data/worlds";
import { zones } from "./data/zones";
import type {
  AffixContentDefinition,
  AreaContentDefinition,
  CharacterClassContentDefinition,
  ContinentContentDefinition,
  CurrencyContentDefinition,
  EnemyContentDefinition,
  EquipmentSlotContentDefinition,
  ItemContentDefinition,
  LevelTableDefinition,
  LootTableDefinition,
  ObjectiveContentDefinition,
  QuestContentDefinition,
  OriginContentDefinition,
  PassiveContentDefinition,
  ProfessionContentDefinition,
  SkillContentDefinition,
  SpawnPointContentDefinition,
  TownServiceContentDefinition,
  VendorStockEntryDefinition,
  WorldContentDefinition,
  WorldPropContentDefinition,
  VisualAssetContentDefinition,
  SpawnZoneDefinition,
  ZoneContentDefinition
} from "./data/types";
import type { LoreEntryContentDefinition } from "./data/lore";

export interface ContentCollection<TDefinition extends { readonly id: string }> {
  readonly all: readonly TDefinition[];
  readonly map: ReadonlyMap<TDefinition["id"], TDefinition>;
  get(id: TDefinition["id"]): TDefinition | undefined;
  require(id: TDefinition["id"]): TDefinition;
  has(id: TDefinition["id"]): boolean;
}

export interface ContentRegistryInput {
  readonly affixes: readonly AffixContentDefinition[];
  readonly origins: readonly OriginContentDefinition[];
  readonly passives: readonly PassiveContentDefinition[];
  readonly professions: readonly ProfessionContentDefinition[];
  readonly classes: readonly CharacterClassContentDefinition[];
  readonly currencies: readonly CurrencyContentDefinition[];
  readonly skills: readonly SkillContentDefinition[];
  readonly enemies: readonly EnemyContentDefinition[];
  readonly items: readonly ItemContentDefinition[];
  readonly lootTables: readonly LootTableDefinition[];
  readonly objectives: readonly ObjectiveContentDefinition[];
  readonly quests: readonly QuestContentDefinition[];
  readonly zones: readonly ZoneContentDefinition[];
  readonly levelTables: readonly LevelTableDefinition[];
  readonly equipmentSlots: readonly EquipmentSlotContentDefinition[];
  readonly spawnPoints: readonly SpawnPointContentDefinition[];
  readonly worldProps: readonly WorldPropContentDefinition[];
  readonly visualAssets: readonly VisualAssetContentDefinition[];
  readonly spawnZones: readonly SpawnZoneDefinition[];
  readonly vendorStocks: readonly VendorStockEntryDefinition[];
  readonly townServices: readonly TownServiceContentDefinition[];
  readonly lore: readonly LoreEntryContentDefinition[];
  readonly worlds: readonly WorldContentDefinition[];
  readonly continents: readonly ContinentContentDefinition[];
  readonly areas: readonly AreaContentDefinition[];
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
  public readonly affixes: ContentCollection<AffixContentDefinition>;
  public readonly origins: ContentCollection<OriginContentDefinition>;
  public readonly passives: ContentCollection<PassiveContentDefinition>;
  public readonly professions: ContentCollection<ProfessionContentDefinition>;
  public readonly classes: ContentCollection<CharacterClassContentDefinition>;
  public readonly currencies: ContentCollection<CurrencyContentDefinition>;
  public readonly skills: ContentCollection<SkillContentDefinition>;
  public readonly enemies: ContentCollection<EnemyContentDefinition>;
  public readonly items: ContentCollection<ItemContentDefinition>;
  public readonly lootTables: ContentCollection<LootTableDefinition>;
  public readonly objectives: ContentCollection<ObjectiveContentDefinition>;
  public readonly quests: ContentCollection<QuestContentDefinition>;
  public readonly zones: ContentCollection<ZoneContentDefinition>;
  public readonly levelTables: ContentCollection<LevelTableDefinition>;
  public readonly equipmentSlots: ContentCollection<EquipmentSlotContentDefinition>;
  public readonly spawnPoints: ContentCollection<SpawnPointContentDefinition>;
  public readonly worldProps: ContentCollection<WorldPropContentDefinition>;
  public readonly visualAssets: ContentCollection<VisualAssetContentDefinition>;
  public readonly spawnZones: readonly SpawnZoneDefinition[];
  public readonly vendorStocks: ContentCollection<VendorStockEntryDefinition>;
  public readonly townServices: ContentCollection<TownServiceContentDefinition>;
  public readonly lore: ContentCollection<LoreEntryContentDefinition>;
  public readonly worlds: ContentCollection<WorldContentDefinition>;
  public readonly continents: ContentCollection<ContinentContentDefinition>;
  public readonly areas: ContentCollection<AreaContentDefinition>;

  public constructor(input: ContentRegistryInput) {
    this.affixes = createCollection("affix", input.affixes);
    this.origins = createCollection("origin", input.origins);
    this.passives = createCollection("passive", input.passives);
    this.professions = createCollection("profession", input.professions);
    this.classes = createCollection("class", input.classes);
    this.currencies = createCollection("currency", input.currencies);
    this.skills = createCollection("skill", input.skills);
    this.enemies = createCollection("enemy", input.enemies);
    this.items = createCollection("item", input.items);
    this.lootTables = createCollection("loot table", input.lootTables);
    this.objectives = createCollection("objective", input.objectives);
    this.quests = createCollection("quest", input.quests);
    this.zones = createCollection("zone", input.zones);
    this.levelTables = createCollection("level table", input.levelTables);
    this.equipmentSlots = createCollection("equipment slot", input.equipmentSlots);
    this.spawnPoints = createCollection("spawn point", input.spawnPoints);
    this.worldProps = createCollection("world prop", input.worldProps);
    this.visualAssets = createCollection("visual asset", input.visualAssets);
    this.spawnZones = input.spawnZones;
    this.vendorStocks = createCollection("vendor stock", input.vendorStocks);
    this.townServices = createCollection("town service", input.townServices);
    this.lore = createCollection("lore", input.lore);
    this.worlds = createCollection("world", input.worlds);
    this.continents = createCollection("continent", input.continents);
    this.areas = createCollection("area", input.areas);
  }
}

export const contentRegistry = new ContentRegistry({
  affixes,
  origins,
  passives,
  professions,
  classes,
  currencies,
  skills,
  enemies,
  items,
  lootTables,
  objectives,
  quests,
  zones,
  levelTables,
  equipmentSlots,
  spawnPoints,
  worldProps,
  visualAssets,
  spawnZones,
  vendorStocks,
  townServices,
  lore,
  worlds,
  continents,
  areas
});
