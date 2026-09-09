import type { SpawnPointId } from "@doomscrolls/shared";
import type { SpawnPointContentDefinition } from "./types";

const spawnPointId = (value: string): SpawnPointId => value as SpawnPointId;

export const spawnPoints = [
  {
    id: "namesti_republiky_spawn",
    spawnPointId: spawnPointId("namesti_republiky_spawn"),
    zoneId: "namesti_republiky",
    x: 2500,
    y: 1800,
    labelKey: "spawn.namesti_republiky.default"
  }
] as const satisfies readonly SpawnPointContentDefinition[];
