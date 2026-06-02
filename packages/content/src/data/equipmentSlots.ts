import type { EquipmentSlotContentDefinition } from "./types";

export const equipmentSlots = [
  { id: "weapon", nameKey: "equipment.slot.weapon", category: "weapon", activeInCore01: true },
  { id: "head", nameKey: "equipment.slot.head", category: "armor", activeInCore01: true },
  { id: "chest", nameKey: "equipment.slot.chest", category: "armor", activeInCore01: true },
  { id: "hands", nameKey: "equipment.slot.hands", category: "armor", activeInCore01: true },
  { id: "feet", nameKey: "equipment.slot.feet", category: "armor", activeInCore01: true },
  { id: "ring_1", nameKey: "equipment.slot.ring_1", category: "accessory", activeInCore01: true },
  { id: "amulet", nameKey: "equipment.slot.amulet", category: "accessory", activeInCore01: true },
  { id: "belt", nameKey: "equipment.slot.belt", category: "belt", activeInCore01: true },
  { id: "flask_1", nameKey: "equipment.slot.flask_1", category: "flask", activeInCore01: true }
] as const satisfies readonly EquipmentSlotContentDefinition[];