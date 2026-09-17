import { Schema, type } from "@colyseus/schema";
import type { LocalizationKey } from "@doomscrolls/localization";

export type EnemyState = "idle" | "chasing" | "returning" | "defeated";

export type EnemyAttackKind = "normal" | "heavy";

/**
 * Core 0.1 Foundation -- enemy rarity tier. Server-authoritative and
 * rolled once at spawn time (see `enemyRarity.ts`); scales the enemy's
 * hp/damage/loot without needing a distinct content-registered enemy id
 * per tier. "normal" is the default, unscaled tier every enemy already
 * shipped with.
 */
export type EnemyRarity = "normal" | "champion" | "elite";

export class EnemyPresence extends Schema {
  @type("string") id!: string;
  @type("string") enemyId!: string;
  @type("string") label!: LocalizationKey;
  @type("string") rarity!: EnemyRarity;
  @type("number") spawnX!: number;
  @type("number") spawnY!: number;
  @type("number") x!: number;
  @type("number") y!: number;
  @type("string") state!: EnemyState;
  @type("string") targetPlayerSessionId!: string;
  @type("number") hp!: number;
  @type("number") maxHp!: number;
  @type("boolean") defeated!: boolean;
  @type("number") nextAttackAtMs!: number;
  @type("number") respawnAtMs!: number;
  // Task 094 — server-owned attack telegraph windup.
  // Set to the server-side wall-clock time (Date.now()) at which a
  // telegraphed attack will land; 0 means no telegraph is active.
  // Clients only read this to drive a transient visual warning marker.
  @type("number") attackLandingAtMs!: number;
  // Task 226 — server-owned heavy-attack kind flag. Drives the
  // distinct client warning marker for Brute charged attacks.
  @type("string") attackKind!: EnemyAttackKind;
  // Task 264 — server-owned timestamp for the earliest wall-clock
  // time (ms) the enemy may attempt another heavy attack. 0 means
  // "no heavy attack in progress / ready". This is independent of
  // the regular `nextAttackAtMs` cooldown so heavy attacks can run
  // on a separate cadence.
  @type("number") nextHeavyAttackAtMs!: number;
  // Core 0.1 Foundation -- server-computed obstacle-avoidance waypoints
  // beyond the enemy's immediate movement step, flattened as
  // "x1,y1,x2,y2,...". Populated by `stepEnemyTowardTargetWithAvoidance`
  // / `stepEnemyTowardPointWithAvoidance` (see `enemyPathfinding.ts`)
  // when a chase/return move isn't a clear straight line; consumed one
  // waypoint at a time as each is reached. Empty string = no queued
  // route (direct line, or zone has no obstacle geometry).
  @type("string") pathWaypoints!: string;
  // Core 0.2 -- server-owned active status effects (bleed/slow/stun/burn),
  // flattened as "type:expiresAtMs:magnitude:nextTickAtMs" entries joined
  // by "|". Empty string = no active effects. See
  // `apps/server/src/realtime/rooms/statusEffects.ts` for the engine that
  // reads/writes this field; clients only ever read it for a visual
  // indicator.
  @type("string") statusEffects!: string;
}

export type WorldEnemy = Pick<
  EnemyPresence,
  | "id"
  | "enemyId"
  | "label"
  | "rarity"
  | "x"
  | "y"
  | "state"
  | "targetPlayerSessionId"
  | "hp"
  | "maxHp"
  | "defeated"
  | "respawnAtMs"
  | "attackLandingAtMs"
  | "attackKind"
  | "statusEffects"
>;
