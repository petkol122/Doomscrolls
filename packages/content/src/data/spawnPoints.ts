import type { SpawnPointId } from "@doomscrolls/shared";
import type { SpawnPointContentDefinition } from "./types";

const spawnPointId = (value: string): SpawnPointId => value as SpawnPointId;

export const spawnPoints = [
  {
    id: "nightmarket_spawn",
    spawnPointId: spawnPointId("nightmarket_spawn"),
    zoneId: "nightmarket",
    x: 250,
    y: 300,
    labelKey: "spawn.nightmarket.default"
  },
  {
    id: "nightmarket_blackwire_combat_entry",
    spawnPointId: spawnPointId("nightmarket_blackwire_combat_entry"),
    zoneId: "nightmarket",
    x: 2860,
    y: 2120,
    labelKey: "spawn.nightmarket.blackwire_combat_entry" as never
  },
  {
    id: "nightmarket_services_return",
    spawnPointId: spawnPointId("nightmarket_services_return"),
    zoneId: "nightmarket",
    x: 470,
    y: 500,
    labelKey: "spawn.nightmarket.services_return" as never
  }
] as const satisfies readonly SpawnPointContentDefinition[];