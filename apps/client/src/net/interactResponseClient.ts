import type { Room } from "@colyseus/sdk";
import type {
  DeferredActionQueuedServerMessage,
  RoomState,
  InteractResponseServerMessage,
} from "@doomscrolls/shared";

/**
 * Task 057 — Interactable Object Foundation Batch
 *
 * Register listeners for interact responses from the server.
 * Display response messages safely to the player.
 */
export function registerInteractResponseListener(
  room: Room<RoomState>,
  onResponse: (message: string) => void,
): void {
  room.onMessage("interact_response", (raw: unknown) => {
    const msg = raw as Partial<InteractResponseServerMessage> | null;
    if (!msg || typeof msg.message !== "string") {
      return;
    }
    onResponse(msg.message);
  });

  room.onMessage("deferred_action_queued", (raw: unknown) => {
    const msg = raw as Partial<DeferredActionQueuedServerMessage> | null;
    if (!msg || typeof msg.message !== "string") {
      return;
    }
    onResponse(msg.message);
  });
}
