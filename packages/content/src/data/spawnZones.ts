import type { EnemyId, SpawnZoneDefinition } from "./types";

export const spawnZones = [
  {
    id: "nightmarket_trashboar_zone",
    zoneId: "nightmarket",
    enemyId: "trashboar_runt" as EnemyId,
    count: 3,
    minX: 220,
    maxX: 340,
    minY: 120,
    maxY: 240,
  },
] as const satisfies readonly SpawnZoneDefinition[];