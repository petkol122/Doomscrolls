import type { PlayerPresence } from "./PlayerPresence";
import type { TownRoomState } from "./TownRoomState";

export const TOWN_MOVEMENT_TICK_RATE_MS = 50;
export const TOWN_MOVEMENT_SPEED_UNITS_PER_SECOND = 180;
export const TOWN_MOVEMENT_STOP_DISTANCE = 2;

interface MovementStepResult {
  readonly movedPlayerCount: number;
}

/**
 * Advance all TownRoom players with active movement targets by one server tick.
 *
 * This helper keeps movement orchestration out of `TownRoom.ts`. It performs a
 * constant-speed step toward each player's stored target and clears the target
 * once the player is close enough.
 */
export function stepTownRoomMovement(
  state: TownRoomState,
  deltaMs: number,
): MovementStepResult {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return { movedPlayerCount: 0 };
  }

  let movedPlayerCount = 0;
  const maxDistance = TOWN_MOVEMENT_SPEED_UNITS_PER_SECOND * (deltaMs / 1000);

  state.playerPresence.forEach((presence) => {
    if (!presence.hasMovementTarget) {
      return;
    }

    if (stepPresenceTowardTarget(presence, maxDistance)) {
      movedPlayerCount += 1;
    }
  });

  return { movedPlayerCount };
}

function stepPresenceTowardTarget(
  presence: Pick<
    PlayerPresence,
    "x" | "y" | "targetX" | "targetY" | "hasMovementTarget"
  >,
  maxDistance: number,
): boolean {
  const deltaX = presence.targetX - presence.x;
  const deltaY = presence.targetY - presence.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance <= TOWN_MOVEMENT_STOP_DISTANCE) {
    presence.x = presence.targetX;
    presence.y = presence.targetY;
    presence.hasMovementTarget = false;
    return true;
  }

  if (distance <= maxDistance) {
    presence.x = presence.targetX;
    presence.y = presence.targetY;
    presence.hasMovementTarget = false;
    return true;
  }

  const scale = maxDistance / distance;
  presence.x += deltaX * scale;
  presence.y += deltaY * scale;
  return true;
}