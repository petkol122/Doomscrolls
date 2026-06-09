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