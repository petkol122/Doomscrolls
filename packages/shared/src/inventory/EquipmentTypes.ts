import type { ItemInstanceId } from "../ids";

export type EquipmentSlot =
  | "weapon"
  | "head"
  | "chest"
  | "hands"
  | "feet"
  | "ring_1"
  | "amulet"
  | "belt"
  | "flask_1"
  | "flask_2"
  | "flask_3"
  | "flask_4";

/**
 * Milestone 0.3 -- 4-Slot Flask Belt. The four flask equipment slots, in
 * belt order (matches the hotkeys 1-4 that activate them). Any flask
 * item (health/mana/stamina) may be equipped into any of the four.
 */
export const FLASK_BELT_SLOT_IDS = ["flask_1", "flask_2", "flask_3", "flask_4"] as const satisfies readonly EquipmentSlot[];

export type FlaskBeltSlotNumber = 1 | 2 | 3 | 4;

export function flaskBeltSlotToEquipmentSlot(slot: FlaskBeltSlotNumber): EquipmentSlot {
  return FLASK_BELT_SLOT_IDS[slot - 1] as EquipmentSlot;
}

/** Returns the belt slot number (1-4) for a flask equipment slot, or `undefined` for any other slot. */
export function equipmentSlotToFlaskBeltSlot(slot: EquipmentSlot): FlaskBeltSlotNumber | undefined {
  const index = (FLASK_BELT_SLOT_IDS as readonly EquipmentSlot[]).indexOf(slot);
  return index === -1 ? undefined : ((index + 1) as FlaskBeltSlotNumber);
}

export type EquipmentLoadout = Readonly<Record<EquipmentSlot, ItemInstanceId | null>>;

export interface EquipItemPayload {
  readonly itemInstanceId: ItemInstanceId;
  readonly slot: EquipmentSlot;
}

export interface UnequipItemPayload {
  readonly slot: EquipmentSlot;
}