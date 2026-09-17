/**
 * Milestone 0.3 -- Pawn Shop / Army Surplus Vendor: Salvage & Tech Teardown.
 *
 * Server-side salvage handler that validates vendor existence, item
 * ownership and equipment state, then atomically deletes the item and
 * credits a salvage-material currency balance chosen from the item
 * instance's own rolled rarity tier (never a client-sent choice).
 *
 * The two salvage materials (Iron Scrap / Arcane Dust) are a currency
 * balance on the character (see `MaterialTypes.ts`), not an inventory
 * item -- salvaging can never fail with `inventory_full`.
 */
import { contentRegistry } from "@doomscrolls/content";
import type { MaterialId, RequestSalvageItemRejectedReason } from "@doomscrolls/shared";
import { ItemLocationType, Prisma, type PrismaClient } from "@prisma/client";

import { CharacterRepository } from "../../persistence/repositories/CharacterRepository";
import { ItemRepository } from "../../persistence/repositories/ItemRepository";
import { getSharedPrismaClient } from "../../persistence/prisma";

const NORMAL_MAGIC_MATERIAL_ID: MaterialId = "iron_scrap";
const RARE_LEGENDARY_MATERIAL_ID: MaterialId = "arcane_dust";
const SALVAGE_MATERIAL_QUANTITY = 1;

export type SalvageItemResult =
  | {
      readonly ok: true;
      readonly itemInstanceId: string;
      readonly definitionId: string;
      readonly materialItemId: MaterialId;
      readonly materialQuantity: number;
      readonly newMaterialBalance: number;
    }
  | {
      readonly ok: false;
      readonly reason: RequestSalvageItemRejectedReason;
    };

/** Chooses the salvage material for an item instance's rolled rarity tier. */
function resolveSalvageMaterialId(rarityTier: string): MaterialId {
  return rarityTier === "rare" || rarityTier === "legendary"
    ? RARE_LEGENDARY_MATERIAL_ID
    : NORMAL_MAGIC_MATERIAL_ID;
}

export async function executeSalvageItem(input: {
  readonly characterId: string;
  readonly vendorId: string;
  readonly itemInstanceId: string;
  readonly db?: PrismaClient;
}): Promise<SalvageItemResult> {
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
    return { ok: false, reason: "item_not_salvageable" };
  }

  const materialItemId = resolveSalvageMaterialId(item.rarityTier);

  // 5. Atomically: delete salvaged item + credit material balance
  try {
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const txCharacterRepo = new CharacterRepository(tx);
      const txItemRepo = new ItemRepository(tx);

      await txItemRepo.deleteItemInstance(itemInstanceId);

      const newBalances = await txCharacterRepo.incrementMaterialBalance(
        characterId,
        materialItemId,
        SALVAGE_MATERIAL_QUANTITY,
      );
      if (newBalances === null) {
        return { ok: false as const, reason: "vendor_unavailable" as const };
      }

      return {
        ok: true as const,
        itemInstanceId,
        definitionId: item.definitionId,
        materialItemId,
        materialQuantity: SALVAGE_MATERIAL_QUANTITY,
        newMaterialBalance: newBalances[materialItemId],
      };
    });

    return result;
  } catch {
    return { ok: false, reason: "vendor_unavailable" };
  }
}
