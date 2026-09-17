import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";

/**
 * Milestone 0.2 -- Server-Authoritative Projectiles & Ground-Targeted AoE
 * Skills. Duck-typed snapshot reader mirroring `townRoomEnemies.ts`'s
 * pattern exactly: `room.state` is treated as an untrusted
 * `Record<string, unknown>` and every field is manually type-checked.
 */
export interface TownRoomProjectileSnapshot {
  readonly id: string;
  readonly skillId: string;
  readonly ownerSessionId: string;
  readonly x: number;
  readonly y: number;
}

export function getTownRoomProjectiles(
  roomState: DoomscrollsRoomState,
): readonly TownRoomProjectileSnapshot[] {
  const state = roomState as unknown as Record<string, unknown>;
  const rawProjectiles = state.projectiles;

  if (rawProjectiles === undefined || rawProjectiles === null) {
    return [];
  }

  const projectilesMap = rawProjectiles as {
    forEach: (fn: (value: Record<string, unknown>, key: string) => void) => void;
  };

  const results: TownRoomProjectileSnapshot[] = [];
  projectilesMap.forEach((projectile) => {
    const id = projectile.id;
    const skillId = projectile.skillId;
    const ownerSessionId = projectile.ownerSessionId;
    const x = projectile.x;
    const y = projectile.y;

    if (
      typeof id !== "string" ||
      typeof skillId !== "string" ||
      typeof ownerSessionId !== "string" ||
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return;
    }

    results.push({ id, skillId, ownerSessionId, x, y });
  });

  return results;
}
