import type { TownRoomState } from "./TownRoomState";
/**
 * Apply a validated movement intent by updating the player's server-owned
 * target position in the Colyseus schema state.
 *
 * The change is broadcast automatically by Colyseus through the schema
 * synchronization mechanism — no manual broadcast is needed.
 *
 * This function mutates the state in-place. It stores the requested
 * target in `hasMovementTarget` / `targetX` / `targetY`. Position updates
 * happen later on the room simulation tick. It does NOT:
 *  - validate the intent (caller must have run
 *    {@link validateMovementIntent} first)
 *  - move the player immediately
 *  - perform pathfinding, collision, interpolation or persistence
 *  - persist the new position to the database
 *  - trigger any gameplay events (combat, loot, etc.)
 *
 * Task 029 — Server Movement Simulation Step 1.
 *
 * @param state  The TownRoomState whose playerPresence will be updated.
 * @param sessionId  The Colyseus session ID of the moving player.
 * @param targetX  The validated target X coordinate.
 * @param targetY  The validated target Y coordinate.
 * @returns The stored target if the presence entry was found and updated;
 *          `null` if no presence entry exists for the given sessionId.
 */
export function applyMovementIntent(
  state: TownRoomState,
  sessionId: string,
  targetX: number,
  targetY: number,
): { readonly x: number; readonly y: number } | null {
  const presence = state.playerPresence.get(sessionId);

  if (presence === undefined) {
    return null;
  }

  presence.hasMovementTarget = true;
  presence.targetX = targetX;
  presence.targetY = targetY;

  return { x: targetX, y: targetY };
}