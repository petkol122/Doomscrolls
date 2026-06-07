import type { Room } from "@colyseus/sdk";
import type {
  RequestUseHealingFlaskClientMessage,
  RequestUseHealingFlaskAcceptedServerMessage,
  RequestUseHealingFlaskRejectedServerMessage,
  RoomState,
} from "@doomscrolls/shared";

// ---------------------------------------------------------------------------
// Task 096 — Basic Healing Flask Foundation (client side).
//
// Mirrors the shape of `dodgeIntentClient` / `attackIntentClient`:
//
//   - the only sanctioned way for the client UI to send a
//     `request_use_healing_flask` intent is through
//     `sendHealingFlaskIntent(room)`;
//   - the helper does NOT decide whether the flask is usable;
//   - the server is the sole authority and replies with
//     `request_use_healing_flask_accepted` or
//     `request_use_healing_flask_rejected`;
//   - the helper does NOT read mouse / pointer / keyboard input;
//   - the helper does NOT mutate server state or local HP.
//
// `registerHealingFlaskResponseListeners` exposes a thin callback
// surface so the UI can show safe "healed" / "full HP" / "no charges"
// / "cooldown" / "downed" feedback without needing to know the raw
// Colyseus message type names.
// ---------------------------------------------------------------------------

export type SendHealingFlaskIntentResult =
  | { readonly dispatched: true }
  | { readonly dispatched: false; readonly reason: SendHealingFlaskIntentSkipReason };

export type SendHealingFlaskIntentSkipReason =
  | "no_room"
  | "room_not_joined";

export function sendHealingFlaskIntent(
  room: Room<RoomState> | null | undefined,
): SendHealingFlaskIntentResult {
  if (!room) {
    return { dispatched: false, reason: "no_room" };
  }

  const message: RequestUseHealingFlaskClientMessage = {
    type: "request_use_healing_flask",
  };

  try {
    room.send(message.type, message);
    return { dispatched: true };
  } catch {
    return { dispatched: false, reason: "room_not_joined" };
  }
}

export function registerHealingFlaskResponseListeners(
  room: Room<RoomState>,
  callbacks: {
    readonly onAccepted: (message: RequestUseHealingFlaskAcceptedServerMessage) => void;
    readonly onRejected: (message: RequestUseHealingFlaskRejectedServerMessage) => void;
  },
): void {
  room.onMessage("request_use_healing_flask_accepted", (raw: unknown) => {
    if (!isRequestUseHealingFlaskAcceptedServerMessage(raw)) {
      return;
    }
    callbacks.onAccepted(raw);
  });

  room.onMessage("request_use_healing_flask_rejected", (raw: unknown) => {
    if (!isRequestUseHealingFlaskRejectedServerMessage(raw)) {
      return;
    }
    callbacks.onRejected(raw);
  });
}

function isRequestUseHealingFlaskAcceptedServerMessage(
  value: unknown,
): value is RequestUseHealingFlaskAcceptedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "request_use_healing_flask_accepted"
    && typeof candidate.healedAmount === "number"
    && typeof candidate.remainingHp === "number"
    && typeof candidate.flaskCharges === "number"
    && typeof candidate.nextFlaskAt === "number"
  );
}

function isRequestUseHealingFlaskRejectedServerMessage(
  value: unknown,
): value is RequestUseHealingFlaskRejectedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== "request_use_healing_flask_rejected") {
    return false;
  }
  return typeof candidate.reason === "string";
}
