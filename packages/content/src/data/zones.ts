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
    transitionZoneIds: ["blackwire_sewers", "static_yard", "cinderworks"],
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
    enemyIds: ["static_wretch", "trashboar_brute"],
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
    enemyIds: ["slag_hound", "foundry_warden"],
    transitionZoneIds: ["nightmarket"],
    mapKey: "map_cinderworks_placeholder",
    bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 }
  }
] as const satisfies readonly ZoneContentDefinition[];
