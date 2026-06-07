import type { WorldPropContentDefinition } from "./types";

export const worldProps = [
  { id: "nightmarket_crates_01", zoneId: "nightmarket", kind: "crate", label: "Crates", x: 420, y: 380 },
  { id: "nightmarket_lamp_01", zoneId: "nightmarket", kind: "lamp", label: "Lamp", x: 860, y: 520 },
  { id: "nightmarket_rat_01", zoneId: "nightmarket", kind: "ambient_rat", label: "Rat [Neutral]", x: 610, y: 470 },
  { id: "nightmarket_pig_01", zoneId: "nightmarket", kind: "ambient_pig", label: "Pig [Neutral]", x: 1320, y: 760 },
  { id: "nightmarket_chicken_01", zoneId: "nightmarket", kind: "ambient_chicken", label: "Chicken [Neutral]", x: 1730, y: 980 },
  { id: "nightmarket_debris_01", zoneId: "nightmarket", kind: "debris", label: "Sewer Debris", x: 1180, y: 940 },
  { id: "nightmarket_junk_01", zoneId: "nightmarket", kind: "junk", label: "Market Junk", x: 1520, y: 700 },
  { id: "nightmarket_crates_02", zoneId: "nightmarket", kind: "crate", label: "Crates", x: 1890, y: 1120 },
  { id: "nightmarket_loot_container_01", zoneId: "nightmarket", kind: "loot_container", label: "Crate", x: 500, y: 300 },
  { id: "nightmarket_vendor_01", zoneId: "nightmarket", kind: "vendor", label: "Suspicious Vendor", x: 380, y: 600 },
  { id: "nightmarket_stash_keeper_01", zoneId: "nightmarket", kind: "town_service", label: "Stash Keeper", x: 700, y: 620 }
] as const satisfies readonly WorldPropContentDefinition[];
