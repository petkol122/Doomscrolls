import type { ZoneId } from "@doomscrolls/shared";
import type { ZoneContentDefinition } from "./types";

const zoneId = (value: string): ZoneId => value as ZoneId;

export const zones = [
  {
    // Core 0.1: nightmarket is test_hybrid because it has enemies despite being a town room.
    // Long-term, towns/villages should be safe_hub with no enemy spawns.
    id: "nightmarket",
    zoneId: zoneId("nightmarket"),
    nameKey: "zone.nightmarket.name",
    descriptionKey: "zone.nightmarket.description",
    roomType: "town",
    classification: "test_hybrid",
    maxPlayers: 30,
    enemyIds: ["trashboar_runt", "trashboar_brute", "trashboar_skitter"],
    transitionZoneIds: ["blackwire_sewers", "static_yard", "cinderworks", "saltmere_docks"],
    mapKey: "map_nightmarket_placeholder",
    bounds: { minX: 0, maxX: 5000, minY: 0, maxY: 3600 },
    // Task 303 / Task 328 — Physical town rest area: enlarged to match the
    // widened Nightmarket spawn/services hub after the spacing pass.
    // Players standing inside this area get HP and healing flask charges
    // restored; bounds intentionally cover the safe/rest marker ring and the
    // expanded service click targets.
    restAreaBounds: { minX: 80, maxX: 780, minY: 120, maxY: 600 }
  },
  {
    id: "blackwire_sewers",
    zoneId: zoneId("blackwire_sewers"),
    nameKey: "zone.blackwire_sewers.name",
    descriptionKey: "zone.blackwire_sewers.description",
    roomType: "combat",
    classification: "combat",
    maxPlayers: 4,
    enemyIds: ["trashboar_runt", "trashboar_skitter", "trashboar_brute"],
    transitionZoneIds: ["nightmarket"],
    mapKey: "map_blackwire_sewers_placeholder",
    bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 }
  },
  {
    // Core 0.6 — Static Yard: the second combat zone. A derelict tram/rail
    // yard adjoining Blackwire's cabling network, reachable from
    // Nightmarket's previously-unused far corner. Bounds intentionally
    // match Blackwire Sewers' shape so the existing CombatRoom entry-box
    // logic (COMBAT_SPAWN_BOX) works unchanged for any combat zone.
    id: "static_yard",
    zoneId: zoneId("static_yard"),
    nameKey: "zone.static_yard.name",
    descriptionKey: "zone.static_yard.description",
    roomType: "combat",
    classification: "combat",
    maxPlayers: 4,
    // Core 0.19 — arc_sentinel replaces the reused trashboar_brute as
    // Static Yard's own heavy anchor; the zone's roster is now fully
    // its own, matching every other combat zone.
    enemyIds: ["static_wretch", "arc_sentinel", "yard_drudge"],
    transitionZoneIds: ["nightmarket"],
    mapKey: "map_static_yard_placeholder",
    bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 }
  },
  {
    // Core 0.16 — Cinderworks: the third combat zone. A scrap-smelting
    // foundry yard reachable from a previously-unused stretch of
    // Nightmarket, north of the existing hub-sewer-yard diagonal. Bounds
    // intentionally match the other two combat zones so the existing
    // CombatRoom entry-box logic (COMBAT_SPAWN_BOX) works unchanged.
    id: "cinderworks",
    zoneId: zoneId("cinderworks"),
    nameKey: "zone.cinderworks.name",
    descriptionKey: "zone.cinderworks.description",
    roomType: "combat",
    classification: "combat",
    maxPlayers: 4,
    enemyIds: ["slag_hound", "foundry_warden", "ash_rat"],
    transitionZoneIds: ["nightmarket"],
    mapKey: "map_cinderworks_placeholder",
    bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 }
  },
  {
    // Core 0.18 — Saltmere Docks: the fourth combat zone. A flooded,
    // salt-corroded dockyard, thematically distinct from sewage
    // (Blackwire), live current (Static Yard) and furnace heat
    // (Cinderworks). Launches with all three enemy roles from day one
    // (unlike Static Yard/Cinderworks, which needed a 0.17 follow-up to
    // reach role parity). Bounds match every other combat zone so
    // COMBAT_SPAWN_BOX works unchanged.
    id: "saltmere_docks",
    zoneId: zoneId("saltmere_docks"),
    nameKey: "zone.saltmere_docks.name",
    descriptionKey: "zone.saltmere_docks.description",
    roomType: "combat",
    classification: "combat",
    maxPlayers: 4,
    enemyIds: ["brine_crawler", "tide_stalker", "drowned_hauler"],
    transitionZoneIds: ["nightmarket"],
    mapKey: "map_saltmere_docks_placeholder",
    bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 }
  }
] as const satisfies readonly ZoneContentDefinition[];
