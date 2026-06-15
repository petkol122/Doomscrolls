import type { WorldPropContentDefinition } from "./types";

export const worldProps = [
  // ── Area labels ──
  { id: "nightmarket_label_services",       zoneId: "nightmarket", kind: "area_label", label: "Nightmarket Services",    labelKey: "world_prop.area.nightmarket_services.label", x: 430,  y: 360 },
  { id: "nightmarket_label_sewer_approach", zoneId: "nightmarket", kind: "area_label", label: "Sewer Approach",          labelKey: "world_prop.area.sewer_approach.label",       x: 1550, y: 1220 },
  { id: "nightmarket_label_skitter_pocket", zoneId: "nightmarket", kind: "area_label", label: "Skitter Warren",          labelKey: "world_prop.area.skitter_warren.label",       x: 2280, y: 1620 },
  { id: "nightmarket_label_sewer_edge",     zoneId: "nightmarket", kind: "area_label", label: "Blackwire Sewer Edge",    labelKey: "world_prop.area.blackwire_sewer_edge.label", x: 3020, y: 2200 },
  { id: "nightmarket_label_deep_sewer",     zoneId: "nightmarket", kind: "area_label", label: "Deep Sewer Edge",         labelKey: "world_prop.area.deep_sewer_edge.label",      x: 3950, y: 2920 },

  // ── Safe-area boundary markers (visual ring around service cluster) ──
  { id: "nightmarket_safe_nw", zoneId: "nightmarket", kind: "safe_area_marker", label: "", x: 110, y: 120 },
  { id: "nightmarket_safe_ne", zoneId: "nightmarket", kind: "safe_area_marker", label: "", x: 760, y: 120 },
  { id: "nightmarket_safe_e",  zoneId: "nightmarket", kind: "safe_area_marker", label: "", x: 890, y: 360 },
  { id: "nightmarket_safe_se", zoneId: "nightmarket", kind: "safe_area_marker", label: "", x: 760, y: 620 },
  { id: "nightmarket_safe_sw", zoneId: "nightmarket", kind: "safe_area_marker", label: "", x: 110, y: 620 },
  { id: "nightmarket_safe_w",  zoneId: "nightmarket", kind: "safe_area_marker", label: "", x: 20,  y: 360 },
  { id: "nightmarket_safe_label_n", zoneId: "nightmarket", kind: "safe_area_marker", label: "Safe Area", labelKey: "world_prop.safe_area.label", x: 435, y: 95 },
  { id: "nightmarket_safe_label_s", zoneId: "nightmarket", kind: "safe_area_marker", label: "Safe Area", labelKey: "world_prop.safe_area.label", x: 435, y: 650 },

  // ── Region 1: Spawn/service cluster (expanded into a larger hub footprint) ──
  { id: "nightmarket_notice_board_01", zoneId: "nightmarket", kind: "town_service", label: "Notice Board",      labelKey: "world_prop.notice_board.label",      x: 190, y: 235 },
  { id: "nightmarket_vendor_01",         zoneId: "nightmarket", kind: "vendor",        label: "Suspicious Vendor",  labelKey: "world_prop.suspicious_vendor.label",  x: 335, y: 350 },
  { id: "nightmarket_stash_keeper_01",   zoneId: "nightmarket", kind: "town_service",  label: "Stash Keeper",       labelKey: "world_prop.stash_keeper.label",       x: 570, y: 250 },
  { id: "nightmarket_trainer_01",        zoneId: "nightmarket", kind: "town_service",  label: "Trainer",            labelKey: "world_prop.trainer.label",            x: 660, y: 445 },
  { id: "nightmarket_waypoint_01",      zoneId: "nightmarket", kind: "waypoint",      label: "Waypoint",          labelKey: "world_prop.waypoint.label",           x: 435, y: 540 },
  { id: "nightmarket_blackwire_gate_01", zoneId: "nightmarket", kind: "town_service", label: "Blackwire Gate", labelKey: "world_prop.blackwire_gate.label" as never, x: 735, y: 560 },
  { id: "nightmarket_crates_01",         zoneId: "nightmarket", kind: "crate",         label: "Market Crates",     labelKey: "world_prop.market_crates.label",      x: 110, y: 355 },
  { id: "nightmarket_loot_container_01", zoneId: "nightmarket", kind: "loot_container",label: "Crate",             labelKey: "world_prop.crate.label",              x: 205, y: 510 },
  { id: "nightmarket_junk_01",           zoneId: "nightmarket", kind: "junk",          label: "Market Junk",       labelKey: "world_prop.market_junk.label",        x: 785, y: 350 },

  // ── Path markers: service cluster → skitter pocket (extended) ──
  { id: "nightmarket_path_01", zoneId: "nightmarket", kind: "path_marker", label: "", x: 720,  y: 660 },
  { id: "nightmarket_path_02", zoneId: "nightmarket", kind: "path_marker", label: "", x: 930,  y: 820 },
  { id: "nightmarket_path_03", zoneId: "nightmarket", kind: "path_marker", label: "", x: 1140, y: 980 },
  { id: "nightmarket_path_04", zoneId: "nightmarket", kind: "path_marker", label: "", x: 1350, y: 1120 },
  { id: "nightmarket_path_05", zoneId: "nightmarket", kind: "path_marker", label: "", x: 1560, y: 1260 },
  { id: "nightmarket_path_10", zoneId: "nightmarket", kind: "path_marker", label: "", x: 1780, y: 1400 },

  // ── Region 2: Extended mid travel space ──
  { id: "nightmarket_lamp_01",  zoneId: "nightmarket", kind: "lamp",  label: "Lamp",              labelKey: "world_prop.lamp.label",             x: 860,  y: 720 },
  { id: "nightmarket_pig_01",   zoneId: "nightmarket", kind: "ambient_pig", label: "Pig [Neutral]", labelKey: "world_prop.pig_neutral.label",     x: 1160, y: 820 },
  { id: "nightmarket_lamp_02",  zoneId: "nightmarket", kind: "lamp",  label: "Lamp",              labelKey: "world_prop.lamp.label",             x: 1420, y: 1050 },
  { id: "nightmarket_crates_03",zoneId: "nightmarket", kind: "crate", label: "Roadside Crates",    labelKey: "world_prop.roadside_crates.label", x: 1500, y: 1180 },
  { id: "nightmarket_lamp_05",  zoneId: "nightmarket", kind: "lamp",  label: "Lamp",              labelKey: "world_prop.lamp.label",             x: 1760, y: 1340 },
  { id: "nightmarket_crates_05",zoneId: "nightmarket", kind: "crate", label: "Abandoned Cart",    labelKey: "world_prop.abandoned_cart.label",  x: 1920, y: 1460 },

  // ── Path markers: skitter pocket → sewer edge (Runt zone) ──
  { id: "nightmarket_path_11", zoneId: "nightmarket", kind: "path_marker", label: "", x: 2180, y: 1540 },
  { id: "nightmarket_path_12", zoneId: "nightmarket", kind: "path_marker", label: "", x: 2420, y: 1740 },
  { id: "nightmarket_path_13", zoneId: "nightmarket", kind: "path_marker", label: "", x: 2680, y: 1960 },

  // ── Path markers: sewer edge → deep sewer (Brute zone) ──
  { id: "nightmarket_path_06", zoneId: "nightmarket", kind: "path_marker", label: "", x: 3320, y: 2380 },
  { id: "nightmarket_path_07", zoneId: "nightmarket", kind: "path_marker", label: "", x: 3560, y: 2560 },
  { id: "nightmarket_path_08", zoneId: "nightmarket", kind: "path_marker", label: "", x: 3800, y: 2740 },
  { id: "nightmarket_path_09", zoneId: "nightmarket", kind: "path_marker", label: "", x: 4040, y: 2920 },

  // ── Ambient rats between service cluster and skitter pocket ──
  { id: "nightmarket_rat_01", zoneId: "nightmarket", kind: "ambient_rat", label: "Sewer Rat [Neutral]", labelKey: "world_prop.sewer_rat_neutral.label", x: 2010, y: 1460 },
  { id: "nightmarket_rat_02", zoneId: "nightmarket", kind: "ambient_rat", label: "Sewer Rat [Neutral]", labelKey: "world_prop.sewer_rat_neutral.label", x: 2120, y: 1550 },

  // ── Region 3: Skitter pocket ──
  { id: "nightmarket_sewer_edge_marker_00", zoneId: "nightmarket", kind: "combat_edge", label: "→ Skitter Warren",     labelKey: "world_prop.edge_skitter.label",          x: 2240, y: 1600 },
  { id: "nightmarket_sewer_debris_00",      zoneId: "nightmarket", kind: "debris",      label: "Sewer Rubble",          labelKey: "world_prop.sewer_rubble.label",           x: 2320, y: 1670 },
  { id: "nightmarket_junk_03",              zoneId: "nightmarket", kind: "junk",        label: "Skitter Refuse",        labelKey: "world_prop.skitter_refuse.label",         x: 2470, y: 1810 },

  // ── Region 4: Runt combat pocket (first main sewer edge) ──
  { id: "nightmarket_sewer_edge_marker_01", zoneId: "nightmarket", kind: "combat_edge", label: "→ Blackwire Sewer Edge", labelKey: "world_prop.edge_blackwire_sewer.label", x: 3000, y: 2190 },
  { id: "nightmarket_waypoint_blackwire_combat_edge", zoneId: "nightmarket", kind: "waypoint", label: "Blackwire Waypoint", labelKey: "world_prop.blackwire_waypoint.label" as never, x: 3045, y: 2260 },
  { id: "nightmarket_blackwire_return_01", zoneId: "nightmarket", kind: "combat_edge", label: "← Return to Nightmarket Services", labelKey: "world_prop.return_nightmarket_services.label" as never, x: 2890, y: 2260 },
  { id: "nightmarket_sewer_debris_01",      zoneId: "nightmarket", kind: "debris",      label: "Sewer Edge Debris",      labelKey: "world_prop.sewer_edge_debris.label",    x: 2940, y: 2140 },
  { id: "nightmarket_junk_02",              zoneId: "nightmarket", kind: "junk",        label: "Scrap Pile",             labelKey: "world_prop.scrap_pile.label",            x: 3160, y: 2310 },
  { id: "nightmarket_debris_03",            zoneId: "nightmarket", kind: "debris",      label: "Sewer Rubble",           labelKey: "world_prop.sewer_rubble.label",          x: 3300, y: 2440 },

  // ── Region 5: Brute combat area (deep sewer edge) ──
  { id: "nightmarket_lamp_03",              zoneId: "nightmarket", kind: "lamp",        label: "Lamp",                   labelKey: "world_prop.lamp.label",                  x: 3460, y: 2550 },
  { id: "nightmarket_sewer_edge_marker_02", zoneId: "nightmarket", kind: "combat_edge", label: "→ Blackwire Deep Edge",  labelKey: "world_prop.edge_blackwire_deep.label",   x: 3900, y: 2890 },
  { id: "nightmarket_sewer_debris_02",      zoneId: "nightmarket", kind: "debris",      label: "Sewer Edge Debris",      labelKey: "world_prop.sewer_edge_debris.label",     x: 3820, y: 2830 },
  { id: "nightmarket_crates_04",            zoneId: "nightmarket", kind: "crate",       label: "Abandoned Crates",       labelKey: "world_prop.abandoned_crates.label",      x: 4160, y: 3050 },
  { id: "nightmarket_debris_04",            zoneId: "nightmarket", kind: "debris",      label: "Deep Rubble",            labelKey: "world_prop.deep_rubble.label",           x: 4360, y: 3190 },

  // ── Region 6: Far filler beyond combat areas ──
  { id: "nightmarket_lamp_04",    zoneId: "nightmarket", kind: "lamp",            label: "Lamp",               labelKey: "world_prop.lamp.label",             x: 4480, y: 3180 },
  { id: "nightmarket_crates_02",  zoneId: "nightmarket", kind: "crate",           label: "Crates",             labelKey: "world_prop.crates.label",           x: 4580, y: 3320 },
  { id: "nightmarket_chicken_01", zoneId: "nightmarket", kind: "ambient_chicken", label: "Chicken [Neutral]",  labelKey: "world_prop.chicken_neutral.label",  x: 4280, y: 3090 },
  { id: "nightmarket_junk_04",    zoneId: "nightmarket", kind: "junk",            label: "Junk",               labelKey: "world_prop.junk.label",             x: 4780, y: 3420 },

  // ── World boundary markers (north edge, y ≈ 0) ──
  { id: "nightmarket_boundary_nw_01",  zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 400,  y: 60 },
  { id: "nightmarket_boundary_nw_02",  zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 900,  y: 60 },
  { id: "nightmarket_boundary_n_01",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 1600, y: 60 },
  { id: "nightmarket_boundary_n_02",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 2400, y: 60 },
  { id: "nightmarket_boundary_n_03",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 3200, y: 60 },
  { id: "nightmarket_boundary_n_04",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 4000, y: 60 },
  { id: "nightmarket_boundary_n_05",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 4600, y: 60 },

  // ── World boundary markers (east edge, x ≈ 5000) ──
  { id: "nightmarket_boundary_e_01",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 4900, y: 500 },
  { id: "nightmarket_boundary_e_02",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 4900, y: 1100 },
  { id: "nightmarket_boundary_e_03",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 4900, y: 1700 },
  { id: "nightmarket_boundary_e_04",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 4900, y: 2300 },
  { id: "nightmarket_boundary_e_05",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 4900, y: 2900 },

  // ── World boundary markers (south edge, y ≈ 3600) ──
  { id: "nightmarket_boundary_se_01",  zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 600,  y: 3500 },
  { id: "nightmarket_boundary_se_02",  zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 1400, y: 3500 },
  { id: "nightmarket_boundary_s_01",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 2200, y: 3500 },
  { id: "nightmarket_boundary_s_02",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 3000, y: 3500 },
  { id: "nightmarket_boundary_s_03",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 3800, y: 3500 },
  { id: "nightmarket_boundary_s_04",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 4600, y: 3500 },

  // ── World boundary markers (west edge, x ≈ 0) ──
  { id: "nightmarket_boundary_w_01",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 60,   y: 800 },
  { id: "nightmarket_boundary_w_02",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 60,   y: 1600 },
  { id: "nightmarket_boundary_w_03",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 60,   y: 2400 },
  { id: "nightmarket_boundary_w_04",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 60,   y: 3200 },

  // ── Task 303: Physical town rest/replenish area markers ──
  // Visual corners marking the rectangular replenish zone around the
  // Nightmarket service cluster (coincides with zone restAreaBounds).
  { id: "nightmarket_rest_nw", zoneId: "nightmarket", kind: "rest_area_marker", label: "Rest Area", labelKey: "world_prop.rest_area.label", x: 90,  y: 130 },
  { id: "nightmarket_rest_ne", zoneId: "nightmarket", kind: "rest_area_marker", label: "Rest Area", labelKey: "world_prop.rest_area.label", x: 780, y: 130 },
  { id: "nightmarket_rest_se", zoneId: "nightmarket", kind: "rest_area_marker", label: "Rest Area", labelKey: "world_prop.rest_area.label", x: 780, y: 600 },
  { id: "nightmarket_rest_sw", zoneId: "nightmarket", kind: "rest_area_marker", label: "Rest Area", labelKey: "world_prop.rest_area.label", x: 90,  y: 600 },
  { id: "nightmarket_rest_label", zoneId: "nightmarket", kind: "rest_area_marker", label: "Rest Area", labelKey: "world_prop.rest_area.label", x: 435, y: 335 },
] as const satisfies readonly WorldPropContentDefinition[];
