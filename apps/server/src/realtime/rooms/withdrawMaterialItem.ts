/**
 * Withdraws a chosen quantity of a salvage-material currency balance
 * (Iron Scrap / Arcane Dust, see `MaterialTypes.ts`) back into a
 * physical, tradeable inventory item stack.
 *
 * The client never decides whether the balance/inventory space allow
 * it -- the server validates the requested quantity against the
 * character's current balance, caps it at the material item's own
 * `maxStackSize`, and finds inventory space itself.
 */
import { contentRegistry } from "@doomscrolls/content";
import type { ItemDefinitionId, MaterialId, RequestWithdrawMaterialRejectedReason } from "@doomscrolls/shared";
import { ItemLocationType, Prisma, type PrismaClient } from "@prisma/client";

import { CharacterRepository } from "../../persistence/repositories/CharacterRepository";
import { InventoryRepository } from "../../persistence/repositories/InventoryRepository";
import { ItemRepository } from "../../persistence/repositories/ItemRepository";
import { getSharedPrismaClient } from "../../persistence/prisma";
import { applyStackablePlacementPlan, planStackablePlacement, type StackablePlacementItem } from "./itemGridPlacement";

export type WithdrawMaterialItemResult =
  | {
      readonly ok: true;
      readonly materialId: MaterialId;
      readonly quantity: number;
      readonly newMaterialBalance: number;
    }
  | {
      readonly ok: false;
      readonly reason: RequestWithdrawMaterialRejectedReason;
    };

export async function executeWithdrawMaterialItem(input: {
  readonly characterId: string;
  readonly materialId: string;
  readonly quantity: number;
  readonly db?: PrismaClient;
}): Promise<WithdrawMaterialItemResult> {
  const { characterId, materialId: rawMaterialId, quantity } = input;
  const db = input.db ?? getSharedPrismaClient();

  // 1. Validate the material id and its item definition
  const itemDefinition = contentRegistry.items.get(rawMaterialId as ItemDefinitionId);
  if (
    itemDefinition === undefined ||
    (rawMaterialId !== "iron_scrap" && rawMaterialId !== "arcane_dust")
  ) {
    return { ok: false, reason: "invalid_amount" };
  }
  const materialId = rawMaterialId as MaterialId;

  // 2. Validate the requested quantity, capped at the item's own stack size
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, reason: "invalid_amount" };
  }
  const safeQuantity = Math.min(Math.floor(quantity), itemDefinition.maxStackSize);

  // 3. Atomically: debit the balance, then place the withdrawn stack
  try {
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const txCharacterRepo = new CharacterRepository(tx);
      const txInventoryRepo = new InventoryRepository(tx);
      const txItemRepo = new ItemRepository(tx);

      const newBalances = await txCharacterRepo.decrementMaterialBalance(characterId, materialId, safeQuantity);
      if (newBalances === null) {
        return { ok: false as const, reason: "insufficient_material" as const };
      }

      const inventory = await txInventoryRepo.findByCharacterId(characterId);
      if (inventory === null) {
        return { ok: false as const, reason: "inventory_full" as const };
      }

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
        safeQuantity,
      );

      if (plan === null) {
        return { ok: false as const, reason: "inventory_full" as const };
      }

      await applyStackablePlacementPlan(txItemRepo, plan, {
        definitionId: rawMaterialId,
        ownerCharacterId: characterId,
        locationType: ItemLocationType.INVENTORY,
      });

      return {
        ok: true as const,
        materialId,
        quantity: safeQuantity,
        newMaterialBalance: newBalances[materialId],
      };
    });

    return result;
  } catch {
    return { ok: false, reason: "character_not_found" };
  }
}
