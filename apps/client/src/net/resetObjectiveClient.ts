import type { Room } from "@colyseus/sdk";
import type { RequestResetObjectiveClientMessage, RoomState } from "@doomscrolls/shared";

/**
 * Send a real objective reset intent through the joined room.
 */
export function sendResetObjectiveIntent(room: Room<RoomState>, slot: 1 | 2): void {
  const message: RequestResetObjectiveClientMessage = {
    type: "request_reset_objective",
    slot,
  };

  try {
    room.send("request_reset_objective", message);
  } catch {
    // Swallow send errors; room lifecycle handles disconnect state.
  }
}