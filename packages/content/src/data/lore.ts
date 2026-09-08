import type { CharacterClassKey, OriginKey } from "@doomscrolls/shared";
import type { ContentLocalizationKey, EnemyId, ZoneContentId } from "./types";

/**
 * Extended flavor text, keyed to a real existing content ID. This is a
 * secondary, optional layer on top of a definition's own nameKey/
 * descriptionKey -- not every class/origin/zone/enemy needs an entry.
 * Not wired into any UI yet; that's a future decision once there's
 * enough lore to justify a surface for it.
 */
export interface LoreEntryBase {
  readonly id: string;
  readonly titleKey: ContentLocalizationKey;
  readonly bodyKey: ContentLocalizationKey;
}

export interface ClassLoreEntryDefinition extends LoreEntryBase {
  readonly targetKind: "class";
  readonly targetId: CharacterClassKey;
}

export interface OriginLoreEntryDefinition extends LoreEntryBase {
  readonly targetKind: "origin";
  readonly targetId: OriginKey;
}

export interface ZoneLoreEntryDefinition extends LoreEntryBase {
  readonly targetKind: "zone";
  readonly targetId: ZoneContentId;
}

export interface EnemyLoreEntryDefinition extends LoreEntryBase {
  readonly targetKind: "enemy";
  readonly targetId: EnemyId;
}

export type LoreEntryContentDefinition =
  | ClassLoreEntryDefinition
  | OriginLoreEntryDefinition
  | ZoneLoreEntryDefinition
  | EnemyLoreEntryDefinition;

export const lore = [
  {
    id: "origin_sewer_dweller",
    targetKind: "origin",
    targetId: "sewer_dweller",
    titleKey: "lore.origin_sewer_dweller.title",
    bodyKey: "lore.origin_sewer_dweller.body"
  },
  {
    id: "class_gravewalker",
    targetKind: "class",
    targetId: "gravewalker",
    titleKey: "lore.class_gravewalker.title",
    bodyKey: "lore.class_gravewalker.body"
  },
  {
    id: "class_ironclad",
    targetKind: "class",
    targetId: "ironclad",
    titleKey: "lore.class_ironclad.title",
    bodyKey: "lore.class_ironclad.body"
  },
  {
    id: "zone_blackwire_sewers",
    targetKind: "zone",
    targetId: "blackwire_sewers",
    titleKey: "lore.zone_blackwire_sewers.title",
    bodyKey: "lore.zone_blackwire_sewers.body"
  },
  {
    id: "zone_static_yard",
    targetKind: "zone",
    targetId: "static_yard",
    titleKey: "lore.zone_static_yard.title",
    bodyKey: "lore.zone_static_yard.body"
  },
  {
    id: "zone_cinderworks",
    targetKind: "zone",
    targetId: "cinderworks",
    titleKey: "lore.zone_cinderworks.title",
    bodyKey: "lore.zone_cinderworks.body"
  },
  {
    id: "zone_saltmere_docks",
    targetKind: "zone",
    targetId: "saltmere_docks",
    titleKey: "lore.zone_saltmere_docks.title",
    bodyKey: "lore.zone_saltmere_docks.body"
  },
  {
    id: "enemy_trashboar_brute",
    targetKind: "enemy",
    targetId: "trashboar_brute",
    titleKey: "lore.enemy_trashboar_brute.title",
    bodyKey: "lore.enemy_trashboar_brute.body"
  },
  {
    id: "enemy_foundry_warden",
    targetKind: "enemy",
    targetId: "foundry_warden",
    titleKey: "lore.enemy_foundry_warden.title",
    bodyKey: "lore.enemy_foundry_warden.body"
  },
  {
    id: "enemy_arc_sentinel",
    targetKind: "enemy",
    targetId: "arc_sentinel",
    titleKey: "lore.enemy_arc_sentinel.title",
    bodyKey: "lore.enemy_arc_sentinel.body"
  },
  {
    id: "enemy_drowned_hauler",
    targetKind: "enemy",
    targetId: "drowned_hauler",
    titleKey: "lore.enemy_drowned_hauler.title",
    bodyKey: "lore.enemy_drowned_hauler.body"
  }
] as const satisfies readonly LoreEntryContentDefinition[];
