import { contentRegistry } from "@doomscrolls/content";
import type { ItemDefinitionId } from "@doomscrolls/shared";

import type { CreateItemInstanceData, ItemRepository } from "../../persistence/repositories/ItemRepository";

/**
 * Shared rectangle-packing helpers for any server-authoritative item
 * grid (character inventory, per-character stash). Extracted from
 * `stashTransferItem.ts` (Task 329) so `moveInventoryItem.ts` and other
 * grid-aware handlers reuse the exact same placement rules instead of
 * re-implementing overlap checks.
 */

export type PlacementItem = {
  readonly definitionId: ItemDefinitionId;
  readonly pageIndex: number | null;
  readonly x: number | null;
  readonly y: number | null;
};

export function rectanglesOverlap(
  a: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  b: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function canPlaceItemAt(
  config: { readonly pageCount: number; readonly gridWidth: number; readonly gridHeight: number },
  existingItems: readonly PlacementItem[],
  pageIndex: number,
  x: number,
  y: number,
  targetSize: { readonly width: number; readonly height: number },
  excludeItemDefinitionAtIndex?: number,
): boolean {
  if (
    pageIndex < 0 ||
    pageIndex >= config.pageCount ||
    x < 0 ||
    y < 0 ||
    x + targetSize.width > config.gridWidth ||
    y + targetSize.height > config.gridHeight
  ) {
    return false;
  }

  for (let i = 0; i < existingItems.length; i += 1) {
    if (i === excludeItemDefinitionAtIndex) {
      continue;
    }
    const existingItem = existingItems[i];
    if (existingItem === undefined || existingItem.pageIndex !== pageIndex || existingItem.x === null || existingItem.y === null) {
      continue;
    }
    const existingDefinition = contentRegistry.items.get(existingItem.definitionId as never);
    if (existingDefinition === undefined) {
      continue;
    }
    if (
      rectanglesOverlap(
        { x, y, width: targetSize.width, height: targetSize.height },
        {
          x: existingItem.x,
          y: existingItem.y,
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

export function findFirstAvailableSlot(
  config: { readonly pageCount: number; readonly gridWidth: number; readonly gridHeight: number },
  existingItems: readonly PlacementItem[],
  targetSize: { readonly width: number; readonly height: number },
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

/**
 * Milestone 0.3 -- Stackable Item Quantities. An existing grid item
 * carrying its live quantity, needed on top of `PlacementItem` so a
 * placement plan can tell a full stack from one with room left.
 */
export interface StackablePlacementItem extends PlacementItem {
  readonly itemInstanceId: string;
  readonly quantity: number;
}

export interface StackPlacementPlan {
  readonly merges: ReadonlyArray<{ readonly itemInstanceId: string; readonly newQuantity: number }>;
  readonly creates: ReadonlyArray<{
    readonly pageIndex: number;
    readonly x: number;
    readonly y: number;
    readonly quantity: number;
  }>;
}

/**
 * Plans how to add `quantityToAdd` units of `itemDefinition` into a
 * grid: first topping up existing non-full stacks of the same
 * definition (when the item is `stackable`), then finding new slots for
 * any overflow, splitting across as many slots as needed at up to
 * `maxStackSize` each. Returns `null` when there isn't enough free grid
 * space for the overflow -- callers should reject the whole operation
 * rather than apply a partial plan (loot lost to a "full" stash/bag
 * should not silently top up existing stacks first).
 */
export function planStackablePlacement(
  config: { readonly pageCount: number; readonly gridWidth: number; readonly gridHeight: number },
  existingItems: readonly StackablePlacementItem[],
  itemDefinition: {
    readonly id: ItemDefinitionId;
    readonly size: { readonly width: number; readonly height: number };
    readonly stackable: boolean;
    readonly maxStackSize: number;
  },
  quantityToAdd: number,
): StackPlacementPlan | null {
  let remaining = quantityToAdd;
  const merges: Array<{ itemInstanceId: string; newQuantity: number }> = [];

  if (itemDefinition.stackable) {
    for (const item of existingItems) {
      if (remaining <= 0) {
        break;
      }
      if (item.definitionId !== itemDefinition.id) {
        continue;
      }
      const room = itemDefinition.maxStackSize - item.quantity;
      if (room <= 0) {
        continue;
      }
      const add = Math.min(room, remaining);
      merges.push({ itemInstanceId: item.itemInstanceId, newQuantity: item.quantity + add });
      remaining -= add;
    }
  }

  const creates: Array<{ pageIndex: number; x: number; y: number; quantity: number }> = [];
  const placementItems: PlacementItem[] = existingItems.map((item) => ({
    definitionId: item.definitionId,
    pageIndex: item.pageIndex,
    x: item.x,
    y: item.y,
  }));
  const perSlotCap = itemDefinition.stackable ? itemDefinition.maxStackSize : 1;

  while (remaining > 0) {
    const slot = findFirstAvailableSlot(config, placementItems, itemDefinition.size);
    if (slot === null) {
      return null;
    }
    const quantity = Math.min(perSlotCap, remaining);
    creates.push({ pageIndex: slot.pageIndex, x: slot.x, y: slot.y, quantity });
    placementItems.push({ definitionId: itemDefinition.id, pageIndex: slot.pageIndex, x: slot.x, y: slot.y });
    remaining -= quantity;
  }

  return { merges, creates };
}

/** Applies a `planStackablePlacement` plan: tops up existing stacks then
 *  creates any new instances for overflow. `baseCreateData` supplies the
 *  fields shared by every created instance (definitionId, owner,
 *  location, durability, rarity/affixes); placement + quantity are
 *  filled in per `plan.creates` entry. */
export async function applyStackablePlacementPlan(
  itemRepository: ItemRepository,
  plan: StackPlacementPlan,
  baseCreateData: Omit<CreateItemInstanceData, "inventoryPage" | "inventoryX" | "inventoryY" | "quantity">,
): Promise<void> {
  for (const merge of plan.merges) {
    await itemRepository.updateQuantity(merge.itemInstanceId, merge.newQuantity);
  }
  for (const create of plan.creates) {
    await itemRepository.createItemInstance({
      ...baseCreateData,
      inventoryPage: create.pageIndex,
      inventoryX: create.x,
      inventoryY: create.y,
      quantity: create.quantity,
    });
  }
}
