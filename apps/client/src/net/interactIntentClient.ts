import type { Room } from "@colyseus/sdk";
import type { RoomState, RequestInteractClientMessage } from "@doomscrolls/shared";

/**
 * Task 057 — Interactable Object Foundation Batch
 *
 * Send interact request through the joined Colyseus room.
 */
export function sendInteractIntent(
  room: Room<RoomState> | null,
  objectId: string,
): void {
  if (!room) {
    return;
  }

  const message: RequestInteractClientMessage = {
    type: "request_interact",
    objectId,
  };

  try {
    room.send("request_interact", message);
  } catch {
    // Swallow send errors
  }
}
