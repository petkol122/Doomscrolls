import { Schema, type } from "@colyseus/schema";

/**
 * Milestone 0.3 -- Netrunner Urban-Magic Class Archetype. A server-owned,
 * stationary turret summoned by `overclock_turret`: it sits at its spawn
 * point for its lifespan, auto-attacking the nearest non-defeated enemy
 * within `attackRange` on its own `attackIntervalMs` cadence (see
 * `apps/server/src/realtime/rooms/turretSimulation.ts`). The server is the
 * sole authority; clients only ever read `x`/`y`/`expiresAtMs` to render a
 * cosmetic ground marker, matching `ProjectilePresence`/`GroundEffectPresence`'s
 * existing convention.
 */
export class TurretPresence extends Schema {
  @type("string") id!: string;
  @type("string") skillId!: string;
  @type("string") ownerSessionId!: string;
  @type("number") x!: number;
  @type("number") y!: number;
  @type("number") attackRange!: number;
  @type("number") attackDamage!: number;
  @type("number") attackIntervalMs!: number;
  @type("number") nextAttackAtMs!: number;
  @type("number") spawnedAtMs!: number;
  @type("number") expiresAtMs!: number;
}
