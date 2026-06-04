import type { Vector2 } from "../math/Vector2";

/**
 * Minimal player world position.
 *
 * Task 025 scope:
 *  - This is a data-only position shape used by the server when it
 *    initializes a player's presence from a spawn point.
 *  - It is intentionally the same shape as {@link Vector2}: x and y
 *    in shared world coordinates. Facing/direction is explicitly not
 *    part of this type yet.
 *  - This is not movement. The server sets it once on join from the
 *    resolved spawn point's x/y and never updates it from input or
 *    physics in this task.
 *
 * No movement, no pathing, no combat, no map, no facing, no game time
 * interpolation. Any change beyond a single x/y pair belongs in a
 * later dedicated task.
 */
export type PlayerPosition = Vector2;
