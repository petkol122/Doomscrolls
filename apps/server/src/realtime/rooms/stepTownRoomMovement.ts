import type { WorldPropPoint } from "@doomscrolls/content";
import type { PlayerPresence } from "./PlayerPresence";
import type { TownRoomState } from "./TownRoomState";
import { TOWN_MOVEMENT_SPEED_FALLBACK_UNITS_PER_SECOND } from "./resolvePlayerMovementSpeed";
import { tryExecutePendingAction } from "./deferredActionExecution";
import { isSegmentBlockedByAnyPolygon } from "./pointInPolygon";

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
    /**
     * Core 0.4x -- optional multiplier applied on top of each player's
     * stored `movementSpeed` for this tick only. Defaults to 1 (no
     * change), which is exactly what CombatRoom's call site relies on --
     * it passes no multiplier and stays completely unaffected. TownRoom
     * resolves this from its zone's classification (safe_hub) and passes
     * it explicitly; this function never looks at zoneId/classification
     * itself.
     */
    readonly movementSpeedMultiplier?: number;
    /**
     * Building footprint polygons (world units, zone-local) that block
     * movement. Defaults to none. A tick whose candidate next position
     * would land inside one of these polygons is stopped in place and
     * clears the player's movement target, rather than stepping into
     * the building; see `resolveZoneBuildingFootprints.ts`.
     */
    readonly buildingFootprints?: readonly (readonly WorldPropPoint[])[];
  },
): MovementStepResult {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return { movedPlayerCount: 0 };
  }

  const movementSpeedMultiplier =
    Number.isFinite(options?.movementSpeedMultiplier) && (options?.movementSpeedMultiplier as number) > 0
      ? (options?.movementSpeedMultiplier as number)
      : 1;

  const buildingFootprints = options?.buildingFootprints ?? [];
  let movedPlayerCount = 0;

  state.playerPresence.forEach((presence) => {
    if (!presence.hasMovementTarget) {
      return;
    }

    const baseSpeed =
      Number.isFinite(presence.movementSpeed) && presence.movementSpeed > 0
        ? presence.movementSpeed
        : TOWN_MOVEMENT_SPEED_FALLBACK_UNITS_PER_SECOND;
    const speed = baseSpeed * movementSpeedMultiplier;
    const maxDistance = speed * (deltaMs / 1000);

    if (stepPresenceTowardTarget(presence, maxDistance, buildingFootprints)) {
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
    "x" | "y" | "targetX" | "targetY" | "hasMovementTarget" | "pathWaypoints"
  >,
  maxDistance: number,
  buildingFootprints: readonly (readonly WorldPropPoint[])[],
): boolean {
  const deltaX = presence.targetX - presence.x;
  const deltaY = presence.targetY - presence.y;
  const distance = Math.hypot(deltaX, deltaY);

  const arriving = distance <= TOWN_MOVEMENT_STOP_DISTANCE || distance <= maxDistance;
  const scale = arriving ? 1 : maxDistance / distance;
  const nextX = arriving ? presence.targetX : presence.x + deltaX * scale;
  const nextY = arriving ? presence.targetY : presence.y + deltaY * scale;

  if (
    buildingFootprints.length > 0 &&
    isSegmentBlockedByAnyPolygon(presence.x, presence.y, nextX, nextY, buildingFootprints)
  ) {
    // Shouldn't normally trigger -- the caller's building-avoidance
    // path already routes around obstacles -- but abort the whole
    // queued route rather than get stuck retrying a blocked leg
    // forever if it ever does (stale/edge-case geometry).
    presence.hasMovementTarget = false;
    presence.pathWaypoints = "";
    return false;
  }

  presence.x = nextX;
  presence.y = nextY;

  if (arriving) {
    const nextWaypoint = popNextWaypoint(presence);
    if (nextWaypoint !== null) {
      presence.targetX = nextWaypoint.x;
      presence.targetY = nextWaypoint.y;
    } else {
      presence.hasMovementTarget = false;
    }
  }

  return true;
}

/**
 * Pop the next `x,y` pair off `presence.pathWaypoints` (see
 * `PlayerPresence.pathWaypoints` / `computeBuildingAvoidancePath`),
 * mutating the field to drop it. Returns `null` when no further
 * waypoints are queued.
 */
function popNextWaypoint(
  presence: Pick<PlayerPresence, "pathWaypoints">,
): { readonly x: number; readonly y: number } | null {
  if (presence.pathWaypoints.length === 0) {
    return null;
  }

  const parts = presence.pathWaypoints.split(",");
  const x = Number(parts[0]);
  const y = Number(parts[1]);

  if (parts.length < 2 || !Number.isFinite(x) || !Number.isFinite(y)) {
    presence.pathWaypoints = "";
    return null;
  }

  presence.pathWaypoints = parts.slice(2).join(",");
  return { x, y };
}