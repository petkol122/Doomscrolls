import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";

/**
 * Milestone 0.2 -- Server-Authoritative Projectiles & Ground-Targeted AoE
 * Skills. Duck-typed snapshot reader mirroring `townRoomEnemies.ts`'s
 * pattern exactly: `room.state` is treated as an untrusted
 * `Record<string, unknown>` and every field is manually type-checked.
 */
export interface TownRoomGroundEffectSnapshot {
  readonly id: string;
  readonly skillId: string;
  readonly ownerSessionId: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly spawnedAtMs: number;
  readonly expiresAtMs: number;
}

export function getTownRoomGroundEffects(
  roomState: DoomscrollsRoomState,
): readonly TownRoomGroundEffectSnapshot[] {
  const state = roomState as unknown as Record<string, unknown>;
  const rawGroundEffects = state.groundEffects;

  if (rawGroundEffects === undefined || rawGroundEffects === null) {
    return [];
  }

  const groundEffectsMap = rawGroundEffects as {
    forEach: (fn: (value: Record<string, unknown>, key: string) => void) => void;
  };

  const results: TownRoomGroundEffectSnapshot[] = [];
  groundEffectsMap.forEach((effect) => {
    const id = effect.id;
    const skillId = effect.skillId;
    const ownerSessionId = effect.ownerSessionId;
    const x = effect.x;
    const y = effect.y;
    const radius = effect.radius;
    const spawnedAtMs = effect.spawnedAtMs;
    const expiresAtMs = effect.expiresAtMs;

    if (
      typeof id !== "string" ||
      typeof skillId !== "string" ||
      typeof ownerSessionId !== "string" ||
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof radius !== "number" ||
      typeof spawnedAtMs !== "number" ||
      typeof expiresAtMs !== "number" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(radius) ||
      !Number.isFinite(spawnedAtMs) ||
      !Number.isFinite(expiresAtMs)
    ) {
      return;
    }

    results.push({ id, skillId, ownerSessionId, x, y, radius, spawnedAtMs, expiresAtMs });
  });

  return results;
}
