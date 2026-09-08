import type { WorldPropContentDefinition } from "./types";

// Core 0.33 — Nightmarket Real City-Center Expansion. Every nightmarket-zoned
// prop below was relocated from the old 5000x3600 placeholder box onto the
// real Plzen historic-center footprint (0-19080 x 0-19613, see zones.ts),
// via the systematic transforms documented in docs/CORE_BUILD_0_33_PLAN.md
// Question 3 (a hub per-axis scale, a Blackwire-corridor similarity
// transform, a whole-zone boundary rescale, and three rigid gate-cluster
// translations) -- not by hand, and not by guessing. Only x/y changed on
// any prop; every id, kind, label, and labelKey is exactly as before.

export const worldProps = [
  // ── Area labels ──
  { id: "nightmarket_label_services",       zoneId: "nightmarket", kind: "area_label", label: "Nightmarket Services",    labelKey: "world_prop.area.nightmarket_services.label", x: 9031,  y: 11215 },
  { id: "nightmarket_label_sewer_approach", zoneId: "nightmarket", kind: "area_label", label: "Sewer Approach",          labelKey: "world_prop.area.sewer_approach.label",       x: 7861, y: 12437 },
  { id: "nightmarket_label_skitter_pocket", zoneId: "nightmarket", kind: "area_label", label: "Skitter Warren",          labelKey: "world_prop.area.skitter_warren.label",       x: 7089, y: 13746 },
  { id: "nightmarket_label_sewer_edge",     zoneId: "nightmarket", kind: "area_label", label: "Blackwire Sewer Edge",    labelKey: "world_prop.area.blackwire_sewer_edge.label", x: 5989, y: 15062 },
  { id: "nightmarket_label_deep_sewer",     zoneId: "nightmarket", kind: "area_label", label: "Deep Sewer Edge",         labelKey: "world_prop.area.deep_sewer_edge.label",      x: 4622, y: 16718 },

  // ── Safe-area boundary markers (visual ring around service cluster) ──
  { id: "nightmarket_safe_nw", zoneId: "nightmarket", kind: "safe_area_marker", label: "", x: 7751, y: 9398 },
  { id: "nightmarket_safe_ne", zoneId: "nightmarket", kind: "safe_area_marker", label: "", x: 10351, y: 9398 },
  { id: "nightmarket_safe_e",  zoneId: "nightmarket", kind: "safe_area_marker", label: "", x: 10871, y: 11215 },
  { id: "nightmarket_safe_se", zoneId: "nightmarket", kind: "safe_area_marker", label: "", x: 10351, y: 13184 },
  { id: "nightmarket_safe_sw", zoneId: "nightmarket", kind: "safe_area_marker", label: "", x: 7751, y: 13184 },
  { id: "nightmarket_safe_w",  zoneId: "nightmarket", kind: "safe_area_marker", label: "", x: 7391,  y: 11215 },
  { id: "nightmarket_safe_label_n", zoneId: "nightmarket", kind: "safe_area_marker", label: "Safe Area", labelKey: "world_prop.safe_area.label", x: 9051, y: 9208 },
  { id: "nightmarket_safe_label_s", zoneId: "nightmarket", kind: "safe_area_marker", label: "Safe Area", labelKey: "world_prop.safe_area.label", x: 9051, y: 13412 },

  // ── Region 1: Spawn/service cluster (real Namesti Republiky footprint) ──
  // Core 0.33 Addendum -- each of these 5 services individually anchored to
  // a real, confirmed hard landmark (see docs/CORE_BUILD_0_33_PLAN.md
  // Question 3 Addendum): Notice Board at the real City Hall, Vendor at a
  // real pawnbroker (a believable flexible-building type, not a claim about
  // that shop's actual use), Stash Keeper at a real confirmed CSOB branch,
  // Trainer at the real cathedral (the hub's own center). Waypoint moves to
  // the real Great Synagogue, genuinely ~350m from the others -- accepted
  // deliberately, not a bug (see docs/WORLD_VISION.md Section 2's
  // "Committed" subsection: faster transport is a real future direction,
  // and there are no live players yet to feel this distance today).
  { id: "nightmarket_notice_board_01", zoneId: "nightmarket", kind: "town_service", label: "Notice Board",      labelKey: "world_prop.notice_board.label",      x: 9449, y: 8467 },
  { id: "nightmarket_vendor_01",         zoneId: "nightmarket", kind: "vendor",        label: "Suspicious Vendor",  labelKey: "world_prop.suspicious_vendor.label",  x: 17005, y: 13246 },
  { id: "nightmarket_stash_keeper_01",   zoneId: "nightmarket", kind: "town_service",  label: "Stash Keeper",       labelKey: "world_prop.stash_keeper.label",       x: 10648, y: 13967 },
  // Nudged 200/150 units from the cathedral's exact point to avoid sitting
  // pixel-identical to nightmarket_blackwire_gate_01, which is already
  // anchored there as the Blackwire corridor transform's own origin (see
  // Question 3's Blackwire-corridor similarity transform) -- still
  // immediately at the cathedral in any practical sense (~8m).
  { id: "nightmarket_trainer_01",        zoneId: "nightmarket", kind: "town_service",  label: "Trainer",            labelKey: "world_prop.trainer.label",            x: 9311, y: 10838 },
  { id: "nightmarket_waypoint_01",      zoneId: "nightmarket", kind: "waypoint",      label: "Waypoint",          labelKey: "world_prop.waypoint.label",           x: 173, y: 13323 },
  { id: "nightmarket_blackwire_gate_01", zoneId: "nightmarket", kind: "town_service", label: "Blackwire Gate", labelKey: "world_prop.blackwire_gate.label" as never, x: 9111, y: 10988 },
  { id: "nightmarket_crates_01",         zoneId: "nightmarket", kind: "crate",         label: "Market Crates",     labelKey: "world_prop.market_crates.label",      x: 7751, y: 11177 },
  // lootTableId matches sewer_starter_loot -- the same real table
  // trashboar_runt itself already uses, so this container's actual
  // behavior is unchanged; only the mechanism (real content field, not
  // a hardcoded enemy id used as a stand-in key) is fixed.
  { id: "nightmarket_loot_container_01", zoneId: "nightmarket", kind: "loot_container",label: "Crate",             labelKey: "world_prop.crate.label",              x: 8131, y: 12351, lootTableId: "sewer_starter_loot" },
  { id: "nightmarket_junk_01",           zoneId: "nightmarket", kind: "junk",          label: "Market Junk",       labelKey: "world_prop.market_junk.label",        x: 10451, y: 11139 },

  // ── Path markers: service cluster → skitter pocket (Blackwire corridor, real SW bearing) ──
  { id: "nightmarket_path_01", zoneId: "nightmarket", kind: "path_marker", label: "", x: 8929,  y: 10955 },
  { id: "nightmarket_path_02", zoneId: "nightmarket", kind: "path_marker", label: "", x: 8626,  y: 11329 },
  { id: "nightmarket_path_03", zoneId: "nightmarket", kind: "path_marker", label: "", x: 8322, y: 11703 },
  { id: "nightmarket_path_04", zoneId: "nightmarket", kind: "path_marker", label: "", x: 8054, y: 12078 },
  { id: "nightmarket_path_05", zoneId: "nightmarket", kind: "path_marker", label: "", x: 7787, y: 12453 },
  { id: "nightmarket_path_10", zoneId: "nightmarket", kind: "path_marker", label: "", x: 7519, y: 12846 },

  // ── Region 2: Extended mid travel space ──
  { id: "nightmarket_lamp_01",  zoneId: "nightmarket", kind: "lamp",  label: "Lamp",              labelKey: "world_prop.lamp.label",             x: 8812,  y: 11207 },
  { id: "nightmarket_pig_01",   zoneId: "nightmarket", kind: "ambient_pig", label: "Pig [Neutral]", labelKey: "world_prop.pig_neutral.label",     x: 8612, y: 11748 },
  { id: "nightmarket_lamp_02",  zoneId: "nightmarket", kind: "lamp",  label: "Lamp",              labelKey: "world_prop.lamp.label",             x: 8178, y: 12209 },
  { id: "nightmarket_crates_03",zoneId: "nightmarket", kind: "crate", label: "Roadside Crates",    labelKey: "world_prop.roadside_crates.label", x: 7936, y: 12348 },
  { id: "nightmarket_lamp_05",  zoneId: "nightmarket", kind: "lamp",  label: "Lamp",              labelKey: "world_prop.lamp.label",             x: 7630, y: 12813 },
  { id: "nightmarket_crates_05",zoneId: "nightmarket", kind: "crate", label: "Abandoned Cart",    labelKey: "world_prop.abandoned_cart.label",  x: 7402, y: 13098 },

  // ── Path markers: skitter pocket → sewer edge (Runt zone) ──
  { id: "nightmarket_path_11", zoneId: "nightmarket", kind: "path_marker", label: "", x: 7241, y: 13568 },
  { id: "nightmarket_path_12", zoneId: "nightmarket", kind: "path_marker", label: "", x: 6862, y: 13994 },
  { id: "nightmarket_path_13", zoneId: "nightmarket", kind: "path_marker", label: "", x: 6446, y: 14456 },

  // ── Path markers: sewer edge → deep sewer (Brute zone) ──
  { id: "nightmarket_path_06", zoneId: "nightmarket", kind: "path_marker", label: "", x: 5643, y: 15599 },
  { id: "nightmarket_path_07", zoneId: "nightmarket", kind: "path_marker", label: "", x: 5301, y: 16027 },
  { id: "nightmarket_path_08", zoneId: "nightmarket", kind: "path_marker", label: "", x: 4959, y: 16454 },
  { id: "nightmarket_path_09", zoneId: "nightmarket", kind: "path_marker", label: "", x: 4617, y: 16882 },

  // ── Ambient rats between service cluster and skitter pocket ──
  { id: "nightmarket_rat_01", zoneId: "nightmarket", kind: "ambient_rat", label: "Sewer Rat [Neutral]", labelKey: "world_prop.sewer_rat_neutral.label", x: 7396, y: 13262 },
  { id: "nightmarket_rat_02", zoneId: "nightmarket", kind: "ambient_rat", label: "Sewer Rat [Neutral]", labelKey: "world_prop.sewer_rat_neutral.label", x: 7226, y: 13458 },

  // ── Region 3: Skitter pocket ──
  { id: "nightmarket_sewer_edge_marker_00", zoneId: "nightmarket", kind: "combat_edge", label: "→ Skitter Warren",     labelKey: "world_prop.edge_skitter.label",          x: 7128, y: 13674 },
  { id: "nightmarket_sewer_debris_00",      zoneId: "nightmarket", kind: "debris",      label: "Sewer Rubble",          labelKey: "world_prop.sewer_rubble.label",           x: 6996, y: 13816 },
  { id: "nightmarket_junk_03",              zoneId: "nightmarket", kind: "junk",        label: "Skitter Refuse",        labelKey: "world_prop.skitter_refuse.label",         x: 6732, y: 14081 },

  // ── Region 4: Runt combat pocket (first main sewer edge) ──
  { id: "nightmarket_sewer_edge_marker_01", zoneId: "nightmarket", kind: "combat_edge", label: "→ Blackwire Sewer Edge", labelKey: "world_prop.edge_blackwire_sewer.label", x: 6008, y: 15026 },
  { id: "nightmarket_waypoint_blackwire_combat_edge", zoneId: "nightmarket", kind: "waypoint", label: "Blackwire Waypoint", labelKey: "world_prop.blackwire_waypoint.label" as never, x: 5878, y: 15104 },
  { id: "nightmarket_blackwire_return_01", zoneId: "nightmarket", kind: "combat_edge", label: "← Return to Nightmarket Services", labelKey: "world_prop.return_nightmarket_services.label" as never, x: 5887, y: 14822 },
  { id: "nightmarket_sewer_debris_01",      zoneId: "nightmarket", kind: "debris",      label: "Sewer Edge Debris",      labelKey: "world_prop.sewer_edge_debris.label",    x: 6103, y: 14920 },
  { id: "nightmarket_junk_02",              zoneId: "nightmarket", kind: "junk",        label: "Scrap Pile",             labelKey: "world_prop.scrap_pile.label",            x: 5780, y: 15311 },
  { id: "nightmarket_debris_03",            zoneId: "nightmarket", kind: "debris",      label: "Sewer Rubble",           labelKey: "world_prop.sewer_rubble.label",          x: 5535, y: 15559 },

  // ── Region 5: Brute combat area (deep sewer edge) ──
  { id: "nightmarket_lamp_03",              zoneId: "nightmarket", kind: "lamp",        label: "Lamp",                   labelKey: "world_prop.lamp.label",                  x: 5325, y: 15845 },
  { id: "nightmarket_sewer_edge_marker_02", zoneId: "nightmarket", kind: "combat_edge", label: "→ Blackwire Deep Edge",  labelKey: "world_prop.edge_blackwire_deep.label",   x: 4680, y: 16628 },
  { id: "nightmarket_sewer_debris_02",      zoneId: "nightmarket", kind: "debris",      label: "Sewer Edge Debris",      labelKey: "world_prop.sewer_edge_debris.label",     x: 4794, y: 16486 },
  { id: "nightmarket_crates_04",            zoneId: "nightmarket", kind: "crate",       label: "Abandoned Crates",       labelKey: "world_prop.abandoned_crates.label",      x: 4373, y: 17093 },
  { id: "nightmarket_debris_04",            zoneId: "nightmarket", kind: "debris",      label: "Deep Rubble",            labelKey: "world_prop.deep_rubble.label",           x: 4107, y: 17450 },

  // ── Region 6: Far filler beyond combat areas ──
  { id: "nightmarket_lamp_04",    zoneId: "nightmarket", kind: "lamp",            label: "Lamp",               labelKey: "world_prop.lamp.label",             x: 4118, y: 17669 },
  { id: "nightmarket_crates_02",  zoneId: "nightmarket", kind: "crate",           label: "Crates",             labelKey: "world_prop.crates.label",           x: 3857, y: 17844 },
  { id: "nightmarket_chicken_01", zoneId: "nightmarket", kind: "ambient_chicken", label: "Chicken [Neutral]",  labelKey: "world_prop.chicken_neutral.label",  x: 4294, y: 17310 },
  { id: "nightmarket_junk_04",    zoneId: "nightmarket", kind: "junk",            label: "Junk",               labelKey: "world_prop.junk.label",             x: 3663, y: 18203 },

  // ── World boundary markers (north edge) ──
  { id: "nightmarket_boundary_nw_01",  zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 1526,  y: 327 },
  { id: "nightmarket_boundary_nw_02",  zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 3434,  y: 327 },
  { id: "nightmarket_boundary_n_01",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 6106, y: 327 },
  { id: "nightmarket_boundary_n_02",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 9158, y: 327 },
  { id: "nightmarket_boundary_n_03",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 12211, y: 327 },
  { id: "nightmarket_boundary_n_04",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 15264, y: 327 },
  { id: "nightmarket_boundary_n_05",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 17554, y: 327 },

  // ── World boundary markers (east edge) ──
  { id: "nightmarket_boundary_e_01",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 18698, y: 2724 },
  { id: "nightmarket_boundary_e_02",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 18698, y: 5993 },
  { id: "nightmarket_boundary_e_03",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 18698, y: 9262 },
  { id: "nightmarket_boundary_e_04",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 18698, y: 12531 },
  { id: "nightmarket_boundary_e_05",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 18698, y: 15799 },

  // ── World boundary markers (south edge) ──
  { id: "nightmarket_boundary_se_01",  zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 2290,  y: 19068 },
  { id: "nightmarket_boundary_se_02",  zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 5342,  y: 19068 },
  { id: "nightmarket_boundary_s_01",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 8395, y: 19068 },
  { id: "nightmarket_boundary_s_02",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 11448, y: 19068 },
  { id: "nightmarket_boundary_s_03",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 14501, y: 19068 },
  { id: "nightmarket_boundary_s_04",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 17554, y: 19068 },

  // ── World boundary markers (west edge) ──
  { id: "nightmarket_boundary_w_01",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 229,   y: 4358 },
  { id: "nightmarket_boundary_w_02",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 229,   y: 8717 },
  { id: "nightmarket_boundary_w_03",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 229,   y: 13075 },
  { id: "nightmarket_boundary_w_04",   zoneId: "nightmarket", kind: "boundary_marker", label: "", x: 229,   y: 17434 },

  // ── Task 303: Physical town rest/replenish area markers ──
  // Visual corners marking the rectangular replenish zone around the
  // Nightmarket service cluster (coincides with zone restAreaBounds).
  { id: "nightmarket_rest_nw", zoneId: "nightmarket", kind: "rest_area_marker", label: "Rest Area", labelKey: "world_prop.rest_area.label", x: 7671,  y: 9473 },
  { id: "nightmarket_rest_ne", zoneId: "nightmarket", kind: "rest_area_marker", label: "Rest Area", labelKey: "world_prop.rest_area.label", x: 10431, y: 9473 },
  { id: "nightmarket_rest_se", zoneId: "nightmarket", kind: "rest_area_marker", label: "Rest Area", labelKey: "world_prop.rest_area.label", x: 10431, y: 13033 },
  { id: "nightmarket_rest_sw", zoneId: "nightmarket", kind: "rest_area_marker", label: "Rest Area", labelKey: "world_prop.rest_area.label", x: 7671,  y: 13033 },
  { id: "nightmarket_rest_label", zoneId: "nightmarket", kind: "rest_area_marker", label: "Rest Area", labelKey: "world_prop.rest_area.label", x: 9051, y: 11026 },

  // ── CombatRoom physical return trigger (blackwire_sewers' own local coords, unaffected by Nightmarket's expansion) ──
  { id: "combat_return_to_nightmarket", zoneId: "blackwire_sewers", kind: "combat_return_gate", label: "← Return to Nightmarket", labelKey: "world_prop.combat_return_gate.label" as never, x: 96, y: 520 },

  // ── Core 0.6: Static Yard gate/waypoint — Core 0.33: relocated to Krizikovy sady (real, ESE of the square, named after tram-engineering pioneer Frantisek Krizik) ──
  { id: "nightmarket_label_static_yard_edge", zoneId: "nightmarket", kind: "area_label", label: "Static Yard Edge", labelKey: "world_prop.area.static_yard_edge.label" as never, x: 14501, y: 12968 },
  { id: "nightmarket_static_yard_gate_01", zoneId: "nightmarket", kind: "town_service", label: "Static Yard Gate", labelKey: "world_prop.static_yard_gate.label" as never, x: 14501, y: 12928 },
  { id: "nightmarket_waypoint_static_yard_combat_edge", zoneId: "nightmarket", kind: "waypoint", label: "Static Yard Waypoint", labelKey: "world_prop.static_yard_waypoint.label" as never, x: 14461, y: 12888 },

  // ── Core 0.6: Static Yard CombatRoom physical return trigger (static_yard's own local coords, unaffected) ──
  { id: "static_yard_return_to_nightmarket", zoneId: "static_yard", kind: "combat_return_gate", label: "← Return to Nightmarket", labelKey: "world_prop.combat_return_gate.label" as never, x: 90, y: 460 },

  // ── Core 0.16: Cinderworks gate/waypoint — Core 0.33: relocated to the real north ring segment ──
  { id: "nightmarket_label_cinderworks_edge", zoneId: "nightmarket", kind: "area_label", label: "Cinderworks Edge", labelKey: "world_prop.area.cinderworks_edge.label" as never, x: 8799, y: 340 },
  { id: "nightmarket_cinderworks_gate_01", zoneId: "nightmarket", kind: "town_service", label: "Cinderworks Gate", labelKey: "world_prop.cinderworks_gate.label" as never, x: 8799, y: 300 },
  { id: "nightmarket_waypoint_cinderworks_combat_edge", zoneId: "nightmarket", kind: "waypoint", label: "Cinderworks Waypoint", labelKey: "world_prop.cinderworks_waypoint.label" as never, x: 8759, y: 260 },

  // ── Core 0.16: Cinderworks CombatRoom physical return trigger (cinderworks' own local coords, unaffected) ──
  { id: "cinderworks_return_to_nightmarket", zoneId: "cinderworks", kind: "combat_return_gate", label: "← Return to Nightmarket", labelKey: "world_prop.combat_return_gate.label" as never, x: 100, y: 440 },

  // ── Core 0.18: Saltmere Docks gate/waypoint — Core 0.33: relocated to the real river/embankment anchor (Anglicke nabrezi / Radbuzska naplavka, SE) ──
  { id: "nightmarket_label_saltmere_docks_edge", zoneId: "nightmarket", kind: "area_label", label: "Saltmere Docks Edge", labelKey: "world_prop.area.saltmere_docks_edge.label" as never, x: 18813, y: 16494 },
  { id: "nightmarket_saltmere_docks_gate_01", zoneId: "nightmarket", kind: "town_service", label: "Saltmere Docks Gate", labelKey: "world_prop.saltmere_docks_gate.label" as never, x: 18813, y: 16434 },
  { id: "nightmarket_waypoint_saltmere_docks_combat_edge", zoneId: "nightmarket", kind: "waypoint", label: "Saltmere Docks Waypoint", labelKey: "world_prop.saltmere_docks_waypoint.label" as never, x: 18773, y: 16394 },

  // ── Core 0.18: Saltmere Docks CombatRoom physical return trigger (saltmere_docks' own local coords, unaffected) ──
  { id: "saltmere_docks_return_to_nightmarket", zoneId: "saltmere_docks", kind: "combat_return_gate", label: "← Return to Nightmarket", labelKey: "world_prop.combat_return_gate.label" as never, x: 100, y: 440 },
] as const satisfies readonly WorldPropContentDefinition[];
