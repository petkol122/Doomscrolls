import type { Room } from "@colyseus/sdk";
import type {
  FlaskBeltSlotNumber,
  RequestUseFlaskSlotAcceptedServerMessage,
  RequestUseFlaskSlotClientMessage,
  RequestUseFlaskSlotRejectedServerMessage,
  RoomState,
} from "@doomscrolls/shared";

// ---------------------------------------------------------------------------
// Milestone 0.3 -- 4-Slot Flask Belt (client side).
//
// Mirrors the shape of `skillSlotIntentClient`/the old
// `healingFlaskIntentClient` it replaces:
//
//   - the only sanctioned way for the client UI to send a
//     `request_use_flask_slot` intent is through
//     `sendFlaskSlotIntent(room, slot)`;
//   - the helper does NOT decide whether the slot is usable;
//   - the server is the sole authority and replies with
//     `request_use_flask_slot_accepted` or
//     `request_use_flask_slot_rejected`;
//   - the helper does NOT read mouse / pointer / keyboard input;
//   - the helper does NOT mutate server state or local HP/mana.
// ---------------------------------------------------------------------------

export type SendFlaskSlotIntentResult =
  | { readonly dispatched: true }
  | { readonly dispatched: false; readonly reason: SendFlaskSlotIntentSkipReason };

export type SendFlaskSlotIntentSkipReason =
  | "no_room"
  | "room_not_joined";

export function sendFlaskSlotIntent(
  room: Room<RoomState> | null | undefined,
  slot: FlaskBeltSlotNumber,
): SendFlaskSlotIntentResult {
  if (!room) {
    return { dispatched: false, reason: "no_room" };
  }

  const message: RequestUseFlaskSlotClientMessage = {
    type: "request_use_flask_slot",
    slot,
  };

  try {
    room.send(message.type, message);
    return { dispatched: true };
  } catch {
    return { dispatched: false, reason: "room_not_joined" };
  }
}

export function registerFlaskSlotResponseListeners(
  room: Room<RoomState>,
  callbacks: {
    readonly onAccepted: (message: RequestUseFlaskSlotAcceptedServerMessage) => void;
    readonly onRejected: (message: RequestUseFlaskSlotRejectedServerMessage) => void;
  },
): void {
  room.onMessage("request_use_flask_slot_accepted", (raw: unknown) => {
    if (!isRequestUseFlaskSlotAcceptedServerMessage(raw)) {
      return;
    }
    callbacks.onAccepted(raw);
  });

  room.onMessage("request_use_flask_slot_rejected", (raw: unknown) => {
    if (!isRequestUseFlaskSlotRejectedServerMessage(raw)) {
      return;
    }
    callbacks.onRejected(raw);
  });
}

function isRequestUseFlaskSlotAcceptedServerMessage(
  value: unknown,
): value is RequestUseFlaskSlotAcceptedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "request_use_flask_slot_accepted"
    && typeof candidate.slot === "number"
    && typeof candidate.effectType === "string"
    && typeof candidate.healedAmount === "number"
    && typeof candidate.remainingHp === "number"
    && typeof candidate.remainingMana === "number"
    && typeof candidate.charges === "number"
    && typeof candidate.nextReadyAt === "number"
  );
}

function isRequestUseFlaskSlotRejectedServerMessage(
  value: unknown,
): value is RequestUseFlaskSlotRejectedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "request_use_flask_slot_rejected"
    && typeof candidate.slot === "number"
    && typeof candidate.reason === "string"
  );
}
