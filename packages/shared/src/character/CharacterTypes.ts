import type { CharacterDeathState } from "./DeathTypes";
import type { CharacterStats, StatModifier } from "./StatTypes";
import type { InventoryGrid, InventorySummaryItem } from "../inventory/InventoryTypes";
import type { EquipmentSlot } from "../inventory/EquipmentTypes";
import type { ItemCategory } from "../inventory/ItemTypes";
import type { CharacterId, IsoDateTimeString, ItemDefinitionId, ItemInstanceId, UserId, ZoneId } from "../ids";

export type CharacterName = string;

export type OriginKey = "sewer_dweller";
export type PassiveKey = "nightvision";
export type CharacterClassKey = "gravewalker";

export interface CreateCharacterPayload {
  readonly characterName: CharacterName;
  readonly originKey: OriginKey;
  readonly classKey: CharacterClassKey;
}

/**
 * Persisted equipped item snapshot exposed by `/me` character summaries.
 *
 * Reflects server-side state for a single equipped item instance; mirrors
 * the fields used by inventory summary items so account/session UI can
 * display persisted equipment without inventing client-side state.
 */
export interface EquippedItemSummary {
  readonly itemInstanceId: ItemInstanceId;
  readonly definitionId: ItemDefinitionId;
  readonly slot: EquipmentSlot;
  readonly label: string;
  readonly category: ItemCategory;
  readonly rarity?: string;
  readonly statModifiers?: readonly StatModifier[];
}

export interface CharacterSummary {
  readonly id: CharacterId;
  readonly ownerUserId: UserId;
  readonly characterName: CharacterName;
  readonly originKey: OriginKey;
  readonly classKey: CharacterClassKey;
  readonly level: number;
  readonly xp: number;
  readonly currentZoneId: ZoneId;
  readonly moneyCopper: number;
  readonly stats?: CharacterStats;
  readonly inventorySummaryItems?: readonly InventorySummaryItem[];
  readonly equippedItems?: readonly EquippedItemSummary[];
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
}

export interface CharacterDetails extends CharacterSummary {
  readonly passiveKeys: readonly PassiveKey[];
  readonly stats: CharacterStats;
  readonly inventory: InventoryGrid;
  readonly deathState: CharacterDeathState;
  readonly lastLocationZoneId?: ZoneId;
  readonly lastLocationX?: number;
  readonly lastLocationY?: number;
}
