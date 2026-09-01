import type { ItemDefinitionId } from "@doomscrolls/shared";
import type { ContentLocalizationKey, ItemContentDefinition } from "./types";

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
  },
  {
    id: itemId("scrap_cloth"),
    nameKey: "item.scrap_cloth.name" as ContentLocalizationKey,
    descriptionKey: "item.scrap_cloth.description" as ContentLocalizationKey,
    category: "material",
    rarity: "common",
    size: { width: 1, height: 1 },
    allowedEquipmentSlots: [],
    stackable: true,
    maxStackSize: 99,
    statModifiers: [],
    iconKey: "item_scrap_cloth_placeholder"
  },
  {
    id: itemId("rustbound_ring"),
    nameKey: "item.rustbound_ring.name" as ContentLocalizationKey,
    descriptionKey: "item.rustbound_ring.description" as ContentLocalizationKey,
    category: "accessory",
    rarity: "rare",
    size: { width: 1, height: 1 },
    allowedEquipmentSlots: ["ring_1"],
    stackable: false,
    maxStackSize: 1,
    statModifiers: [
      { target: "armor", operation: "add", value: 1 },
      { target: "maxHp", operation: "add", value: 8 }
    ],
    durabilityMax: 20,
    iconKey: "item_rustbound_ring_placeholder"
  },
  {
    // Tarnished Coin — a small stackable material that drops from sewer
    // enemies. Intentionally low loot weight so it feels like a minor bonus
    // rather than a primary drop. First item added as part of the 0.2
    // content pipeline proof-of-concept.
    id: itemId("tarnished_coin"),
    nameKey: "item.tarnished_coin.name" as ContentLocalizationKey,
    descriptionKey: "item.tarnished_coin.description" as ContentLocalizationKey,
    category: "material",
    rarity: "common",
    size: { width: 1, height: 1 },
    allowedEquipmentSlots: [],
    stackable: true,
    maxStackSize: 99,
    statModifiers: [],
    iconKey: "item_tarnished_coin_placeholder"
  },

  // ── Task 356 (Core 0.5) — equipment slot coverage. Fills the head,
  // hands, feet, amulet, and belt slots, which were defined in the
  // equipment schema since 0.1 but had no obtainable item until now. ──
  {
    id: itemId("scavenged_hood"),
    nameKey: "item.scavenged_hood.name" as ContentLocalizationKey,
    descriptionKey: "item.scavenged_hood.description" as ContentLocalizationKey,
    category: "armor",
    rarity: "common",
    size: { width: 1, height: 1 },
    allowedEquipmentSlots: ["head"],
    stackable: false,
    maxStackSize: 1,
    statModifiers: [{ target: "armor", operation: "add", value: 1 }],
    durabilityMax: 20,
    iconKey: "item_scavenged_hood_placeholder"
  },
  {
    id: itemId("wraptape_gloves"),
    nameKey: "item.wraptape_gloves.name" as ContentLocalizationKey,
    descriptionKey: "item.wraptape_gloves.description" as ContentLocalizationKey,
    category: "armor",
    rarity: "common",
    size: { width: 1, height: 1 },
    allowedEquipmentSlots: ["hands"],
    stackable: false,
    maxStackSize: 1,
    statModifiers: [{ target: "attackCooldownMs", operation: "add", value: -40 }],
    durabilityMax: 20,
    iconKey: "item_wraptape_gloves_placeholder"
  },
  {
    id: itemId("sewer_treads"),
    nameKey: "item.sewer_treads.name" as ContentLocalizationKey,
    descriptionKey: "item.sewer_treads.description" as ContentLocalizationKey,
    category: "armor",
    rarity: "common",
    size: { width: 1, height: 2 },
    allowedEquipmentSlots: ["feet"],
    stackable: false,
    maxStackSize: 1,
    statModifiers: [{ target: "moveSpeed", operation: "add", value: 0.15 }],
    durabilityMax: 20,
    iconKey: "item_sewer_treads_placeholder"
  },
  {
    id: itemId("scrapcord_belt"),
    nameKey: "item.scrapcord_belt.name" as ContentLocalizationKey,
    descriptionKey: "item.scrapcord_belt.description" as ContentLocalizationKey,
    category: "belt",
    rarity: "common",
    size: { width: 2, height: 1 },
    allowedEquipmentSlots: ["belt"],
    stackable: false,
    maxStackSize: 1,
    statModifiers: [{ target: "toughness", operation: "add", value: 1 }],
    durabilityMax: 20,
    iconKey: "item_scrapcord_belt_placeholder"
  },
  {
    id: itemId("signal_scarred_amulet"),
    nameKey: "item.signal_scarred_amulet.name" as ContentLocalizationKey,
    descriptionKey: "item.signal_scarred_amulet.description" as ContentLocalizationKey,
    category: "accessory",
    rarity: "rare",
    size: { width: 1, height: 1 },
    allowedEquipmentSlots: ["amulet"],
    stackable: false,
    maxStackSize: 1,
    statModifiers: [{ target: "mind", operation: "add", value: 2 }],
    durabilityMax: 20,
    iconKey: "item_signal_scarred_amulet_placeholder"
  },

  // ── Core 0.7 — epic tier, weapon/armor. Every entry below combines
  // stat modifiers in a way no existing item does (see the 0.7 plan's
  // item table for the per-item rationale). Blackwire-family items lean
  // heavy/toughness; Static Yard-family items lean speed/mind/utility,
  // matching each zone's established loot identity. Epic items are
  // drop-only — deliberately absent from vendorStocks.ts. ──
  {
    id: itemId("condemned_cleaver"),
    nameKey: "item.condemned_cleaver.name" as ContentLocalizationKey,
    descriptionKey: "item.condemned_cleaver.description" as ContentLocalizationKey,
    category: "weapon",
    rarity: "epic",
    size: { width: 1, height: 3 },
    allowedEquipmentSlots: ["weapon"],
    stackable: false,
    maxStackSize: 1,
    statModifiers: [
      { target: "damage", operation: "add", value: 7 },
      { target: "attackCooldownMs", operation: "add", value: 70 }
    ],
    durabilityMax: 20,
    iconKey: "item_condemned_cleaver_placeholder"
  },
  {
    id: itemId("warden_plate"),
    nameKey: "item.warden_plate.name" as ContentLocalizationKey,
    descriptionKey: "item.warden_plate.description" as ContentLocalizationKey,
    category: "armor",
    rarity: "epic",
    size: { width: 2, height: 3 },
    allowedEquipmentSlots: ["chest"],
    stackable: false,
    maxStackSize: 1,
    statModifiers: [
      { target: "armor", operation: "add", value: 5 },
      { target: "maxHp", operation: "add", value: 15 }
    ],
    durabilityMax: 20,
    iconKey: "item_warden_plate_placeholder"
  },
  {
    id: itemId("scavenger_king_helm"),
    nameKey: "item.scavenger_king_helm.name" as ContentLocalizationKey,
    descriptionKey: "item.scavenger_king_helm.description" as ContentLocalizationKey,
    category: "armor",
    rarity: "epic",
    size: { width: 1, height: 1 },
    allowedEquipmentSlots: ["head"],
    stackable: false,
    maxStackSize: 1,
    statModifiers: [
      { target: "armor", operation: "add", value: 3 },
      { target: "toughness", operation: "add", value: 2 }
    ],
    durabilityMax: 20,
    iconKey: "item_scavenger_king_helm_placeholder"
  },
  {
    id: itemId("livewire_lance"),
    nameKey: "item.livewire_lance.name" as ContentLocalizationKey,
    descriptionKey: "item.livewire_lance.description" as ContentLocalizationKey,
    category: "weapon",
    rarity: "epic",
    size: { width: 1, height: 3 },
    allowedEquipmentSlots: ["weapon"],
    stackable: false,
    maxStackSize: 1,
    statModifiers: [
      { target: "damage", operation: "add", value: 4 },
      { target: "attackCooldownMs", operation: "add", value: -70 }
    ],
    durabilityMax: 20,
    iconKey: "item_livewire_lance_placeholder"
  },
  {
    id: itemId("chargeplate_vest"),
    nameKey: "item.chargeplate_vest.name" as ContentLocalizationKey,
    descriptionKey: "item.chargeplate_vest.description" as ContentLocalizationKey,
    category: "armor",
    rarity: "epic",
    size: { width: 2, height: 3 },
    allowedEquipmentSlots: ["chest"],
    stackable: false,
    maxStackSize: 1,
    statModifiers: [
      { target: "mind", operation: "add", value: 3 },
      { target: "moveSpeed", operation: "add", value: 0.12 },
      { target: "armor", operation: "add", value: 1 }
    ],
    durabilityMax: 20,
    iconKey: "item_chargeplate_vest_placeholder"
  },
  {
    id: itemId("static_wraps"),
    nameKey: "item.static_wraps.name" as ContentLocalizationKey,
    descriptionKey: "item.static_wraps.description" as ContentLocalizationKey,
    category: "armor",
    rarity: "epic",
    size: { width: 1, height: 1 },
    allowedEquipmentSlots: ["hands"],
    stackable: false,
    maxStackSize: 1,
    statModifiers: [
      { target: "attackCooldownMs", operation: "add", value: -70 },
      { target: "moveSpeed", operation: "add", value: 0.12 }
    ],
    durabilityMax: 20,
    iconKey: "item_static_wraps_placeholder"
  }
] as const satisfies readonly ItemContentDefinition[];
