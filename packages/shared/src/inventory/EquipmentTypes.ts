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
  | "flask_1";

export type EquipmentLoadout = Readonly<Record<EquipmentSlot, ItemInstanceId | null>>;

export interface EquipItemPayload {
  readonly itemInstanceId: ItemInstanceId;
  readonly slot: EquipmentSlot;
}

export interface UnequipItemPayload {
  readonly slot: EquipmentSlot;
}