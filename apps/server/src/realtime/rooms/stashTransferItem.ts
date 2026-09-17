import { contentRegistry } from "@doomscrolls/content";
import type { ItemDefinitionId, ItemInstance } from "@doomscrolls/shared";
import { ItemLocationType, Prisma, type PrismaClient } from "@prisma/client";

import { toItemInstanceDto } from "../../persistence/mappers/itemMapper";
import { InventoryRepository } from "../../persistence/repositories/InventoryRepository";
import { ItemRepository } from "../../persistence/repositories/ItemRepository";
import { getSharedPrismaClient } from "../../persistence/prisma";
import { canPlaceItemAt, findFirstAvailableSlot, type PlacementItem } from "./itemGridPlacement";

const STASH_SERVICE_ID = "nightmarket_stash_keeper";
const STASH_PAGE_COUNT = 1;
const STASH_GRID_WIDTH = 10;
const STASH_GRID_HEIGHT = 12;

export type StoreInventoryItemInStashResult =
  | { readonly ok: true; readonly itemInstanceId: string; readonly stashItems: readonly ItemInstance[] }
  | { readonly ok: false; readonly reason: import("@doomscrolls/shared").RequestStoreInventoryItemInStashRejectedReason };

export type TakeStashItemToInventoryResult =
  | { readonly ok: true; readonly itemInstanceId: string; readonly stashItems: readonly ItemInstance[] }
  | { readonly ok: false; readonly reason: import("@doomscrolls/shared").RequestTakeStashItemToInventoryRejectedReason };

function toDtoItems(items: Awaited<ReturnType<ItemRepository["listStashItems"]>>): readonly ItemInstance[] {
  return items.map((item) => toItemInstanceDto(item));
}

export async function executeStoreInventoryItemInStash(input: {
  readonly characterId: string;
  readonly serviceId: string;
  readonly itemInstanceId: string;
  readonly pageIndex?: number;
  readonly x?: number;
  readonly y?: number;
  readonly db?: PrismaClient;
}): Promise<StoreInventoryItemInStashResult> {
  if (input.serviceId !== STASH_SERVICE_ID) {
    return { ok: false, reason: "stash_unavailable" };
  }

  const db = input.db ?? getSharedPrismaClient();
  const itemRepo = new ItemRepository(db);
  const item = await itemRepo.findByIdForCharacter(input.itemInstanceId, input.characterId);
  if (item === null) {
    return { ok: false, reason: "item_not_owned" };
  }
  if (item.locationType === ItemLocationType.EQUIPMENT) {
    return { ok: false, reason: "item_equipped" };
  }
  if (item.locationType !== ItemLocationType.INVENTORY) {
    return { ok: false, reason: "item_not_in_inventory" };
  }

  const itemDefinition = contentRegistry.items.get(item.definitionId as never);
  if (itemDefinition === undefined) {
    return { ok: false, reason: "item_unavailable" };
  }

  try {
    return await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const txItemRepo = new ItemRepository(tx);
      const stashItems = await txItemRepo.listStashItems(input.characterId);
      const existingItems: PlacementItem[] = stashItems
        .filter((stashItem) => stashItem.id !== input.itemInstanceId)
        .map((stashItem) => ({
          definitionId: stashItem.definitionId as ItemDefinitionId,
          pageIndex: stashItem.stashPage,
          x: stashItem.stashX,
          y: stashItem.stashY,
        }));

      const explicitPlacement =
        Number.isFinite(input.pageIndex) && Number.isFinite(input.x) && Number.isFinite(input.y)
          ? { pageIndex: Math.floor(input.pageIndex ?? 0), x: Math.floor(input.x ?? 0), y: Math.floor(input.y ?? 0) }
          : null;

      const slot = explicitPlacement !== null
        ? (canPlaceItemAt(
            { pageCount: STASH_PAGE_COUNT, gridWidth: STASH_GRID_WIDTH, gridHeight: STASH_GRID_HEIGHT },
            existingItems,
            explicitPlacement.pageIndex,
            explicitPlacement.x,
            explicitPlacement.y,
            itemDefinition.size,
          )
            ? explicitPlacement
            : null)
        : findFirstAvailableSlot(
            { pageCount: STASH_PAGE_COUNT, gridWidth: STASH_GRID_WIDTH, gridHeight: STASH_GRID_HEIGHT },
            existingItems,
            itemDefinition.size,
          );

      if (explicitPlacement !== null && slot === null) {
        return { ok: false as const, reason: "invalid_stash_placement" as const };
      }
      if (slot === null) {
        return { ok: false as const, reason: "stash_full" as const };
      }

      await txItemRepo.updateItemLocation(input.itemInstanceId, {
        ownerCharacterId: input.characterId,
        locationType: ItemLocationType.STASH,
        inventoryPage: null,
        inventoryX: null,
        inventoryY: null,
        stashPage: slot.pageIndex,
        stashX: slot.x,
        stashY: slot.y,
        equipmentSlot: null,
        roomId: null,
        zoneId: null,
        positionX: null,
        positionY: null,
        corpseId: null,
      });

      const updatedStashItems = await txItemRepo.listStashItems(input.characterId);
      return { ok: true as const, itemInstanceId: input.itemInstanceId, stashItems: toDtoItems(updatedStashItems) };
    });
  } catch {
    return { ok: false, reason: "stash_unavailable" };
  }
}

export async function executeTakeStashItemToInventory(input: {
  readonly characterId: string;
  readonly serviceId: string;
  readonly itemInstanceId: string;
  readonly db?: PrismaClient;
}): Promise<TakeStashItemToInventoryResult> {
  if (input.serviceId !== STASH_SERVICE_ID) {
    return { ok: false, reason: "stash_unavailable" };
  }

  const db = input.db ?? getSharedPrismaClient();
  const itemRepo = new ItemRepository(db);
  const item = await itemRepo.findByIdForCharacter(input.itemInstanceId, input.characterId);
  if (item === null) {
    return { ok: false, reason: "item_not_owned" };
  }
  if (item.locationType !== ItemLocationType.STASH) {
    return { ok: false, reason: "item_not_in_stash" };
  }

  const itemDefinition = contentRegistry.items.get(item.definitionId as never);
  if (itemDefinition === undefined) {
    return { ok: false, reason: "item_unavailable" };
  }

  try {
    return await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const txItemRepo = new ItemRepository(tx);
      const txInventoryRepo = new InventoryRepository(tx);
      const inventory = await txInventoryRepo.findByCharacterId(input.characterId);
      if (inventory === null) {
        return { ok: false as const, reason: "inventory_full" as const };
      }
      const inventoryItems = await txItemRepo.listInventoryItems(input.characterId);
      const slot = findFirstAvailableSlot(
        { pageCount: inventory.pageCount, gridWidth: inventory.gridWidth, gridHeight: inventory.gridHeight },
        inventoryItems.map((inventoryItem) => ({
          definitionId: inventoryItem.definitionId as ItemDefinitionId,
          pageIndex: inventoryItem.inventoryPage,
          x: inventoryItem.inventoryX,
          y: inventoryItem.inventoryY,
        })),
        itemDefinition.size,
      );
      if (slot === null) {
        return { ok: false as const, reason: "inventory_full" as const };
      }

      await txItemRepo.updateItemLocation(input.itemInstanceId, {
        ownerCharacterId: input.characterId,
        locationType: ItemLocationType.INVENTORY,
        inventoryPage: slot.pageIndex,
        inventoryX: slot.x,
        inventoryY: slot.y,
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

      const updatedStashItems = await txItemRepo.listStashItems(input.characterId);
      return { ok: true as const, itemInstanceId: input.itemInstanceId, stashItems: toDtoItems(updatedStashItems) };
    });
  } catch {
    return { ok: false, reason: "stash_unavailable" };
  }
}