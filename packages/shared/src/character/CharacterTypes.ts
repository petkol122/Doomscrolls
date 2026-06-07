import type { CharacterDeathState } from "./DeathTypes";
import type { CharacterStats } from "./StatTypes";
import type { InventoryGrid, InventorySummaryItem } from "../inventory/InventoryTypes";
import type { CharacterId, IsoDateTimeString, UserId, ZoneId } from "../ids";

export type CharacterName = string;

export type OriginKey = "sewer_dweller";
export type PassiveKey = "nightvision";
export type CharacterClassKey = "gravewalker";

export interface CreateCharacterPayload {
  readonly characterName: CharacterName;
  readonly originKey: OriginKey;
  readonly classKey: CharacterClassKey;
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
  readonly stats?: CharacterStats;
  readonly inventorySummaryItems?: readonly InventorySummaryItem[];
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