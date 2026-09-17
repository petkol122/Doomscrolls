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
import { applyStackablePlacementPlan, planStackablePlacement, type StackablePlacementItem } from "./itemGridPlacement";

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

      // List existing inventory items -- topping up a matching stack
      // first, then finding a slot for overflow
      const existingItems = await txItemRepo.listInventoryItems(characterId);
      const stackableExistingItems: StackablePlacementItem[] = existingItems.map((item) => ({
        itemInstanceId: item.id,
        definitionId: item.definitionId as ItemDefinitionId,
        pageIndex: item.inventoryPage,
        x: item.inventoryX,
        y: item.inventoryY,
        quantity: item.quantity,
      }));

      const plan = planStackablePlacement(
        {
          pageCount: inventory.pageCount,
          gridWidth: inventory.gridWidth,
          gridHeight: inventory.gridHeight,
        },
        stackableExistingItems,
        itemDefinition,
        1,
      );

      if (plan === null) {
        return { ok: false as const, reason: "inventory_full" as const };
      }

      await applyStackablePlacementPlan(txItemRepo, plan, {
        definitionId: stockEntry.itemId,
        ownerCharacterId: characterId,
        locationType: ItemLocationType.INVENTORY,
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
