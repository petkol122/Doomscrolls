import type { CharacterClassKey, OriginKey, PassiveKey } from "../character/CharacterTypes";
import type { PrimaryStats, StatModifier } from "../character/StatTypes";
import type { ItemDefinition } from "../inventory/ItemTypes";
import type { ContentId, ZoneId } from "../ids";

export type ContentDefinitionType = "origin" | "passive" | "class" | "enemy" | "item" | "zone";

export interface ContentDefinitionBase {
  readonly id: ContentId;
  readonly key: string;
  readonly type: ContentDefinitionType;
  readonly displayName: string;
  readonly description: string;
}

export interface OriginDefinition extends ContentDefinitionBase {
  readonly type: "origin";
  readonly key: OriginKey;
  readonly grantedPassiveKeys: readonly PassiveKey[];
}

export interface PassiveDefinition extends ContentDefinitionBase {
  readonly type: "passive";
  readonly key: PassiveKey;
  readonly statModifiers: readonly StatModifier[];
}

export interface ClassDefinition extends ContentDefinitionBase {
  readonly type: "class";
  readonly key: CharacterClassKey;
  readonly baseStats: PrimaryStats;
}

export interface EnemyDefinition extends ContentDefinitionBase {
  readonly type: "enemy";
  readonly baseStats: PrimaryStats;
  readonly level: number;
}

export interface ZoneDefinition extends ContentDefinitionBase {
  readonly type: "zone";
  readonly zoneId: ZoneId;
  readonly roomKind: "town" | "combat";
}

export type ContentDefinition =
  | OriginDefinition
  | PassiveDefinition
  | ClassDefinition
  | EnemyDefinition
  | ItemDefinition
  | ZoneDefinition;

export interface ContentManifest {
  readonly origins: readonly OriginDefinition[];
  readonly passives: readonly PassiveDefinition[];
  readonly classes: readonly ClassDefinition[];
  readonly enemies: readonly EnemyDefinition[];
  readonly items: readonly ItemDefinition[];
  readonly zones: readonly ZoneDefinition[];
}