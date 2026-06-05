import type { Room } from "@colyseus/sdk";
import type {
  RequestPickupWorldLootAcceptedServerMessage,
  RequestPickupWorldLootClientMessage,
  RequestPickupWorldLootRejectedServerMessage,
  RoomState,
} from "@doomscrolls/shared";

export type SendPickupWorldLootIntentResult =
  | { readonly dispatched: true }
  | {
      readonly dispatched: false;
      readonly reason: "no_room" | "room_not_joined" | "invalid_world_loot_id";
    };

export function sendPickupWorldLootIntent(
  room: Room<RoomState> | null | undefined,
  worldLootId: string,
): SendPickupWorldLootIntentResult {
  if (!room) {
    return { dispatched: false, reason: "no_room" };
  }
  if (room.connection?.isOpen !== true) {
    return { dispatched: false, reason: "room_not_joined" };
  }
  if (typeof worldLootId !== "string" || worldLootId.length === 0) {
    return { dispatched: false, reason: "invalid_world_loot_id" };
  }

  const message: RequestPickupWorldLootClientMessage = {
    type: "request_pickup_world_loot",
    worldLootId,
  };

  room.send(message.type, message);
  return { dispatched: true };
}

export function registerPickupWorldLootResponseListeners(
  room: Room<RoomState>,
  callbacks: {
    readonly onAccepted: (message: RequestPickupWorldLootAcceptedServerMessage) => void;
    readonly onRejected: (message: RequestPickupWorldLootRejectedServerMessage) => void;
  },
): void {
  room.onMessage("request_pickup_world_loot_accepted", (raw: unknown) => {
    if (!isRequestPickupWorldLootAcceptedServerMessage(raw)) {
      return;
    }
    callbacks.onAccepted(raw);
  });

  room.onMessage("request_pickup_world_loot_rejected", (raw: unknown) => {
    if (!isRequestPickupWorldLootRejectedServerMessage(raw)) {
      return;
    }
    callbacks.onRejected(raw);
  });
}

function isRequestPickupWorldLootAcceptedServerMessage(
  value: unknown,
): value is RequestPickupWorldLootAcceptedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "request_pickup_world_loot_accepted" &&
    typeof candidate.worldLootId === "string" &&
    typeof candidate.message === "string" &&
    (candidate.itemLabel === undefined || typeof candidate.itemLabel === "string") &&
    (candidate.rarity === undefined || typeof candidate.rarity === "string")
  );
}

function isRequestPickupWorldLootRejectedServerMessage(
  value: unknown,
): value is RequestPickupWorldLootRejectedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.type !== "request_pickup_world_loot_rejected") {
    return false;
  }
  if (typeof candidate.reason !== "string") {
    return false;
  }
  if (
    candidate.worldLootId !== undefined &&
    typeof candidate.worldLootId !== "string"
  ) {
    return false;
  }
  return true;
}