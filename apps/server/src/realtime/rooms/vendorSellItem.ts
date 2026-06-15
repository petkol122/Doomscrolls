/**
 * Task 320 — Vendor Foundation: Server-Authoritative Sell Item.
 *
 * Server-side sell handler that validates vendor existence, item
 * ownership, equipment state, sellability and price, then
 * atomically deletes the item and awards copper.
 *
 * The client never decides the sell price.
 */
import { contentRegistry } from "@doomscrolls/content";
import type { RequestSellItemRejectedReason } from "@doomscrolls/shared";
import { ItemLocationType, Prisma } from "@prisma/client";

import { CharacterRepository } from "../../persistence/repositories/CharacterRepository";
import { ItemRepository } from "../../persistence/repositories/ItemRepository";
import { prisma } from "../../persistence/prisma";

/**
 * Sell price ratio: the player receives 50 % of the vendor buy price
 * when selling an item that appears in a vendor stock list. Items that
 * do not appear in any vendor stock list sell for a fallback of 1 copper.
 */
const SELL_PRICE_RATIO = 0.5;
const MIN_SELL_PRICE = 1;

export type VendorSellItemResult =
  | {
      readonly ok: true;
      readonly itemInstanceId: string;
      readonly definitionId: string;
      readonly sellPriceCopper: number;
      readonly remainingCopper: number;
    }
  | {
      readonly ok: false;
      readonly reason: RequestSellItemRejectedReason;
    };

/**
 * Compute the server-authoritative sell price for an item definition.
 *
 * Looks up the first matching vendor stock entry and returns 50 % of
 * that price (minimum 1 copper). Items not in any stock list sell for
 * the minimum fallback.
 */
function computeSellPrice(definitionId: string): number {
  const stockEntries = contentRegistry.vendorStocks.all;
  for (const entry of stockEntries) {
    if (entry.itemId === definitionId) {
      const raw = Math.floor(entry.priceCopper * SELL_PRICE_RATIO);
      return Math.max(MIN_SELL_PRICE, raw);
    }
  }
  return MIN_SELL_PRICE;
}

/**
 * Server-authoritative vendor sell handler.
 *
 * Validates all sell preconditions and atomically executes the sale
 * inside a Prisma transaction: delete item, add copper.
 */
export async function executeVendorSellItem(input: {
  readonly characterId: string;
  readonly vendorId: string;
  readonly itemInstanceId: string;
}): Promise<VendorSellItemResult> {
  const { characterId, vendorId, itemInstanceId } = input;

  // 1. Validate vendor exists in town-service content
  const vendorService = contentRegistry.townServices.get(vendorId as never);
  if (vendorService === undefined || vendorService.serviceKind !== "vendor") {
    return { ok: false, reason: "vendor_unavailable" };
  }

  // 2. Load item instance owned by this character
  const itemRepo = new ItemRepository();
  const item = await itemRepo.findByIdForCharacter(itemInstanceId, characterId);
  if (item === null) {
    return { ok: false, reason: "item_not_owned" };
  }

  // 3. Item must be in inventory (not equipped, not in world, etc.)
  if (item.locationType !== ItemLocationType.INVENTORY) {
    return { ok: false, reason: "item_equipped" };
  }

  // 4. Validate item definition exists in content
  const itemDefinition = contentRegistry.items.get(item.definitionId as never);
  if (itemDefinition === undefined) {
    return { ok: false, reason: "item_not_sellable" };
  }

  // 5. Compute server-authoritative sell price
  const sellPriceCopper = computeSellPrice(item.definitionId);
  if (!Number.isFinite(sellPriceCopper) || sellPriceCopper < MIN_SELL_PRICE) {
    return { ok: false, reason: "invalid_price" };
  }

  // 6. Atomically: delete item + add copper
  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const txCharacterRepo = new CharacterRepository(tx);
      const txItemRepo = new ItemRepository(tx);

      // Delete the sold item
      await txItemRepo.deleteItemInstance(itemInstanceId);

      // Add copper
      const newCopper = await txCharacterRepo.incrementMoneyCopper(characterId, sellPriceCopper);
      if (newCopper === null) {
        // Character disappeared mid-transaction; this should not happen
        // in normal operation. The item is already deleted, so we report
        // the sell as failed with invalid_price to avoid copper duplication.
        return { ok: false as const, reason: "invalid_price" as const };
      }

      return {
        ok: true as const,
        itemInstanceId,
        definitionId: item.definitionId,
        sellPriceCopper,
        remainingCopper: newCopper,
      };
    });

    return result;
  } catch {
    return { ok: false, reason: "vendor_unavailable" };
  }
}