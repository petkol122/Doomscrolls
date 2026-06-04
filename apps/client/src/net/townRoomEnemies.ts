import type { LocalizationKey } from "@doomscrolls/localization";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";

export interface TownRoomEnemySnapshot {
  readonly id: string;
  readonly enemyId: string;
  readonly label: LocalizationKey;
  readonly x: number;
  readonly y: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly defeated: boolean;
  readonly respawnAtMs: number;
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
    const hp = enemy.hp;
    const maxHp = enemy.maxHp;
    const defeated = enemy.defeated;
    const respawnAtMs = enemy.respawnAtMs;

    if (
      typeof id !== "string" ||
      typeof enemyId !== "string" ||
      typeof label !== "string" ||
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof hp !== "number" ||
      typeof maxHp !== "number" ||
      typeof defeated !== "boolean" ||
      typeof respawnAtMs !== "number"
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
      hp,
      maxHp,
      defeated,
      respawnAtMs,
    });
  });

  return results;
}
