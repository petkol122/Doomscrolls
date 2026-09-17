import { contentRegistry } from "@doomscrolls/content";
import type { ItemDefinitionId, MoveInventoryItemRejectedReason } from "@doomscrolls/shared";
import { ItemLocationType, type PrismaClient } from "@prisma/client";

import { InventoryRepository } from "../../persistence/repositories/InventoryRepository";
import { ItemRepository } from "../../persistence/repositories/ItemRepository";
import { getSharedPrismaClient } from "../../persistence/prisma";
import { canPlaceItemAt, type PlacementItem } from "./itemGridPlacement";

/**
 * Milestone 0.2 — Inventory Grid Repositioning. Server-authoritative
 * `move_inventory_item`: moves an already-owned inventory item to a new
 * page/x/y within the character's own inventory grid, validating the
 * target slot is in-bounds and doesn't overlap any other item (the same
 * rectangle-packing rule the stash transfer flow uses).
 */
export type MoveInventoryItemResult =
  | { readonly ok: true; readonly itemInstanceId: string }
  | { readonly ok: false; readonly reason: MoveInventoryItemRejectedReason };

export async function executeMoveInventoryItem(input: {
  readonly characterId: string;
  readonly itemInstanceId: string;
  readonly targetPageIndex: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly db?: PrismaClient;
}): Promise<MoveInventoryItemResult> {
  const db = input.db ?? getSharedPrismaClient();
  const itemRepo = new ItemRepository(db);
  const item = await itemRepo.findByIdForCharacter(input.itemInstanceId, input.characterId);
  if (item === null) {
    return { ok: false, reason: "item_not_owned" };
  }
  if (item.locationType !== ItemLocationType.INVENTORY) {
    return { ok: false, reason: "item_not_in_inventory" };
  }

  const itemDefinition = contentRegistry.items.get(item.definitionId as never);
  if (itemDefinition === undefined) {
    return { ok: false, reason: "item_unavailable" };
  }

  const inventoryRepo = new InventoryRepository(db);
  const inventory = await inventoryRepo.findByCharacterId(input.characterId);
  if (inventory === null) {
    return { ok: false, reason: "invalid_placement" };
  }

  const inventoryItems = await itemRepo.listInventoryItems(input.characterId);
  const otherItems: PlacementItem[] = inventoryItems
    .filter((existing) => existing.id !== input.itemInstanceId)
    .map((existing) => ({
      definitionId: existing.definitionId as ItemDefinitionId,
      pageIndex: existing.inventoryPage,
      x: existing.inventoryX,
      y: existing.inventoryY,
    }));

  const targetPageIndex = Math.floor(input.targetPageIndex);
  const targetX = Math.floor(input.targetX);
  const targetY = Math.floor(input.targetY);

  const fits = canPlaceItemAt(
    { pageCount: inventory.pageCount, gridWidth: inventory.gridWidth, gridHeight: inventory.gridHeight },
    otherItems,
    targetPageIndex,
    targetX,
    targetY,
    itemDefinition.size,
  );
  if (!fits) {
    return { ok: false, reason: "invalid_placement" };
  }

  await itemRepo.updateItemLocation(input.itemInstanceId, {
    ownerCharacterId: input.characterId,
    locationType: ItemLocationType.INVENTORY,
    inventoryPage: targetPageIndex,
    inventoryX: targetX,
    inventoryY: targetY,
    stashPage: null,
    stashX: null,
    stashY: null,
    equipmentSlot: null,
    roomId: null,
    zoneId: null,
    positionX: null,
    positionY: null,
    corpseId: null,
  });

  return { ok: true, itemInstanceId: input.itemInstanceId };
}
