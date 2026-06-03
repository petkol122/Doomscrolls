import type { ZoneId } from "@doomscrolls/shared";
import type { ZoneContentDefinition } from "./types";

const zoneId = (value: string): ZoneId => value as ZoneId;

export const zones = [
  {
    id: "nightmarket",
    zoneId: zoneId("nightmarket"),
    nameKey: "zone.nightmarket.name",
    descriptionKey: "zone.nightmarket.description",
    roomType: "town",
    maxPlayers: 30,
    enemyIds: [],
    transitionZoneIds: ["blackwire_sewers"],
    mapKey: "map_nightmarket_placeholder",
    bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 }
  },
  {
    id: "blackwire_sewers",
    zoneId: zoneId("blackwire_sewers"),
    nameKey: "zone.blackwire_sewers.name",
    descriptionKey: "zone.blackwire_sewers.description",
    roomType: "combat",
    maxPlayers: 4,
    enemyIds: ["trashboar_runt"],
    transitionZoneIds: ["nightmarket"],
    mapKey: "map_blackwire_sewers_placeholder",
    bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 }
  }
] as const satisfies readonly ZoneContentDefinition[];
