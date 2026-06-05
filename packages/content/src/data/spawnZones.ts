import type { EnemyId, SpawnZoneDefinition } from "./types";

export const spawnZones = [
  {
    id: "nightmarket_trashboar_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_runt" as EnemyId,
    count: 3,
    minX: 360,
    maxX: 620,
    minY: 260,
    maxY: 500,
  },
  {
    id: "nightmarket_trashboar_brute_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_brute" as EnemyId,
    count: 1,
    minX: 1180,
    maxX: 1420,
    minY: 900,
    maxY: 1160,
  },
] as const satisfies readonly SpawnZoneDefinition[];