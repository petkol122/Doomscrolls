import type { SpawnPointId } from "@doomscrolls/shared";
import type { SpawnPointContentDefinition } from "./types";

const spawnPointId = (value: string): SpawnPointId => value as SpawnPointId;

export const spawnPoints = [
  {
    id: "nightmarket_spawn",
    spawnPointId: spawnPointId("nightmarket_spawn"),
    zoneId: "nightmarket",
    x: 160,
    y: 160,
    labelKey: "spawn.nightmarket.default"
  }
] as const satisfies readonly SpawnPointContentDefinition[];