import type { Room } from "@colyseus/sdk";
import type {
  RequestDodgeClientMessage,
  RequestDodgeAcceptedServerMessage,
  RequestDodgeRejectedServerMessage,
  RoomState,
} from "@doomscrolls/shared";

// ---------------------------------------------------------------------------
// Client dodge intent helper (Task 095 -- Player Dodge Intent Foundation).
//
// Mirrors the shape of `movementIntentClient` / `attackIntentClient`:
//
//   - the only sanctioned way for the client UI to send a `request_dodge`
//     intent is through `sendDodgeIntent(room, dirX, dirY)`;
//   - the helper does NOT decide whether the dodge is valid;
//   - the server is the sole authority and replies with
//     `request_dodge_accepted` or `request_dodge_rejected`;
//   - the helper does NOT read mouse / pointer / keyboard input;
//   - the helper does NOT mutate server state.
//
// `registerDodgeResponseListeners` exposes a thin callback surface so
// the UI can show safe "dodge sent" / "dodge on cooldown" feedback
// without needing to know the raw Colyseus message type names.
// ---------------------------------------------------------------------------

export type SendDodgeIntentResult =
  | { readonly dispatched: true }
  | { readonly dispatched: false; readonly reason: SendDodgeIntentSkipReason };

export type SendDodgeIntentSkipReason =
  | "no_room"
  | "room_not_joined"
  | "invalid_direction";

export function sendDodgeIntent(
  room: Room<RoomState> | null | undefined,
  dirX: number,
  dirY: number,
): SendDodgeIntentResult {
  if (!room) {
    return { dispatched: false, reason: "no_room" };
  }
  if (room.connection?.isOpen !== true) {
    return { dispatched: false, reason: "room_not_joined" };
  }
  if (!Number.isFinite(dirX) || !Number.isFinite(dirY)) {
    return { dispatched: false, reason: "invalid_direction" };
  }
  if (dirX === 0 && dirY === 0) {
    return { dispatched: false, reason: "invalid_direction" };
  }

  const message: RequestDodgeClientMessage = {
    type: "request_dodge",
    dirX,
    dirY,
  };

  room.send(message.type, message);
  return { dispatched: true };
}

export function registerDodgeResponseListeners(
  room: Room<RoomState>,
  callbacks: {
    readonly onAccepted: (message: RequestDodgeAcceptedServerMessage) => void;
    readonly onRejected: (message: RequestDodgeRejectedServerMessage) => void;
  },
): void {
  room.onMessage("request_dodge_accepted", (raw: unknown) => {
    if (!isRequestDodgeAcceptedServerMessage(raw)) {
      return;
    }
    callbacks.onAccepted(raw);
  });

  room.onMessage("request_dodge_rejected", (raw: unknown) => {
    if (!isRequestDodgeRejectedServerMessage(raw)) {
      return;
    }
    callbacks.onRejected(raw);
  });
}

function isRequestDodgeAcceptedServerMessage(
  value: unknown,
): value is RequestDodgeAcceptedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (value as Record<string, unknown>).type === "request_dodge_accepted";
}

function isRequestDodgeRejectedServerMessage(
  value: unknown,
): value is RequestDodgeRejectedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== "request_dodge_rejected") {
    return false;
  }
  return typeof candidate.reason === "string";
}
