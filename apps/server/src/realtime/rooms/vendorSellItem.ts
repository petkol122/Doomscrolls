/**
 * Task 320 — Vendor Foundation: Server-Authoritative Sell Item.
 *
 * Server-side sell handler that validates vendor existence, item
 * ownership, equipment state, sellability and price, then
 * atomically deletes the item and awards copper.
 *
 * The client never decides the sell price.
 */
import { contentRegistry, type ItemContentDefinition } from "@doomscrolls/content";
import type { RequestSellItemRejectedReason } from "@doomscrolls/shared";
import { ItemLocationType, Prisma, type PrismaClient } from "@prisma/client";

import { resolveItemDefinitionValueCzk } from "../../character/calculatePlayerNetWorth";
import { CharacterRepository } from "../../persistence/repositories/CharacterRepository";
import { ItemRepository } from "../../persistence/repositories/ItemRepository";
import { getSharedPrismaClient } from "../../persistence/prisma";

/**
 * Sell price ratio: the player receives 50 % of an item's value when
 * selling it. Items that appear in a vendor stock list use 50 % of that
 * vendor's buy price; every other item falls back to 50 % of its Net
 * Worth value (`baseValueCzk`/rarity fallback, see
 * `resolveItemDefinitionValueCzk`) so salvage/loot materials that no
 * vendor stocks still sell for a sensible amount instead of a flat
 * 1-copper floor.
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
 * that price. Items not in any stock list fall back to 50 % of the
 * item's Net Worth value instead of a flat floor, so salvage/loot
 * materials (never vendor-stocked) still sell for a meaningful amount.
 * Always at least 1 copper.
 */
function computeSellPrice(itemDefinition: ItemContentDefinition): number {
  const stockEntries = contentRegistry.vendorStocks.all;
  for (const entry of stockEntries) {
    if (entry.itemId === itemDefinition.id) {
      const raw = Math.floor(entry.priceCopper * SELL_PRICE_RATIO);
      return Math.max(MIN_SELL_PRICE, raw);
    }
  }
  const raw = Math.floor(resolveItemDefinitionValueCzk(itemDefinition) * SELL_PRICE_RATIO);
  return Math.max(MIN_SELL_PRICE, raw);
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
  readonly db?: PrismaClient;
}): Promise<VendorSellItemResult> {
  const { characterId, vendorId, itemInstanceId } = input;
  const db = input.db ?? getSharedPrismaClient();

  // 1. Validate vendor exists in town-service content
  const vendorService = contentRegistry.townServices.get(vendorId as never);
  if (vendorService === undefined || vendorService.serviceKind !== "vendor") {
    return { ok: false, reason: "vendor_unavailable" };
  }

  // 2. Load item instance owned by this character
  const itemRepo = new ItemRepository(db);
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
  const sellPriceCopper = computeSellPrice(itemDefinition);
  if (!Number.isFinite(sellPriceCopper) || sellPriceCopper < MIN_SELL_PRICE) {
    return { ok: false, reason: "invalid_price" };
  }

  // 6. Atomically: delete item + add copper
  try {
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
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