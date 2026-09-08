import type { SpawnPointId } from "@doomscrolls/shared";
import type { SpawnPointContentDefinition } from "./types";

const spawnPointId = (value: string): SpawnPointId => value as SpawnPointId;

// Core 0.33 — Nightmarket Real City-Center Expansion. Every nightmarket
// spawn point below was remapped through the same transforms used for
// worldProps.ts (see docs/CORE_BUILD_0_33_PLAN.md Question 3): the hub
// per-axis scale for spawn/return points inside the old service-cluster
// box, the Blackwire-corridor similarity transform for the sewer combat
// entry, and the three rigid gate-cluster translations for the other
// combat zones' entries. This file was missed in the original migration
// pass and found live (a fresh character spawned at the old, now-empty
// coordinate) -- fixed here, not left as a known gap.
export const spawnPoints = [
  {
    id: "nightmarket_spawn",
    spawnPointId: spawnPointId("nightmarket_spawn"),
    zoneId: "nightmarket",
    x: 8311,
    y: 10761,
    labelKey: "spawn.nightmarket.default"
  },
  {
    id: "nightmarket_blackwire_combat_entry",
    spawnPointId: spawnPointId("nightmarket_blackwire_combat_entry"),
    zoneId: "nightmarket",
    x: 6144,
    y: 14775,
    labelKey: "spawn.nightmarket.blackwire_combat_entry" as never
  },
  {
    id: "nightmarket_services_return",
    spawnPointId: spawnPointId("nightmarket_services_return"),
    zoneId: "nightmarket",
    x: 9191,
    y: 12276,
    labelKey: "spawn.nightmarket.services_return" as never
  },
  {
    // Core 0.6 — Static Yard's nightmarket-side landing point, used both
    // as the room-intent position stored before entering combat and as
    // the position the player lands at when returning, mirroring
    // nightmarket_blackwire_combat_entry's dual use.
    id: "nightmarket_static_yard_combat_entry",
    spawnPointId: spawnPointId("nightmarket_static_yard_combat_entry"),
    zoneId: "nightmarket",
    x: 14501,
    y: 12888,
    labelKey: "spawn.nightmarket.static_yard_combat_entry" as never
  },
  {
    // Core 0.16 — Cinderworks' nightmarket-side landing point. Core 0.33:
    // relocated alongside its gate cluster to the real north ring anchor.
    id: "nightmarket_cinderworks_combat_entry",
    spawnPointId: spawnPointId("nightmarket_cinderworks_combat_entry"),
    zoneId: "nightmarket",
    x: 8799,
    y: 300,
    labelKey: "spawn.nightmarket.cinderworks_combat_entry" as never
  },
  {
    // Core 0.18 — Saltmere Docks' nightmarket-side landing point. Core
    // 0.33: relocated alongside its gate cluster to the real river/
    // embankment anchor (Anglicke nabrezi / Radbuzska naplavka).
    id: "nightmarket_saltmere_docks_combat_entry",
    spawnPointId: spawnPointId("nightmarket_saltmere_docks_combat_entry"),
    zoneId: "nightmarket",
    x: 18813,
    y: 16434,
    labelKey: "spawn.nightmarket.saltmere_docks_combat_entry" as never
  }
] as const satisfies readonly SpawnPointContentDefinition[];