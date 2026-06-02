import type { ItemDefinitionId } from "@doomscrolls/shared";
import type { ItemContentDefinition } from "./types";

const itemId = (value: string): ItemDefinitionId => value as ItemDefinitionId;

export const items = [
  {
    id: itemId("starter_pipe"),
    nameKey: "item.starter_pipe.name",
    descriptionKey: "item.starter_pipe.description",
    category: "weapon",
    rarity: "common",
    size: { width: 1, height: 3 },
    allowedEquipmentSlots: ["weapon"],
    stackable: false,
    maxStackSize: 1,
    statModifiers: [{ target: "damage", operation: "add", value: 3 }],
    durabilityMax: 20,
    iconKey: "item_starter_pipe_placeholder"
  },
  {
    id: itemId("sewer_jacket"),
    nameKey: "item.sewer_jacket.name",
    descriptionKey: "item.sewer_jacket.description",
    category: "armor",
    rarity: "common",
    size: { width: 2, height: 3 },
    allowedEquipmentSlots: ["chest"],
    stackable: false,
    maxStackSize: 1,
    statModifiers: [
      { target: "armor", operation: "add", value: 2 },
      { target: "maxHp", operation: "add", value: 5 }
    ],
    durabilityMax: 20,
    iconKey: "item_sewer_jacket_placeholder"
  },
  {
    id: itemId("starter_blood_flask"),
    nameKey: "item.starter_blood_flask.name",
    descriptionKey: "item.starter_blood_flask.description",
    category: "flask",
    rarity: "common",
    size: { width: 1, height: 2 },
    allowedEquipmentSlots: ["flask_1"],
    stackable: false,
    maxStackSize: 1,
    statModifiers: [],
    useEffect: { type: "restoreHpInstant", value: 25, charges: 3 },
    iconKey: "item_starter_blood_flask_placeholder"
  },
  {
    id: itemId("blackwire_scrap"),
    nameKey: "item.blackwire_scrap.name",
    descriptionKey: "item.blackwire_scrap.description",
    category: "material",
    rarity: "common",
    size: { width: 1, height: 1 },
    allowedEquipmentSlots: [],
    stackable: true,
    maxStackSize: 99,
    statModifiers: [],
    iconKey: "item_blackwire_scrap_placeholder"
  }
] as const satisfies readonly ItemContentDefinition[];