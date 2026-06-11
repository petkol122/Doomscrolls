import type { EnemyId, SpawnZoneDefinition } from "./types";

export const spawnZones = [
  {
    // First combat pocket around sewer edge marker 01, pushed farther from the
    // enlarged town hub so hostile enemies do not visually crowd services.
    id: "sewer_edge_trashboar_runt_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_runt" as EnemyId,
    count: 3,
    minX: 2840,
    maxX: 3340,
    minY: 2040,
    maxY: 2460,
  },
  {
    // Trashboar Skitter pocket — earlier approach pocket, but still clearly
    // detached from the service hub and from the Runt cluster.
    id: "sewer_edge_trashboar_skitter_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_skitter" as EnemyId,
    count: 2,
    minX: 2140,
    maxX: 2500,
    minY: 1520,
    maxY: 1880,
  },
  {
    // Deepest south-east pocket. Stays meaningfully farther from both earlier
    // enemy groups so the route reads as escalating distance/depth.
    id: "sewer_edge_trashboar_brute_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_brute" as EnemyId,
    count: 1,
    minX: 3720,
    maxX: 4380,
    minY: 2740,
    maxY: 3240,
  },
] as const satisfies readonly SpawnZoneDefinition[];
