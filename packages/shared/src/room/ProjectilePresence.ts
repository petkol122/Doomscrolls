import { Schema, type } from "@colyseus/schema";

/**
 * Milestone 0.2 -- Server-Authoritative Projectiles & Ground-Targeted AoE
 * Skills. A server-owned, homing-capable projectile in flight. The server
 * is the sole authority for travel and impact (see
 * `apps/server/src/realtime/rooms/projectileSimulation.ts`); clients only
 * ever read `x`/`y` each tick to render a moving marker.
 */
export class ProjectilePresence extends Schema {
  @type("string") id!: string;
  @type("string") skillId!: string;
  @type("string") ownerSessionId!: string;
  @type("number") originX!: number;
  @type("number") originY!: number;
  @type("number") x!: number;
  @type("number") y!: number;
  @type("number") targetX!: number;
  @type("number") targetY!: number;
  // "" = flies to the fixed targetX/targetY; non-empty = homes toward
  // that enemy's live position each tick until impact or the enemy dies.
  @type("string") targetEnemyId!: string;
  @type("number") speed!: number;
  // Precomputed at spawn time (already includes power/rank bonuses).
  @type("number") damage!: number;
  @type("string") appliesEffect!: string;
  @type("number") effectDurationMs!: number;
  @type("number") effectMagnitude!: number;
  @type("number") spawnedAtMs!: number;
}
