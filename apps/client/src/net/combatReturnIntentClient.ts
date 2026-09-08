import type { Room } from "@colyseus/sdk";
import type { RoomState, RequestCombatReturnClientMessage } from "@doomscrolls/shared";

/**
 * Send a `request_combat_return` intent through the joined Colyseus room.
 * Only `CombatRoom` registers a handler for this message; sending it
 * anywhere else is a no-op server-side.
 */
export function sendCombatReturnIntent(
  room: Room<RoomState> | null,
  objectId: string,
): void {
  if (!room) {
    return;
  }

  const message: RequestCombatReturnClientMessage = {
    type: "request_combat_return",
    objectId,
  };

  try {
    room.send("request_combat_return", message);
  } catch {
    // Swallow send errors
  }
}
