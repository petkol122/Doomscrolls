import { contentRegistry } from "@doomscrolls/content";
import type { ItemDefinitionId } from "@doomscrolls/shared";
import { ItemLocationType, Prisma, type PrismaClient } from "@prisma/client";

import { InventoryRepository } from "../../persistence/repositories/InventoryRepository";
import { ItemRepository } from "../../persistence/repositories/ItemRepository";
import { getSharedPrismaClient } from "../../persistence/prisma";

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
      contentRegistry,
    );

    if (slot === null) {
      return { ok: false, reason: "inventory_full" } as const;
    }

    const createItemData = {
      definitionId: input.itemDefinitionId,
      ownerCharacterId: input.characterId,
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
    };

    await itemRepository.createItemInstance(createItemData);

    return {
      ok: true,
      message: `Picked up ${input.itemLabel}`,
    } as const;
  });
}

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
  registry: typeof contentRegistry,
): { readonly pageIndex: number; readonly x: number; readonly y: number } | null {
  for (let pageIndex = 0; pageIndex < config.pageCount; pageIndex += 1) {
    for (let y = 0; y <= config.gridHeight - targetSize.height; y += 1) {
      for (let x = 0; x <= config.gridWidth - targetSize.width; x += 1) {
        if (canPlaceItemAt(config, existingItems, registry, pageIndex, x, y, targetSize)) {
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
  registry: typeof contentRegistry,
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

    const existingDefinition = registry.items.get(existingItem.definitionId);
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