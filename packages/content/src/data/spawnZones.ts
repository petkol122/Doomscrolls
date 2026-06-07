import type { EnemyId, SpawnZoneDefinition } from "./types";

export const spawnZones = [
  {
    // Clustered tightly around sewer edge marker 01 at (360, 260)
    // so runts feel like they're guarding the immediate edge entrance
    id: "sewer_edge_trashboar_runt_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_runt" as EnemyId,
    count: 3,
    minX: 300,
    maxX: 460,
    minY: 220,
    maxY: 380,
  },
  {
    // Pushed deeper south-east beyond marker 02 at (1180, 900)
    // so the Brute feels farther into the sewer edge area
    id: "sewer_edge_trashboar_brute_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_brute" as EnemyId,
    count: 1,
    minX: 1400,
    maxX: 1700,
    minY: 1100,
    maxY: 1400,
  },
] as const satisfies readonly SpawnZoneDefinition[];