import type { EnemyId, SpawnZoneDefinition } from "./types";

export const spawnZones = [
  {
    id: "nightmarket_trashboar_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_runt" as EnemyId,
    count: 3,
    minX: 300,
    maxX: 520,
    minY: 220,
    maxY: 420,
  },
  {
    id: "nightmarket_trashboar_brute_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_brute" as EnemyId,
    count: 1,
    minX: 960,
    maxX: 1120,
    minY: 760,
    maxY: 940,
  },
] as const satisfies readonly SpawnZoneDefinition[];