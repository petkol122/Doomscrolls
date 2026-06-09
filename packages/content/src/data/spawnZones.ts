import type { EnemyId, SpawnZoneDefinition } from "./types";

export const spawnZones = [
  {
    // First combat pocket around sewer edge marker 01 at ~(1900, 1500)
    // Clearly separated from the service cluster near spawn (~200-420)
    id: "sewer_edge_trashboar_runt_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_runt" as EnemyId,
    count: 3,
    minX: 1750,
    maxX: 2150,
    minY: 1300,
    maxY: 1750,
  },
  {
    // Trashboar Skitter pocket — north-west of the Runt zone so both
    // pockets feel like distinct approach angles. 1–2 units, lower threat.
    id: "sewer_edge_trashboar_skitter_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_skitter" as EnemyId,
    count: 2,
    minX: 1500,
    maxX: 1780,
    minY: 1050,
    maxY: 1350,
  },
  {
    // Deeper south-east — far enough that Runts must be cleared before
    // the Brute is reachable without being chased through the whole zone.
    id: "sewer_edge_trashboar_brute_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_brute" as EnemyId,
    count: 1,
    minX: 2600,
    maxX: 3200,
    minY: 2100,
    maxY: 2700,
  },
] as const satisfies readonly SpawnZoneDefinition[];
