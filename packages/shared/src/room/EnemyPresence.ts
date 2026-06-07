import { Schema, type } from "@colyseus/schema";
import type { LocalizationKey } from "@doomscrolls/localization";

export type EnemyState = "idle" | "chasing" | "returning" | "defeated";

export class EnemyPresence extends Schema {
  @type("string") id!: string;
  @type("string") enemyId!: string;
  @type("string") label!: LocalizationKey;
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
}

export type WorldEnemy = Pick<
  EnemyPresence,
  | "id"
  | "enemyId"
  | "label"
  | "x"
  | "y"
  | "state"
  | "targetPlayerSessionId"
  | "hp"
  | "maxHp"
  | "defeated"
  | "respawnAtMs"
  | "attackLandingAtMs"
>;
