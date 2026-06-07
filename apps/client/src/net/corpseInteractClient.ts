import type { Room } from "@colyseus/sdk";
import type { RoomState } from "@doomscrolls/shared";

/**
 * Client-side helper to send a corpse interact intent to the server.
 *
 * The client may only ask to interact with its own corpse marker.
 * The server validates ownership, distance and lifeState.
 */
export function sendCorpseInteractIntent(room: Room<RoomState>): void {
  try {
    room.send("request_corpse_interact", { type: "request_corpse_interact" });
  } catch {
    // swallow send failures; the server is authoritative
  }
}