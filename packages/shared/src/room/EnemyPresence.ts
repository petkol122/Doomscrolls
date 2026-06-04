import { Schema, type } from "@colyseus/schema";
import type { LocalizationKey } from "@doomscrolls/localization";

export class EnemyPresence extends Schema {
  @type("string") id!: string;
  @type("string") enemyId!: string;
  @type("string") label!: LocalizationKey;
  @type("number") x!: number;
  @type("number") y!: number;
  @type("number") hp!: number;
  @type("number") maxHp!: number;
  @type("boolean") defeated!: boolean;
  @type("number") nextAttackAtMs!: number;
  @type("number") respawnAtMs!: number;
}

export type WorldEnemy = Pick<
  EnemyPresence,
  "id" | "enemyId" | "label" | "x" | "y" | "hp" | "maxHp" | "defeated" | "respawnAtMs"
>;
