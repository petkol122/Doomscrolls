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
] as const satisfies readonly SpawnZoneDefinition[];