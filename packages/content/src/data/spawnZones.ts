import type { EnemyId, SpawnZoneDefinition } from "./types";

export const spawnZones = [
  {
    // Conceptual combat edge area near/inside current Nightmarket bounds.
    // zoneId stays "nightmarket" so the server still picks these up.
    // Long-term these will move to blackwire_sewer_edge zone when multi-zone lands.
    id: "sewer_edge_trashboar_runt_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_runt" as EnemyId,
    count: 3,
    minX: 360,
    maxX: 620,
    minY: 260,
    maxY: 500,
  },
  {
    id: "sewer_edge_trashboar_brute_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_brute" as EnemyId,
    count: 1,
    minX: 1180,
    maxX: 1420,
    minY: 900,
    maxY: 1160,
  },
] as const satisfies readonly SpawnZoneDefinition[];
