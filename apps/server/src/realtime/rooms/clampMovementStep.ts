import type { PlayerPresence } from "./PlayerPresence";

export const MAX_MOVE_STEP = 48;

export interface ClampedMovementTarget {
  readonly x: number;
  readonly y: number;
}

/**
 * Clamp a requested movement target so a single accepted request cannot
 * move farther than {@link MAX_MOVE_STEP} from the player's current
 * position.
 *
 * This helper is intentionally narrow. It does not validate the request,
 * know about rooms/zones, perform pathfinding/collision, or mutate the
 * provided presence.
 */
export function clampMovementStep(
  presence: Pick<PlayerPresence, "x" | "y">,
  targetX: number,
  targetY: number,
  maxStep: number = MAX_MOVE_STEP,
): ClampedMovementTarget {
  const deltaX = targetX - presence.x;
  const deltaY = targetY - presence.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance <= maxStep || distance === 0) {
    return { x: targetX, y: targetY };
  }

  const scale = maxStep / distance;
  return {
    x: presence.x + deltaX * scale,
    y: presence.y + deltaY * scale,
  };
}