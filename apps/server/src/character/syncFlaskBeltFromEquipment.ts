import { contentRegistry } from "@doomscrolls/content";
import { FLASK_BELT_SLOT_IDS, parseFlaskChargesJson, type FlaskBeltSlotNumber, type ItemDefinitionId } from "@doomscrolls/shared";
import type { PrismaClient } from "@prisma/client";
import { getSharedPrismaClient } from "../persistence/prisma";
import { ItemRepository } from "../persistence/repositories/ItemRepository";
import type { PlayerPresence } from "../realtime/rooms/PlayerPresence";
import { syncFlaskBeltSlotFromEquippedItem } from "../realtime/rooms/flaskBeltConfig";

/**
 * Milestone 0.3 -- 4-Slot Flask Belt. Populates a joined player's belt
 * state (per-slot max charges / effect / current charges) from
 * whatever flask items are equipped in `flask_1`..`flask_4`, restoring
 * the persisted charge count for each occupied slot. Called once at
 * room join, right alongside `buildEquipmentLoadout` (the other
 * consumer of the character's equipped items), and again by
 * `EquipmentService` after every equip/unequip that touches a flask
 * slot so the connected player's belt stays live without needing a
 * reconnect.
 */
export async function syncFlaskBeltFromEquipment(
  presence: PlayerPresence,
  characterId: string,
  flaskChargesJson: string | null | undefined,
  db: PrismaClient = getSharedPrismaClient(),
): Promise<void> {
  const itemRepo = new ItemRepository(db);
  const equippedItems = await itemRepo.listEquippedItems(characterId);

  const definitionIdBySlot = new Map<string, string>();
  for (const item of equippedItems) {
    if (item.equipmentSlot !== null) {
      definitionIdBySlot.set(item.equipmentSlot, item.definitionId);
    }
  }

  const persistedCharges = parseFlaskChargesJson(flaskChargesJson);

  FLASK_BELT_SLOT_IDS.forEach((slotId, index) => {
    const slotNumber = (index + 1) as FlaskBeltSlotNumber;
    const definitionId = definitionIdBySlot.get(slotId);
    const useEffect = definitionId === undefined
      ? undefined
      : contentRegistry.items.get(definitionId as ItemDefinitionId)?.useEffect;
    syncFlaskBeltSlotFromEquippedItem(presence, slotNumber, useEffect, persistedCharges[index]);
  });
}
