import type { StatModifier } from "../character/StatTypes";
import type { EquipmentSlot } from "./EquipmentTypes";
import type { ItemCategory } from "./ItemTypes";
import type { CharacterId, ItemDefinitionId, ItemInstanceId } from "../ids";

export interface InventoryGridConfig {
  readonly pageCount: number;
  readonly gridWidth: number;
  readonly gridHeight: number;
}

export const DEFAULT_INVENTORY_GRID_CONFIG: InventoryGridConfig = {
  pageCount: 1,
  gridWidth: 10,
  gridHeight: 6,
};

export interface InventoryGridItem {
  readonly itemInstanceId: ItemInstanceId;
  readonly pageIndex: number;
  readonly x: number;
  readonly y: number;
}

export interface InventorySummaryItem extends InventoryGridItem {
  readonly label: string;
  readonly definitionId: ItemDefinitionId;
  readonly category: ItemCategory;
  readonly rarity?: string;
  readonly allowedEquipmentSlots?: readonly EquipmentSlot[];
  readonly size?: {
    readonly width: number;
    readonly height: number;
  };
  readonly statModifiers?: readonly StatModifier[];
  /** Milestone 0.3 -- localized names of any affixes rolled onto this
   *  specific item instance (see `affixRollEngine.ts`), for display
   *  alongside `statModifiers` -- empty/absent for a "normal" instance. */
  readonly affixNames?: readonly string[];
  /** Milestone 0.3 -- Stackable Item Quantities. How many units this
   *  instance represents; always present (defaults to 1 for non-stackable
   *  items) so the client can render a quantity badge/tooltip line
   *  uniformly instead of treating `undefined` as a special case. */
  readonly quantity: number;
}

export interface InventoryGrid {
  readonly characterId: CharacterId;
  readonly config: InventoryGridConfig;
  readonly items: readonly InventorySummaryItem[];
}

export interface MoveInventoryItemPayload {
  readonly itemInstanceId: ItemInstanceId;
  readonly targetPageIndex: number;
  readonly targetX: number;
  readonly targetY: number;
}

/**
 * Milestone 0.2 — Inventory Grid Repositioning. Safe, server-owned
 * rejection reasons for `move_inventory_item`.
 */
export type MoveInventoryItemRejectedReason =
  | "item_unavailable"
  | "item_not_owned"
  | "item_not_in_inventory"
  | "invalid_placement";