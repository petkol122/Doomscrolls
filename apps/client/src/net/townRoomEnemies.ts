import type { LocalizationKey } from "@doomscrolls/localization";
import type { EnemyState, EnemyAttackKind, RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";

export interface TownRoomEnemySnapshot {
  readonly id: string;
  readonly enemyId: string;
  readonly label: LocalizationKey;
  readonly x: number;
  readonly y: number;
  readonly state: EnemyState;
  readonly targetPlayerSessionId: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly defeated: boolean;
  readonly respawnAtMs: number;
  readonly attackKind: EnemyAttackKind;
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
    const x = enemy.x;
    const y = enemy.y;
    const state = enemy.state;
    const targetPlayerSessionId = enemy.targetPlayerSessionId;
    const hp = enemy.hp;
    const maxHp = enemy.maxHp;
    const defeated = enemy.defeated;
    const respawnAtMs = enemy.respawnAtMs;
    const attackKind = enemy.attackKind;

    if (
      typeof id !== "string" ||
      typeof enemyId !== "string" ||
      typeof label !== "string" ||
      typeof x !== "number" ||
      typeof y !== "number" ||
      (state !== "idle" && state !== "chasing" && state !== "defeated") ||
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

    results.push({
      id,
      enemyId,
      label: label as LocalizationKey,
      x,
      y,
      state,
      targetPlayerSessionId,
      hp,
      maxHp,
      defeated,
      respawnAtMs,
      attackKind,
    });
  });

  return results;
}
