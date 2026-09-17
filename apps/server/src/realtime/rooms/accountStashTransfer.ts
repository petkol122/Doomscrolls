import { contentRegistry } from "@doomscrolls/content";
import type {
  AccountStashItemSummary,
  ItemDefinitionId,
  RequestDepositStashItemRejectedReason,
  RequestWithdrawStashItemRejectedReason,
} from "@doomscrolls/shared";
import { ItemLocationType, type Prisma, type PrismaClient } from "@prisma/client";

import { CharacterRepository } from "../../persistence/repositories/CharacterRepository";
import { InventoryRepository } from "../../persistence/repositories/InventoryRepository";
import { ItemRepository } from "../../persistence/repositories/ItemRepository";
import { StashItemRepository } from "../../persistence/repositories/StashItemRepository";
import { getSharedPrismaClient } from "../../persistence/prisma";
import { findFirstAvailableSlot, type PlacementItem } from "./itemGridPlacement";

/**
 * Milestone 0.2 — Account Stash Foundation. Server-authoritative
 * deposit/withdraw/list for the account-wide (`userId`-keyed) `StashItem`
 * table -- separate from `stashTransferItem.ts`'s per-character bank.
 * Only stackable items with no durability roll can be deposited (durable
 * gear keeps its unique instance data only in the per-character system).
 */

export type DepositStashItemResult =
  | { readonly ok: true; readonly itemInstanceId: string; readonly stashItems: readonly AccountStashItemSummary[] }
  | { readonly ok: false; readonly reason: RequestDepositStashItemRejectedReason };

export type WithdrawStashItemResult =
  | { readonly ok: true; readonly stashItemId: string; readonly stashItems: readonly AccountStashItemSummary[] }
  | { readonly ok: false; readonly reason: RequestWithdrawStashItemRejectedReason };

function toAccountStashSummaries(
  items: readonly { readonly id: string; readonly definitionId: string; readonly quantity: number; readonly slotIndex: number }[],
): readonly AccountStashItemSummary[] {
  return items.map((item) => ({
    id: item.id,
    definitionId: item.definitionId as ItemDefinitionId,
    quantity: item.quantity,
    slotIndex: item.slotIndex,
  }));
}

export async function executeListAccountStash(input: {
  readonly userId: string;
  readonly db?: PrismaClient;
}): Promise<readonly AccountStashItemSummary[]> {
  const db = input.db ?? getSharedPrismaClient();
  const items = await new StashItemRepository(db).listByUserId(input.userId);
  return toAccountStashSummaries(items);
}

export async function executeDepositStashItem(input: {
  readonly characterId: string;
  readonly itemInstanceId: string;
  readonly quantity?: number;
  readonly db?: PrismaClient;
}): Promise<DepositStashItemResult> {
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
  if (item.durabilityCurrent !== null || item.durabilityMax !== null) {
    return { ok: false, reason: "item_not_stashable" };
  }

  const itemDefinition = contentRegistry.items.get(item.definitionId as never);
  if (itemDefinition === undefined) {
    return { ok: false, reason: "item_unavailable" };
  }

  const userId = await new CharacterRepository(db).findOwnerUserId(input.characterId);
  if (userId === null) {
    return { ok: false, reason: "item_unavailable" };
  }

  const depositQuantity = Number.isFinite(input.quantity)
    ? Math.min(item.quantity, Math.max(1, Math.floor(input.quantity ?? 1)))
    : item.quantity;

  try {
    return await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const txItemRepo = new ItemRepository(tx);
      const txStashRepo = new StashItemRepository(tx);

      if (depositQuantity >= item.quantity) {
        await txItemRepo.deleteItemInstance(input.itemInstanceId);
      } else {
        await txItemRepo.updateQuantity(input.itemInstanceId, item.quantity - depositQuantity);
      }

      const existingStack = await txStashRepo.findByUserIdAndDefinitionId(userId, item.definitionId);
      if (existingStack !== null) {
        await txStashRepo.updateQuantity(existingStack.id, existingStack.quantity + depositQuantity);
      } else {
        const slotIndex = await txStashRepo.nextSlotIndex(userId);
        await txStashRepo.create({
          userId,
          definitionId: item.definitionId,
          quantity: depositQuantity,
          slotIndex,
        });
      }

      const updated = await txStashRepo.listByUserId(userId);
      return { ok: true as const, itemInstanceId: input.itemInstanceId, stashItems: toAccountStashSummaries(updated) };
    });
  } catch {
    return { ok: false, reason: "stash_unavailable" };
  }
}

export async function executeWithdrawStashItem(input: {
  readonly characterId: string;
  readonly stashItemId: string;
  readonly quantity?: number;
  readonly db?: PrismaClient;
}): Promise<WithdrawStashItemResult> {
  const db = input.db ?? getSharedPrismaClient();

  const userId = await new CharacterRepository(db).findOwnerUserId(input.characterId);
  if (userId === null) {
    return { ok: false, reason: "item_unavailable" };
  }

  const stashRepo = new StashItemRepository(db);
  const stashItem = await stashRepo.findByIdForUser(input.stashItemId, userId);
  if (stashItem === null) {
    return { ok: false, reason: "item_not_in_stash" };
  }

  const itemDefinition = contentRegistry.items.get(stashItem.definitionId as never);
  if (itemDefinition === undefined) {
    return { ok: false, reason: "item_unavailable" };
  }

  const withdrawQuantity = Number.isFinite(input.quantity)
    ? Math.min(stashItem.quantity, Math.max(1, Math.floor(input.quantity ?? 1)))
    : stashItem.quantity;

  const inventoryRepo = new InventoryRepository(db);
  const inventory = await inventoryRepo.findByCharacterId(input.characterId);
  if (inventory === null) {
    return { ok: false, reason: "inventory_full" };
  }

  const itemRepo = new ItemRepository(db);
  const inventoryItems = await itemRepo.listInventoryItems(input.characterId);
  const placementItems: PlacementItem[] = inventoryItems.map((existing) => ({
    definitionId: existing.definitionId as ItemDefinitionId,
    pageIndex: existing.inventoryPage,
    x: existing.inventoryX,
    y: existing.inventoryY,
  }));
  const slot = findFirstAvailableSlot(
    { pageCount: inventory.pageCount, gridWidth: inventory.gridWidth, gridHeight: inventory.gridHeight },
    placementItems,
    itemDefinition.size,
  );
  if (slot === null) {
    return { ok: false, reason: "inventory_full" };
  }

  try {
    return await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const txItemRepo = new ItemRepository(tx);
      const txStashRepo = new StashItemRepository(tx);

      await txItemRepo.createItemInstance({
        definitionId: stashItem.definitionId,
        ownerCharacterId: input.characterId,
        locationType: ItemLocationType.INVENTORY,
        inventoryPage: slot.pageIndex,
        inventoryX: slot.x,
        inventoryY: slot.y,
        quantity: withdrawQuantity,
      });

      if (withdrawQuantity >= stashItem.quantity) {
        await txStashRepo.delete(stashItem.id);
      } else {
        await txStashRepo.updateQuantity(stashItem.id, stashItem.quantity - withdrawQuantity);
      }

      const updated = await txStashRepo.listByUserId(userId);
      return { ok: true as const, stashItemId: stashItem.id, stashItems: toAccountStashSummaries(updated) };
    });
  } catch {
    return { ok: false, reason: "stash_unavailable" };
  }
}
