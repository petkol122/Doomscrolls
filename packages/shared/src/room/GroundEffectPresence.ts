import { Schema, type } from "@colyseus/schema";

/**
 * Milestone 0.2 -- Server-Authoritative Projectiles & Ground-Targeted AoE
 * Skills. A purely cosmetic marker telling clients "draw a fading circle
 * here" -- the actual AoE hit is resolved instantly server-side at cast
 * time (see `resolveGroundAoeCast`); this entry carries no gameplay
 * authority of its own and is deleted once `expiresAtMs` passes (see
 * `cleanupExpiredGroundEffects`).
 */
export class GroundEffectPresence extends Schema {
  @type("string") id!: string;
  @type("string") skillId!: string;
  @type("string") ownerSessionId!: string;
  @type("number") x!: number;
  @type("number") y!: number;
  @type("number") radius!: number;
  @type("number") spawnedAtMs!: number;
  @type("number") expiresAtMs!: number;
}
