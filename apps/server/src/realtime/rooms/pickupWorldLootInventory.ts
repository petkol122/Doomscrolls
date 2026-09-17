import { contentRegistry } from "@doomscrolls/content";
import type { ItemDefinitionId } from "@doomscrolls/shared";
import { ItemLocationType, Prisma, type PrismaClient } from "@prisma/client";

import { InventoryRepository } from "../../persistence/repositories/InventoryRepository";
import { ItemRepository } from "../../persistence/repositories/ItemRepository";
import { getSharedPrismaClient } from "../../persistence/prisma";
import { applyStackablePlacementPlan, planStackablePlacement, type StackablePlacementItem } from "./itemGridPlacement";

export type PickupWorldLootFailureReason = "inventory_not_found" | "inventory_full" | "invalid_item_definition";

export type PickupWorldLootInventoryResult =
  | {
      readonly ok: true;
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly reason: PickupWorldLootFailureReason;
    };

export async function persistPickedUpWorldLootToInventory(input: {
  readonly characterId: string;
  readonly itemDefinitionId: ItemDefinitionId;
  readonly itemLabel: string;
  readonly db?: PrismaClient;
  /** Milestone 0.3 -- the roll already made at drop time (see
   *  `affixRollEngine.ts`/`spawnWorldLootOnEnemyDefeat.ts`), persisted
   *  unchanged rather than re-rolled on pickup. */
  readonly rarityTier?: string;
  readonly rolledAffixesJson?: string;
}): Promise<PickupWorldLootInventoryResult> {
  const itemDefinition = contentRegistry.items.get(input.itemDefinitionId);
  if (itemDefinition === undefined) {
    return { ok: false, reason: "invalid_item_definition" };
  }

  const db = input.db ?? getSharedPrismaClient();
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const inventoryRepository = new InventoryRepository(tx);
    const itemRepository = new ItemRepository(tx);
    const inventory = await inventoryRepository.findByCharacterId(input.characterId);

    if (inventory === null) {
      return { ok: false, reason: "inventory_not_found" } as const;
    }

    const existingItems = await itemRepository.listInventoryItems(input.characterId);
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
      return { ok: false, reason: "inventory_full" } as const;
    }

    await applyStackablePlacementPlan(itemRepository, plan, {
      definitionId: input.itemDefinitionId,
      ownerCharacterId: input.characterId,
      locationType: ItemLocationType.INVENTORY,
      ...(itemDefinition.durabilityMax !== undefined
        ? {
            durabilityCurrent: itemDefinition.durabilityMax,
            durabilityMax: itemDefinition.durabilityMax,
          }
        : {}),
      ...(input.rarityTier !== undefined && input.rarityTier.length > 0 ? { rarityTier: input.rarityTier } : {}),
      ...(input.rolledAffixesJson !== undefined ? { rolledAffixes: input.rolledAffixesJson } : {}),
    });

    return {
      ok: true,
      message: `Picked up ${input.itemLabel}`,
    } as const;
  });
}