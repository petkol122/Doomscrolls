import type { EnemyId, SpawnZoneDefinition } from "./types";

export const spawnZones = [
  {
    // Core 0.4 Task 353 — conservative Blackwire Sewers entrance pocket.
    // Keeps the first contact readable after the room handoff and leaves
    // space around the return gate.
    id: "blackwire_sewers_runt_pocket_west",
    zoneId: "blackwire_sewers",
    enemyId: "trashboar_runt" as EnemyId,
    count: 2,
    minX: 180,
    maxX: 290,
    minY: 170,
    maxY: 280,
  },
  {
    // Mid-room mixed pressure stays modest: one skitter in its own pocket
    // so the area gains variety without becoming noisy.
    id: "blackwire_sewers_skitter_pocket_mid",
    zoneId: "blackwire_sewers",
    enemyId: "trashboar_skitter" as EnemyId,
    count: 1,
    minX: 350,
    maxX: 460,
    minY: 210,
    maxY: 320,
  },
  {
    // Small deeper runt pair to make the room feel inhabited without adding
    // a dense swarm.
    id: "blackwire_sewers_runt_pocket_east",
    zoneId: "blackwire_sewers",
    enemyId: "trashboar_runt" as EnemyId,
    count: 2,
    minX: 520,
    maxX: 650,
    minY: 180,
    maxY: 300,
  },
  {
    // Single deeper brute anchor. Reuses existing heavy enemy content only.
    id: "blackwire_sewers_brute_anchor",
    zoneId: "blackwire_sewers",
    enemyId: "trashboar_brute" as EnemyId,
    count: 1,
    minX: 560,
    maxX: 700,
    minY: 340,
    maxY: 470,
  },
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
