/**
 * Task 319 — Vendor Foundation: Server-Authoritative Buy Item.
 *
 * Server-side buy handler that validates vendor existence, stock
 * membership, price, player currency and inventory space, then
 * atomically deducts copper and creates the inventory item.
 *
 * The client never decides the price, item id or inventory placement.
 */
import { contentRegistry } from "@doomscrolls/content";
import type { ItemDefinitionId, RequestBuyVendorItemRejectedReason } from "@doomscrolls/shared";
import { ItemLocationType, Prisma, type PrismaClient } from "@prisma/client";

import { CharacterRepository } from "../../persistence/repositories/CharacterRepository";
import { InventoryRepository } from "../../persistence/repositories/InventoryRepository";
import { ItemRepository } from "../../persistence/repositories/ItemRepository";
import { getSharedPrismaClient } from "../../persistence/prisma";

export type VendorBuyItemResult =
  | {
      readonly ok: true;
      readonly stockEntryId: string;
      readonly itemId: string;
      readonly priceCopper: number;
      readonly remainingCopper: number;
    }
  | {
      readonly ok: false;
      readonly reason: RequestBuyVendorItemRejectedReason;
    };

/**
 * Server-authoritative vendor buy handler.
 *
 * Validates all buy preconditions and atomically executes the purchase
 * inside a Prisma transaction: deduct copper, place item in inventory.
 */
export async function executeVendorBuyItem(input: {
  readonly characterId: string;
  readonly vendorId: string;
  readonly stockEntryId: string;
  readonly db?: PrismaClient;
}): Promise<VendorBuyItemResult> {
  const { characterId, vendorId, stockEntryId } = input;
  const db = input.db ?? getSharedPrismaClient();

  // 1. Validate vendor exists in town-service content
  const vendorService = contentRegistry.townServices.get(vendorId as never);
  if (vendorService === undefined || vendorService.serviceKind !== "vendor") {
    return { ok: false, reason: "vendor_unavailable" };
  }

  // 2. Validate stock entry exists and belongs to this vendor
  const stockEntry = contentRegistry.vendorStocks.get(stockEntryId as never);
  if (stockEntry === undefined || stockEntry.vendorId !== vendorId) {
    return { ok: false, reason: "invalid_stock_entry" };
  }

  // 3. Validate item definition exists in content
  const itemDefinition = contentRegistry.items.get(stockEntry.itemId);
  if (itemDefinition === undefined) {
    return { ok: false, reason: "item_unavailable" };
  }

  // 4. Validate price is positive
  if (!Number.isFinite(stockEntry.priceCopper) || stockEntry.priceCopper <= 0) {
    return { ok: false, reason: "item_unavailable" };
  }

  // 5. Read player copper (must have enough)
  const characterRepo = new CharacterRepository(db);
  const currentCopper = await characterRepo.getMoneyCopper(characterId);
  if (currentCopper === null || currentCopper < stockEntry.priceCopper) {
    return { ok: false, reason: "not_enough_currency" };
  }

  // 6. Atomically: deduct copper + place item in inventory
  try {
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const txCharacterRepo = new CharacterRepository(tx);
      const txInventoryRepo = new InventoryRepository(tx);
      const txItemRepo = new ItemRepository(tx);

      // Deduct copper inside transaction
      const newCopper = await txCharacterRepo.decrementMoneyCopper(characterId, stockEntry.priceCopper);
      if (newCopper === null) {
        return { ok: false as const, reason: "not_enough_currency" as const };
      }

      // Find inventory for item placement
      const inventory = await txInventoryRepo.findByCharacterId(characterId);
      if (inventory === null) {
        return { ok: false as const, reason: "inventory_full" as const };
      }

      // List existing inventory items for collision check
      const existingItems = await txItemRepo.listInventoryItems(characterId);
      const slot = findFirstAvailableInventorySlot(
        {
          pageCount: inventory.pageCount,
          gridWidth: inventory.gridWidth,
          gridHeight: inventory.gridHeight,
        },
        existingItems.map((item) => ({
          definitionId: item.definitionId as ItemDefinitionId,
          inventoryPage: item.inventoryPage,
          inventoryX: item.inventoryX,
          inventoryY: item.inventoryY,
        })),
        itemDefinition.size,
      );

      if (slot === null) {
        return { ok: false as const, reason: "inventory_full" as const };
      }

      // Create item instance in inventory
      await txItemRepo.createItemInstance({
        definitionId: stockEntry.itemId,
        ownerCharacterId: characterId,
        locationType: ItemLocationType.INVENTORY,
        inventoryPage: slot.pageIndex,
        inventoryX: slot.x,
        inventoryY: slot.y,
        quantity: 1,
        ...(itemDefinition.durabilityMax !== undefined
          ? {
              durabilityCurrent: itemDefinition.durabilityMax,
              durabilityMax: itemDefinition.durabilityMax,
            }
          : {}),
      });

      return {
        ok: true as const,
        stockEntryId,
        itemId: stockEntry.itemId,
        priceCopper: stockEntry.priceCopper,
        remainingCopper: newCopper,
      };
    });

    return result;
  } catch {
    return { ok: false, reason: "vendor_unavailable" };
  }
}

// ---------------------------------------------------------------------------
// Inventory slot placement (duplicated from pickupWorldLootInventory.ts
// to keep the room file thin; a shared helper can be extracted later)
// ---------------------------------------------------------------------------

function findFirstAvailableInventorySlot(
  config: {
    readonly pageCount: number;
    readonly gridWidth: number;
    readonly gridHeight: number;
  },
  existingItems: ReadonlyArray<{
    readonly definitionId: ItemDefinitionId;
    readonly inventoryPage: number | null;
    readonly inventoryX: number | null;
    readonly inventoryY: number | null;
  }>,
  targetSize: {
    readonly width: number;
    readonly height: number;
  },
): { readonly pageIndex: number; readonly x: number; readonly y: number } | null {
  for (let pageIndex = 0; pageIndex < config.pageCount; pageIndex += 1) {
    for (let y = 0; y <= config.gridHeight - targetSize.height; y += 1) {
      for (let x = 0; x <= config.gridWidth - targetSize.width; x += 1) {
        if (canPlaceItemAt(config, existingItems, pageIndex, x, y, targetSize)) {
          return { pageIndex, x, y };
        }
      }
    }
  }
  return null;
}

function canPlaceItemAt(
  config: {
    readonly gridWidth: number;
    readonly gridHeight: number;
  },
  existingItems: ReadonlyArray<{
    readonly definitionId: ItemDefinitionId;
    readonly inventoryPage: number | null;
    readonly inventoryX: number | null;
    readonly inventoryY: number | null;
  }>,
  pageIndex: number,
  x: number,
  y: number,
  targetSize: {
    readonly width: number;
    readonly height: number;
  },
): boolean {
  if (x < 0 || y < 0 || x + targetSize.width > config.gridWidth || y + targetSize.height > config.gridHeight) {
    return false;
  }

  for (const existingItem of existingItems) {
    if (
      existingItem.inventoryPage !== pageIndex ||
      existingItem.inventoryX === null ||
      existingItem.inventoryY === null
    ) {
      continue;
    }

    const existingDefinition = contentRegistry.items.get(existingItem.definitionId);
    if (existingDefinition === undefined) {
      continue;
    }

    if (
      rectanglesOverlap(
        { x, y, width: targetSize.width, height: targetSize.height },
        {
          x: existingItem.inventoryX,
          y: existingItem.inventoryY,
          width: existingDefinition.size.width,
          height: existingDefinition.size.height,
        },
      )
    ) {
      return false;
    }
  }

  return true;
}

function rectanglesOverlap(
  a: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  b: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}