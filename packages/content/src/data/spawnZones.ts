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
  // ── Core 0.6 — Static Yard combat zone pockets ──
  {
    // Entry-side wretch cluster. Kept clear of the COMBAT_SPAWN_BOX
    // entry area (x 96-180, y 420-520) and the return gate.
    id: "static_yard_wretch_pocket_north",
    zoneId: "static_yard",
    enemyId: "static_wretch" as EnemyId,
    count: 3,
    minX: 150,
    maxX: 300,
    minY: 120,
    maxY: 240,
  },
  {
    // Second wretch pocket, mid-room, distinct from the north pocket so
    // the room reads as inhabited without matching Blackwire's layout.
    id: "static_yard_wretch_pocket_south",
    zoneId: "static_yard",
    enemyId: "static_wretch" as EnemyId,
    count: 2,
    minX: 480,
    maxX: 620,
    minY: 380,
    maxY: 500,
  },
  {
    // Single heavy anchor reusing the existing Trashboar Brute, mirroring
    // Blackwire's own single-brute-anchor pattern.
    id: "static_yard_brute_anchor",
    zoneId: "static_yard",
    enemyId: "trashboar_brute" as EnemyId,
    count: 1,
    minX: 620,
    maxX: 740,
    minY: 150,
    maxY: 260,
  },
  {
    // Core 0.17 — Yard Drudge, Static Yard's own common/starter tier.
    // Mid-room pocket, clear of the wretch pockets and the brute anchor.
    id: "static_yard_drudge_pocket",
    zoneId: "static_yard",
    enemyId: "yard_drudge" as EnemyId,
    count: 2,
    minX: 300,
    maxX: 440,
    minY: 300,
    maxY: 420,
  },
  // ── Core 0.16 — Cinderworks combat zone pockets ──
  {
    // Entry-side hound cluster. Kept clear of the COMBAT_SPAWN_BOX entry
    // area (x 96-180, y 420-520) and the return gate.
    id: "cinderworks_hound_pocket_north",
    zoneId: "cinderworks",
    enemyId: "slag_hound" as EnemyId,
    count: 3,
    minX: 150,
    maxX: 300,
    minY: 120,
    maxY: 240,
  },
  {
    // Second hound pocket, mid-room, distinct from the north pocket so
    // the room reads as inhabited without matching Static Yard's layout.
    id: "cinderworks_hound_pocket_south",
    zoneId: "cinderworks",
    enemyId: "slag_hound" as EnemyId,
    count: 2,
    minX: 480,
    maxX: 620,
    minY: 380,
    maxY: 500,
  },
  {
    // Single heavy anchor, Cinderworks' own Foundry Warden.
    id: "cinderworks_warden_anchor",
    zoneId: "cinderworks",
    enemyId: "foundry_warden" as EnemyId,
    count: 1,
    minX: 620,
    maxX: 740,
    minY: 150,
    maxY: 260,
  },
  {
    // Core 0.17 — Ash Rat, Cinderworks' own common/starter tier. Mid-room
    // pocket, mirroring Static Yard's drudge pocket placement.
    id: "cinderworks_rat_pocket",
    zoneId: "cinderworks",
    enemyId: "ash_rat" as EnemyId,
    count: 3,
    minX: 300,
    maxX: 440,
    minY: 300,
    maxY: 420,
  },
  // ── Core 0.18 — Saltmere Docks combat zone pockets ──
  {
    // Entry-side crawler cluster. Kept clear of the COMBAT_SPAWN_BOX
    // entry area (x 96-180, y 420-520) and the return gate.
    id: "saltmere_docks_crawler_pocket_north",
    zoneId: "saltmere_docks",
    enemyId: "brine_crawler" as EnemyId,
    count: 3,
    minX: 150,
    maxX: 300,
    minY: 120,
    maxY: 240,
  },
  {
    // Skirmisher pocket, mid-room, distinct from the crawler pocket.
    id: "saltmere_docks_stalker_pocket",
    zoneId: "saltmere_docks",
    enemyId: "tide_stalker" as EnemyId,
    count: 2,
    minX: 480,
    maxX: 620,
    minY: 380,
    maxY: 500,
  },
  {
    // Single heavy anchor, Saltmere Docks' own Drowned Hauler.
    id: "saltmere_docks_hauler_anchor",
    zoneId: "saltmere_docks",
    enemyId: "drowned_hauler" as EnemyId,
    count: 1,
    minX: 620,
    maxX: 740,
    minY: 150,
    maxY: 260,
  },
] as const satisfies readonly SpawnZoneDefinition[];
