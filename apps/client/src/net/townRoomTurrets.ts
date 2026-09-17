import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";

/**
 * Milestone 0.3 -- Netrunner Urban-Magic Class Archetype. Duck-typed
 * snapshot reader mirroring `townRoomGroundEffects.ts`'s pattern exactly:
 * `room.state` is treated as an untrusted `Record<string, unknown>` and
 * every field is manually type-checked.
 */
export interface TownRoomTurretSnapshot {
  readonly id: string;
  readonly skillId: string;
  readonly ownerSessionId: string;
  readonly x: number;
  readonly y: number;
  readonly attackRange: number;
  readonly spawnedAtMs: number;
  readonly expiresAtMs: number;
}

export function getTownRoomTurrets(
  roomState: DoomscrollsRoomState,
): readonly TownRoomTurretSnapshot[] {
  const state = roomState as unknown as Record<string, unknown>;
  const rawTurrets = state.turrets;

  if (rawTurrets === undefined || rawTurrets === null) {
    return [];
  }

  const turretsMap = rawTurrets as {
    forEach: (fn: (value: Record<string, unknown>, key: string) => void) => void;
  };

  const results: TownRoomTurretSnapshot[] = [];
  turretsMap.forEach((turret) => {
    const id = turret.id;
    const skillId = turret.skillId;
    const ownerSessionId = turret.ownerSessionId;
    const x = turret.x;
    const y = turret.y;
    const attackRange = turret.attackRange;
    const spawnedAtMs = turret.spawnedAtMs;
    const expiresAtMs = turret.expiresAtMs;

    if (
      typeof id !== "string" ||
      typeof skillId !== "string" ||
      typeof ownerSessionId !== "string" ||
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof attackRange !== "number" ||
      typeof spawnedAtMs !== "number" ||
      typeof expiresAtMs !== "number" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(attackRange) ||
      !Number.isFinite(spawnedAtMs) ||
      !Number.isFinite(expiresAtMs)
    ) {
      return;
    }

    results.push({ id, skillId, ownerSessionId, x, y, attackRange, spawnedAtMs, expiresAtMs });
  });

  return results;
}
