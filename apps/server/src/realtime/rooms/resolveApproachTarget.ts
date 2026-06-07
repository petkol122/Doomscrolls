/**
 * Task 206 -- resolve the server-owned movement "stop point" used by
 * deferred action queues (`attack`, `pickup`, `interact`).
 *
 * When a player clicks a target that is currently out of engagement
 * range, the server stores a pending action and a movement target. The
 * naive approach is to walk the player to the target's exact position.
 * This helper computes a stop point along the player -> target line at
 * exactly `stopDistance` units from the target, so the player stops
 * cleanly at engagement range instead of walking on top of the target
 * and bumping against it.
 *
 * The math is intentionally side-effect-free and pure. The server
 * still owns and applies the resolved target via
 * {@link applyMovementIntent}. No client authority, no pathfinding, no
 * collision.
 *
 * If the player is already at or within `stopDistance` from the
 * target, the helper returns the player's current position so the
 * queued action fires immediately on the next tick.
 *
 * If the input is invalid (non-finite, zero-length direction, negative
 * or non-finite `stopDistance`), the helper falls back to the target
 * point so the server never produces a NaN movement target.
 */
export function resolveApproachTarget(
  player: { readonly x: number; readonly y: number },
  target: { readonly x: number; readonly y: number },
  stopDistance: number,
): { readonly x: number; readonly y: number } {
  if (
    !Number.isFinite(player.x)
    || !Number.isFinite(player.y)
    || !Number.isFinite(target.x)
    || !Number.isFinite(target.y)
    || !Number.isFinite(stopDistance)
    || stopDistance < 0
  ) {
    return { x: target.x, y: target.y };
  }

  const deltaX = target.x - player.x;
  const deltaY = target.y - player.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance <= stopDistance || distance <= 0) {
    // Already at engagement range, or the player is sitting on the
    // target. No approach movement is needed; the queued action will
    // fire from the current player position on the next tick.
    return { x: player.x, y: player.y };
  }

  const scale = (distance - stopDistance) / distance;
  return {
    x: player.x + deltaX * scale,
    y: player.y + deltaY * scale,
  };
}
