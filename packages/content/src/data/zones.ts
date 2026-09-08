import type { ZoneId } from "@doomscrolls/shared";
import type { ZoneContentDefinition } from "./types";

const zoneId = (value: string): ZoneId => value as ZoneId;

export const zones = [
  {
    // Core 0.34 — Namesti Republiky: fresh hub zone replacing Nightmarket.
    // The square itself keeps its original bounds-relative placement
    // (centered at 2500,1800 -- see spawnPoints.ts); no cathedral/shops/
    // hub services yet (deliberately separate follow-up builds).
    //
    // Core 0.35 — real city-centre geometry. Bounds expanded to cover the
    // square's immediate bordering blocks (real building footprints +
    // street layout, fetched from Overpass API and converted at
    // WORLD_UNITS_PER_METER, see types.ts) -- streets/building geometry
    // only, not services; this is the first ring only, expanded
    // incrementally outward in later builds. World-unit convention for
    // this build's new geometry: origin (2500,1800) = the square's real
    // center; +X = east, +Y = south (the pre-existing square itself does
    // not encode true compass orientation, so this convention governs
    // only content added from Core 0.35 onward).
    id: "namesti_republiky",
    zoneId: zoneId("namesti_republiky"),
    nameKey: "zone.namesti_republiky.name",
    descriptionKey: "zone.namesti_republiky.description",
    roomType: "town",
    classification: "safe_hub",
    maxPlayers: 30,
    enemyIds: [],
    // No combat-zone gates in this build -- see docs on the Nightmarket
    // removal/Namesti Republiky build for why combat access is deferred.
    transitionZoneIds: [],
    mapKey: "map_namesti_republiky_placeholder",
    areaId: "pilsen",
    bounds: { minX: -2238, maxX: 7303, minY: -3330, maxY: 6935 },
    groundTileKey: "ground_stone"
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
    transitionZoneIds: ["namesti_republiky"],
    mapKey: "map_blackwire_sewers_placeholder",
    areaId: "pilsen",
    bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 },
    // Core 0.22 — Phase 1 of isometric art integration ships exactly one
    // zone's ground tile; see docs/CORE_BUILD_0_22_PLAN.md.
    groundTileKey: "ground_stone"
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
    transitionZoneIds: ["namesti_republiky"],
    mapKey: "map_static_yard_placeholder",
    areaId: "pilsen",
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
    transitionZoneIds: ["namesti_republiky"],
    mapKey: "map_cinderworks_placeholder",
    areaId: "pilsen",
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
    transitionZoneIds: ["namesti_republiky"],
    mapKey: "map_saltmere_docks_placeholder",
    areaId: "pilsen",
    bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 }
  }
] as const satisfies readonly ZoneContentDefinition[];
