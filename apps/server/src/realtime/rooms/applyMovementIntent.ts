import type { TownRoomState } from "./TownRoomState";

/**
 * Apply a validated movement intent by updating the player's world
 * position in the Colyseus schema state.
 *
 * The change is broadcast automatically by Colyseus through the schema
 * synchronization mechanism — no manual broadcast is needed.
 *
 * This function mutates the state in-place. It only updates the
 * `PlayerPresence.x` and `PlayerPresence.y` fields. It does NOT:
 *  - validate the intent (caller must have run
 *    {@link validateMovementIntent} first)
 *  - check speed, cooldown, collision, pathfinding or map bounds
 *  - persist the new position to the database
 *  - trigger any gameplay events (combat, loot, etc.)
 *
 * Task 029 — Server Movement Simulation Step 1.
 *
 * @param state  The TownRoomState whose playerPresence will be updated.
 * @param sessionId  The Colyseus session ID of the moving player.
 * @param targetX  The validated target X coordinate.
 * @param targetY  The validated target Y coordinate.
 * @returns `true` if the presence entry was found and updated;
 *          `false` if no presence entry exists for the given sessionId.
 */
export function applyMovementIntent(
  state: TownRoomState,
  sessionId: string,
  targetX: number,
  targetY: number,
): boolean {
  const presence = state.playerPresence.get(sessionId);

  if (presence === undefined) {
    return false;
  }

  presence.x = targetX;
  presence.y = targetY;

  return true;
}