import type { EquipmentLoadout, EquipmentSlot, ItemInstanceId } from "@doomscrolls/shared";
import type { PrismaClient } from "@prisma/client";
import { getSharedPrismaClient } from "../persistence/prisma";
import { ItemRepository } from "../persistence/repositories/ItemRepository";

const EMPTY_EQUIPMENT_LOADOUT: EquipmentLoadout = {
  weapon: null,
  head: null,
  chest: null,
  hands: null,
  feet: null,
  ring_1: null,
  amulet: null,
  belt: null,
  flask_1: null,
};

/**
 * Build a character's current `EquipmentLoadout` (item instance id per slot,
 * or null when empty) straight from persistence. Shared by `EquipmentService`
 * (after an equip/unequip mutation) and room `onJoin` (so a client that
 * already has gear equipped sees it immediately, not only after the next
 * equip/unequip in that session).
 */
export async function buildEquipmentLoadout(
  characterId: string,
  db: PrismaClient = getSharedPrismaClient(),
): Promise<EquipmentLoadout> {
  const itemRepo = new ItemRepository(db);
  const equippedItems = await itemRepo.listEquippedItems(characterId);

  const loadout: EquipmentLoadout = { ...EMPTY_EQUIPMENT_LOADOUT };
  for (const item of equippedItems) {
    if (item.equipmentSlot === null) {
      continue;
    }
    (loadout as Record<EquipmentSlot, ItemInstanceId | null>)[item.equipmentSlot as EquipmentSlot] =
      item.id as ItemInstanceId;
  }

  return loadout;
}
