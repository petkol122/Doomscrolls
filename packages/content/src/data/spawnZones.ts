import type { EnemyId, SpawnZoneDefinition } from "./types";

export const spawnZones = [
  {
    // First combat pocket around sewer edge marker 01 at ~(1300, 1000)
    // Clearly separated from the service cluster near spawn (~200-420)
    id: "sewer_edge_trashboar_runt_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_runt" as EnemyId,
    count: 3,
    minX: 1200,
    maxX: 1550,
    minY: 900,
    maxY: 1250,
  },
  {
    // Deeper south-east beyond marker 02 at ~(2000, 1600)
    // Farther than Runts — not visible from first combat pocket
    id: "sewer_edge_trashboar_brute_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_brute" as EnemyId,
    count: 1,
    minX: 1900,
    maxX: 2400,
    minY: 1500,
    maxY: 2000,
  },
] as const satisfies readonly SpawnZoneDefinition[];
