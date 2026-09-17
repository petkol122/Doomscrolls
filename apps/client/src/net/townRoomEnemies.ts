import type { LocalizationKey } from "@doomscrolls/localization";
import type { EnemyState, EnemyAttackKind, EnemyRarity, RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";

export interface TownRoomEnemySnapshot {
  readonly id: string;
  readonly enemyId: string;
  readonly label: LocalizationKey;
  readonly rarity: EnemyRarity;
  readonly x: number;
  readonly y: number;
  readonly state: EnemyState;
  readonly targetPlayerSessionId: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly defeated: boolean;
  readonly respawnAtMs: number;
  readonly attackKind: EnemyAttackKind;
  /**
   * Core 0.2 -- server-owned active status effects, flattened as
   * "type:expiresAtMs:magnitude:nextTickAtMs" entries joined by "|".
   * Empty string = none. Parse with `parseActiveStatusEffectTypes`.
   */
  readonly statusEffects: string;
}

export function getTownRoomEnemies(
  roomState: DoomscrollsRoomState,
): readonly TownRoomEnemySnapshot[] {
  const state = roomState as unknown as Record<string, unknown>;
  const rawEnemies = state.enemies;

  if (rawEnemies === undefined || rawEnemies === null) {
    return [];
  }

  const enemiesMap = rawEnemies as {
    forEach: (fn: (value: Record<string, unknown>, key: string) => void) => void;
  };

  const results: TownRoomEnemySnapshot[] = [];
  enemiesMap.forEach((enemy) => {
    const id = enemy.id;
    const enemyId = enemy.enemyId;
    const label = enemy.label;
    const rarity = enemy.rarity;
    const x = enemy.x;
    const y = enemy.y;
    const state = enemy.state;
    const targetPlayerSessionId = enemy.targetPlayerSessionId;
    const hp = enemy.hp;
    const maxHp = enemy.maxHp;
    const defeated = enemy.defeated;
    const respawnAtMs = enemy.respawnAtMs;
    const attackKind = enemy.attackKind;
    const statusEffects = typeof enemy.statusEffects === "string" ? enemy.statusEffects : "";

    if (
      typeof id !== "string" ||
      typeof enemyId !== "string" ||
      typeof label !== "string" ||
      typeof x !== "number" ||
      typeof y !== "number" ||
      (state !== "idle" && state !== "chasing" && state !== "returning" && state !== "defeated") ||
      typeof targetPlayerSessionId !== "string" ||
      typeof hp !== "number" ||
      typeof maxHp !== "number" ||
      typeof defeated !== "boolean" ||
      typeof respawnAtMs !== "number" ||
      (attackKind !== "normal" && attackKind !== "heavy")
    ) {
      return;
    }

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(hp) ||
      !Number.isFinite(maxHp) ||
      !Number.isFinite(respawnAtMs)
    ) {
      return;
    }

    const normalizedRarity: EnemyRarity =
      rarity === "champion" || rarity === "elite" ? rarity : "normal";

    results.push({
      id,
      enemyId,
      label: label as LocalizationKey,
      rarity: normalizedRarity,
      x,
      y,
      state,
      targetPlayerSessionId,
      hp,
      maxHp,
      defeated,
      respawnAtMs,
      attackKind,
      statusEffects,
    });
  });

  return results;
}