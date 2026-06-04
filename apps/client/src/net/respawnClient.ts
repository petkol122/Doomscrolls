import type { Room } from "@colyseus/sdk";
import type { PlayerRespawnedServerMessage, RequestRespawnClientMessage, RoomState } from "@doomscrolls/shared";

export function sendRespawnRequest(
  room: Room<RoomState> | null | undefined,
): { readonly dispatched: true } | { readonly dispatched: false; readonly reason: "no_room" | "room_not_joined" } {
  if (!room) {
    return { dispatched: false, reason: "no_room" };
  }
  if (room.connection?.isOpen !== true) {
    return { dispatched: false, reason: "room_not_joined" };
  }

  const message: RequestRespawnClientMessage = { type: "request_respawn" };
  room.send(message.type, message);
  return { dispatched: true };
}

export function registerRespawnListeners(
  room: Room<RoomState>,
  callbacks: { readonly onRespawned: (message: PlayerRespawnedServerMessage) => void },
): void {
  room.onMessage("player_respawned", (raw: unknown) => {
    if (!isPlayerRespawnedServerMessage(raw)) {
      return;
    }
    callbacks.onRespawned(raw);
  });
}

function isPlayerRespawnedServerMessage(value: unknown): value is PlayerRespawnedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return candidate.type === "player_respawned"
    && typeof candidate.characterId === "string"
    && typeof candidate.zoneId === "string"
    && typeof candidate.hp === "number";
}