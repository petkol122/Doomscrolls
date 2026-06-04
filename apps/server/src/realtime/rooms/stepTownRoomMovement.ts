import type { PlayerPresence } from "./PlayerPresence";
import type { TownRoomState } from "./TownRoomState";
import { TOWN_MOVEMENT_SPEED_FALLBACK_UNITS_PER_SECOND } from "./resolvePlayerMovementSpeed";
import { tryExecutePendingAction } from "./deferredActionExecution";

export const TOWN_MOVEMENT_TICK_RATE_MS = 50;
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
  options?: {
    readonly now?: number;
    readonly onPendingActionReady?: (sessionId: string, payload: { readonly type: string; readonly message: unknown }) => void;
  },
): MovementStepResult {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return { movedPlayerCount: 0 };
  }

  let movedPlayerCount = 0;

  state.playerPresence.forEach((presence) => {
    if (!presence.hasMovementTarget) {
      return;
    }

    const speed =
      Number.isFinite(presence.movementSpeed) && presence.movementSpeed > 0
        ? presence.movementSpeed
        : TOWN_MOVEMENT_SPEED_FALLBACK_UNITS_PER_SECOND;
    const maxDistance = speed * (deltaMs / 1000);

    if (stepPresenceTowardTarget(presence, maxDistance)) {
      movedPlayerCount += 1;
    }

    if (options?.onPendingActionReady !== undefined) {
      void tryExecutePendingAction({
        state,
        player: presence,
        now: options.now ?? Date.now(),
        sendToClient: (type, message) => {
          options.onPendingActionReady?.(presence.sessionId, { type, message });
        },
      });
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