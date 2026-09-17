import type { CharacterDeathState } from "./DeathTypes";
import type { CharacterStats, StatModifier } from "./StatTypes";
import type { InventoryGrid, InventorySummaryItem } from "../inventory/InventoryTypes";
import type { EquipmentSlot } from "../inventory/EquipmentTypes";
import type { ItemCategory } from "../inventory/ItemTypes";
import type { CharacterId, IsoDateTimeString, ItemDefinitionId, ItemInstanceId, UserId, ZoneId } from "../ids";
import type { CharacterWallet } from "../economy/CurrencyTypes";
import type { MaterialBalances } from "../economy/MaterialTypes";
import type { ProfessionTiers } from "../profession/ProfessionTypes";

export type CharacterName = string;

export type OriginKey = "sewer_dweller";
export type PassiveKey = "nightvision";
export type CharacterClassKey = "gravewalker" | "ironclad" | "netrunner" | "street_alchemist";

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
  /** Milestone 0.3 -- localized names of any affixes rolled onto this
   *  specific item instance (see `affixRollEngine.ts`), for display
   *  alongside `statModifiers` -- empty/absent for a "normal" instance. */
  readonly affixNames?: readonly string[];
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
  /** @deprecated Use `wallet.balances.czk` -- kept for existing display code, always mirrors it. */
  readonly moneyCopper: number;
  /** Milestone 0.3 -- Multi-Currency Wallet Engine. Per-currency balances; `balances.czk` mirrors `moneyCopper`. */
  readonly wallet: CharacterWallet;
  /** Milestone 0.3 -- CZK-equivalent Net Worth (cash + equipped item value), see `calculatePlayerNetWorth`. */
  readonly netWorth?: number;
  /** Salvage-material currency balances (Iron Scrap / Arcane Dust), see `MaterialTypes.ts`. */
  readonly materialBalances: MaterialBalances;
  readonly stats?: CharacterStats;
  readonly inventorySummaryItems?: readonly InventorySummaryItem[];
  readonly equippedItems?: readonly EquippedItemSummary[];
  /** Milestone 0.3 -- Profession Training System. Tier reached per profession id. */
  readonly professions?: ProfessionTiers;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
}

export type CharacterRuntimeRoomKind = "town" | "combat";

export interface CharacterDetails extends CharacterSummary {
  readonly passiveKeys: readonly PassiveKey[];
  readonly stats: CharacterStats;
  readonly inventory: InventoryGrid;
  readonly deathState: CharacterDeathState;
  readonly lastLocationZoneId?: ZoneId;
  readonly lastLocationX?: number;
  readonly lastLocationY?: number;
  /**
   * Core 0.1 Foundation — Skill Point Allocation. Unallocated points
   * gained (1 per level) that the player can spend on the skill panel,
   * plus the persisted rank of each of their class's three skill slots.
   * Every skill starts at rank 1 (already castable); points raise a
   * slot's rank up to that skill's content-defined `maxRank`.
   */
  readonly skillPoints: number;
  readonly primarySkillRank: number;
  readonly secondarySkillRank: number;
  readonly tertiarySkillRank: number;
  /** Milestone 0.3 -- Profession Training System. Tier reached per profession id. */
  readonly professions: ProfessionTiers;
}
