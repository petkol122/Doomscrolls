import type { CharacterId, ItemInstanceId } from "../ids";

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

export interface InventoryGrid {
  readonly characterId: CharacterId;
  readonly config: InventoryGridConfig;
  readonly items: readonly InventoryGridItem[];
}

export interface MoveInventoryItemPayload {
  readonly itemInstanceId: ItemInstanceId;
  readonly targetPageIndex: number;
  readonly targetX: number;
  readonly targetY: number;
}