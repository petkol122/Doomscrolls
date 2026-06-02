import type { CharacterId, InventoryGrid, InventoryGridItem, ItemInstanceId } from "@doomscrolls/shared";
import type { Inventory, ItemInstance } from "@prisma/client";

export function toInventoryGridItemDto(item: Pick<ItemInstance, "id" | "inventoryPage" | "inventoryX" | "inventoryY">): InventoryGridItem {
  if (item.inventoryPage === null || item.inventoryX === null || item.inventoryY === null) {
    throw new Error("Cannot map inventory item without inventory coordinates");
  }

  return {
    itemInstanceId: item.id as ItemInstanceId,
    pageIndex: item.inventoryPage,
    x: item.inventoryX,
    y: item.inventoryY,
  };
}

export function toInventoryDto(inventory: Inventory, items: readonly ItemInstance[] = []): InventoryGrid {
  return {
    characterId: inventory.characterId as CharacterId,
    config: {
      pageCount: inventory.pageCount,
      gridWidth: inventory.gridWidth,
      gridHeight: inventory.gridHeight,
    },
    items: items.map(toInventoryGridItemDto),
  };
}