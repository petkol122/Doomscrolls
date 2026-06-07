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
    enemyIds: ["trashboar_runt", "trashboar_brute"],
    transitionZoneIds: ["blackwire_sewers"],
    mapKey: "map_nightmarket_placeholder",
    bounds: { minX: 0, maxX: 2400, minY: 0, maxY: 1800 }
  },
  {
    id: "blackwire_sewers",
    zoneId: zoneId("blackwire_sewers"),
    nameKey: "zone.blackwire_sewers.name",
    descriptionKey: "zone.blackwire_sewers.description",
    roomType: "combat",
    classification: "combat",
    maxPlayers: 4,
    enemyIds: ["trashboar_runt"],
    transitionZoneIds: ["nightmarket"],
    mapKey: "map_blackwire_sewers_placeholder",
    bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 }
  }
] as const satisfies readonly ZoneContentDefinition[];
