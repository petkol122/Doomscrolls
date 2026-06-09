import type { WorldPropContentDefinition } from "./types";

export const worldProps = [
  // ── Area labels ──
  { id: "nightmarket_label_services",       zoneId: "nightmarket", kind: "area_label", label: "Nightmarket Services",    x: 260,  y: 280 },
  { id: "nightmarket_label_sewer_approach", zoneId: "nightmarket", kind: "area_label", label: "Sewer Approach",          x: 1100, y: 900 },
  { id: "nightmarket_label_skitter_pocket", zoneId: "nightmarket", kind: "area_label", label: "Skitter Warren",          x: 1600, y: 1200 },
  { id: "nightmarket_label_sewer_edge",     zoneId: "nightmarket", kind: "area_label", label: "Blackwire Sewer Edge",    x: 1950, y: 1500 },
  { id: "nightmarket_label_deep_sewer",     zoneId: "nightmarket", kind: "area_label", label: "Deep Sewer Edge",         x: 2900, y: 2400 },

  // ── Region 1: Spawn/service cluster (compact, near player start ~160,160) ──
  { id: "nightmarket_notice_board_01", zoneId: "nightmarket", kind: "town_service", label: "Notice Board",      x: 200, y: 180 },
  { id: "nightmarket_vendor_01",         zoneId: "nightmarket", kind: "vendor",        label: "Suspicious Vendor",  x: 280, y: 280 },
  { id: "nightmarket_stash_keeper_01",   zoneId: "nightmarket", kind: "town_service",  label: "Stash Keeper",       x: 350, y: 250 },
  { id: "nightmarket_trainer_01",        zoneId: "nightmarket", kind: "town_service",  label: "Trainer",            x: 350, y: 330 },
  { id: "nightmarket_waypoint_01",      zoneId: "nightmarket", kind: "waypoint",      label: "Waypoint",          x: 270, y: 370 },
  { id: "nightmarket_crates_01",         zoneId: "nightmarket", kind: "crate",         label: "Market Crates",     x: 150, y: 250 },
  { id: "nightmarket_loot_container_01", zoneId: "nightmarket", kind: "loot_container",label: "Crate",             x: 210, y: 340 },
  { id: "nightmarket_junk_01",           zoneId: "nightmarket", kind: "junk",          label: "Market Junk",       x: 420, y: 380 },

  // ── Path markers: service cluster → skitter pocket (extended) ──
  { id: "nightmarket_path_01", zoneId: "nightmarket", kind: "path_marker", label: "", x: 500,  y: 450 },
  { id: "nightmarket_path_02", zoneId: "nightmarket", kind: "path_marker", label: "", x: 650,  y: 560 },
  { id: "nightmarket_path_03", zoneId: "nightmarket", kind: "path_marker", label: "", x: 800,  y: 680 },
  { id: "nightmarket_path_04", zoneId: "nightmarket", kind: "path_marker", label: "", x: 960,  y: 790 },
  { id: "nightmarket_path_05", zoneId: "nightmarket", kind: "path_marker", label: "", x: 1120, y: 910 },
  { id: "nightmarket_path_10", zoneId: "nightmarket", kind: "path_marker", label: "", x: 1280, y: 1020 },

  // ── Region 2: Extended mid travel space ──
  { id: "nightmarket_lamp_01",  zoneId: "nightmarket", kind: "lamp",  label: "Lamp",              x: 600,  y: 550 },
  { id: "nightmarket_pig_01",   zoneId: "nightmarket", kind: "ambient_pig", label: "Pig [Neutral]", x: 750, y: 600 },
  { id: "nightmarket_lamp_02",  zoneId: "nightmarket", kind: "lamp",  label: "Lamp",              x: 900,  y: 750 },
  { id: "nightmarket_crates_03",zoneId: "nightmarket", kind: "crate", label: "Roadside Crates",    x: 960, y: 860 },
  { id: "nightmarket_lamp_05",  zoneId: "nightmarket", kind: "lamp",  label: "Lamp",              x: 1200, y: 980 },
  { id: "nightmarket_crates_05",zoneId: "nightmarket", kind: "crate", label: "Abandoned Cart",    x: 1300, y: 1050 },

  // ── Path markers: skitter pocket → sewer edge (Runt zone) ──
  { id: "nightmarket_path_11", zoneId: "nightmarket", kind: "path_marker", label: "", x: 1450, y: 1150 },
  { id: "nightmarket_path_12", zoneId: "nightmarket", kind: "path_marker", label: "", x: 1600, y: 1280 },
  { id: "nightmarket_path_13", zoneId: "nightmarket", kind: "path_marker", label: "", x: 1750, y: 1400 },

  // ── Path markers: sewer edge → deep sewer (Brute zone) ──
  { id: "nightmarket_path_06", zoneId: "nightmarket", kind: "path_marker", label: "", x: 2200, y: 1750 },
  { id: "nightmarket_path_07", zoneId: "nightmarket", kind: "path_marker", label: "", x: 2400, y: 1900 },
  { id: "nightmarket_path_08", zoneId: "nightmarket", kind: "path_marker", label: "", x: 2600, y: 2050 },
  { id: "nightmarket_path_09", zoneId: "nightmarket", kind: "path_marker", label: "", x: 2800, y: 2200 },

  // ── Region 3: Skitter pocket ──
  { id: "nightmarket_sewer_edge_marker_00", zoneId: "nightmarket", kind: "combat_edge", label: "→ Skitter Warren", x: 1500, y: 1100 },
  { id: "nightmarket_sewer_debris_00",      zoneId: "nightmarket", kind: "debris",      label: "Sewer Rubble",     x: 1540, y: 1150 },
  { id: "nightmarket_junk_03",              zoneId: "nightmarket", kind: "junk",        label: "Skitter Refuse",  x: 1680, y: 1300 },

  // ── Region 4: Runt combat pocket (first main sewer edge) ──
  { id: "nightmarket_sewer_edge_marker_01", zoneId: "nightmarket", kind: "combat_edge", label: "→ Blackwire Sewer Edge", x: 1900, y: 1480 },
  { id: "nightmarket_sewer_debris_01",      zoneId: "nightmarket", kind: "debris",      label: "Sewer Edge Debris",     x: 1860, y: 1450 },
  { id: "nightmarket_junk_02",              zoneId: "nightmarket", kind: "junk",        label: "Scrap Pile",           x: 2000, y: 1580 },
  { id: "nightmarket_debris_03",            zoneId: "nightmarket", kind: "debris",      label: "Sewer Rubble",         x: 2100, y: 1700 },

  // ── Region 5: Brute combat area (deep sewer edge) ──
  { id: "nightmarket_lamp_03",              zoneId: "nightmarket", kind: "lamp",        label: "Lamp",                 x: 2400, y: 1900 },
  { id: "nightmarket_sewer_edge_marker_02", zoneId: "nightmarket", kind: "combat_edge", label: "→ Blackwire Deep Edge", x: 2700, y: 2200 },
  { id: "nightmarket_sewer_debris_02",      zoneId: "nightmarket", kind: "debris",      label: "Sewer Edge Debris",    x: 2650, y: 2150 },
  { id: "nightmarket_crates_04",            zoneId: "nightmarket", kind: "crate",       label: "Abandoned Crates",     x: 2900, y: 2400 },
  { id: "nightmarket_debris_04",            zoneId: "nightmarket", kind: "debris",      label: "Deep Rubble",          x: 3100, y: 2500 },

  // ── Region 6: Far filler beyond combat areas ──
  { id: "nightmarket_lamp_04",    zoneId: "nightmarket", kind: "lamp",            label: "Lamp",               x: 3500, y: 2700 },
  { id: "nightmarket_crates_02",  zoneId: "nightmarket", kind: "crate",           label: "Crates",             x: 3700, y: 2900 },
  { id: "nightmarket_chicken_01", zoneId: "nightmarket", kind: "ambient_chicken", label: "Chicken [Neutral]",  x: 3400, y: 2600 },
  { id: "nightmarket_junk_04",    zoneId: "nightmarket", kind: "junk",            label: "Junk",               x: 4000, y: 3100 },
] as const satisfies readonly WorldPropContentDefinition[];