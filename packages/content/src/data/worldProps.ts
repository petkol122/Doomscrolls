import type { WorldPropContentDefinition } from "./types";

export const worldProps = [
  // ── Area labels ──
  { id: "nightmarket_label_services",     zoneId: "nightmarket", kind: "area_label", label: "Nightmarket Services",  x: 260, y: 280 },
  { id: "nightmarket_label_sewer_edge",   zoneId: "nightmarket", kind: "area_label", label: "Blackwire Sewer Edge", x: 1400, y: 1100 },
  { id: "nightmarket_label_deep_sewer",   zoneId: "nightmarket", kind: "area_label", label: "Deep Sewer Edge",       x: 2100, y: 1700 },

  // ── Region 1: Spawn/service cluster (compact, near player start ~160,160) ──
  { id: "nightmarket_notice_board_01", zoneId: "nightmarket", kind: "town_service", label: "Notice Board", x: 200, y: 180 },
  { id: "nightmarket_vendor_01",         zoneId: "nightmarket", kind: "vendor",        label: "Suspicious Vendor",  x: 280, y: 280 },
  { id: "nightmarket_stash_keeper_01",   zoneId: "nightmarket", kind: "town_service",  label: "Stash Keeper",       x: 350, y: 250 },
  { id: "nightmarket_trainer_01",        zoneId: "nightmarket", kind: "town_service",  label: "Trainer",            x: 350, y: 330 },
  { id: "nightmarket_waypoint_01",      zoneId: "nightmarket", kind: "waypoint",      label: "Waypoint",          x: 270, y: 370 },
  { id: "nightmarket_crates_01",         zoneId: "nightmarket", kind: "crate",         label: "Market Crates",     x: 150, y: 250 },
  { id: "nightmarket_loot_container_01", zoneId: "nightmarket", kind: "loot_container",label: "Crate",             x: 210, y: 340 },
  { id: "nightmarket_junk_01",           zoneId: "nightmarket", kind: "junk",          label: "Market Junk",       x: 420, y: 380 },

  // ── Region 2: Mid travel space (empty path toward sewer edge) ──
  { id: "nightmarket_lamp_01",  zoneId: "nightmarket", kind: "lamp",  label: "Lamp",         x: 600,  y: 550 },
  { id: "nightmarket_pig_01",   zoneId: "nightmarket", kind: "ambient_pig", label: "Pig [Neutral]", x: 750, y: 600 },
  { id: "nightmarket_lamp_02",  zoneId: "nightmarket", kind: "lamp",  label: "Lamp",         x: 900,  y: 750 },
  { id: "nightmarket_crates_03",zoneId: "nightmarket", kind: "crate", label: "Roadside Crates", x: 950, y: 850 },

  // ── Region 3: First sewer edge combat pocket ──
  { id: "nightmarket_sewer_edge_marker_01", zoneId: "nightmarket", kind: "combat_edge", label: "→ Blackwire Sewer Edge", x: 1300, y: 1000 },
  { id: "nightmarket_sewer_debris_01",      zoneId: "nightmarket", kind: "debris",      label: "Sewer Edge Debris",     x: 1280, y: 1020 },
  { id: "nightmarket_junk_02",              zoneId: "nightmarket", kind: "junk",        label: "Scrap Pile",           x: 1420, y: 1120 },
  { id: "nightmarket_debris_03",            zoneId: "nightmarket", kind: "debris",      label: "Sewer Rubble",         x: 1500, y: 1200 },

  // ── Region 4: Deeper Brute combat area ──
  { id: "nightmarket_lamp_03",              zoneId: "nightmarket", kind: "lamp",        label: "Lamp",                 x: 1800, y: 1400 },
  { id: "nightmarket_sewer_edge_marker_02", zoneId: "nightmarket", kind: "combat_edge", label: "→ Blackwire Deep Edge", x: 2000, y: 1600 },
  { id: "nightmarket_sewer_debris_02",      zoneId: "nightmarket", kind: "debris",      label: "Sewer Edge Debris",    x: 1980, y: 1620 },
  { id: "nightmarket_crates_04",            zoneId: "nightmarket", kind: "crate",       label: "Abandoned Crates",     x: 2100, y: 1700 },
  { id: "nightmarket_debris_04",            zoneId: "nightmarket", kind: "debris",      label: "Deep Rubble",          x: 2300, y: 1800 },

  // ── Region 5: Far filler beyond combat areas ──
  { id: "nightmarket_lamp_04",    zoneId: "nightmarket", kind: "lamp",            label: "Lamp",               x: 2800, y: 1900 },
  { id: "nightmarket_crates_02",  zoneId: "nightmarket", kind: "crate",           label: "Crates",             x: 2900, y: 2000 },
  { id: "nightmarket_chicken_01", zoneId: "nightmarket", kind: "ambient_chicken", label: "Chicken [Neutral]",  x: 2600, y: 1850 },
  { id: "nightmarket_junk_04",    zoneId: "nightmarket", kind: "junk",            label: "Junk",               x: 3100, y: 2100 },
] as const satisfies readonly WorldPropContentDefinition[];
