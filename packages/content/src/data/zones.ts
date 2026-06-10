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
    transitionZoneIds: ["blackwire_sewers"],
    mapKey: "map_nightmarket_placeholder",
    bounds: { minX: 0, maxX: 5000, minY: 0, maxY: 3600 },
    // Task 303 — Physical town rest area: a rectangular region around the
    // Nightmarket service cluster (spawn/services hub). Players standing
    // inside this area get HP and healing flask charges restored.
    // Bounds roughly cover the safe-area marker ring + service objects.
    restAreaBounds: { minX: 40, maxX: 540, minY: 80, maxY: 480 }
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
