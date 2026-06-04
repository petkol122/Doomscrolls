import type { Room } from "@colyseus/sdk";
import type {
  RequestMoveClientMessage,
  RequestMoveRejectedServerMessage,
  RoomState,
} from "@doomscrolls/shared";

// ---------------------------------------------------------------------------
// Client movement intent helper (Task 026 — Player Movement Intent
// Foundation Batch).
//
// This module is intentionally tiny and isolated from `AccountShellScene`
// and from any UI / mouse handling. It only exposes a single function
// that sends a `request_move` intent through an already-joined Colyseus
// room. It does NOT:
//
//   - read mouse / pointer / keyboard input
//   - know about Phaser, scenes or the AccountShellScene
//   - know about maps, collision, pathfinding or movement simulation
//   - mutate any server-side state
//
// The goal of this foundation batch is to put the network contract in
// place so later tasks (click-to-move, server movement simulation,
// facing / interpolation) can wire UI on top of it without changing the
// shared types or the server message handler.
// ---------------------------------------------------------------------------

/**
 * Result returned by {@link sendMovementIntent}. Intentionally narrow:
 * the helper reports whether the intent was dispatched to the
 * underlying room transport. The server's authoritative accept / reject
 * decision (currently delivered as `request_move_rejected` for
 * shape/range failures) is delivered asynchronously through the
 * Colyseus `message` event on the same room.
 */
export type SendMovementIntentResult =
  | { readonly dispatched: true }
  | { readonly dispatched: false; readonly reason: SendMovementIntentSkipReason };

export type SendMovementIntentSkipReason =
  | "no_room"
  | "room_not_joined"
  | "invalid_target";

export interface SendMovementIntentOptions {
  /**
   * Optional client-side timestamp echoed back by the server on
   * rejection. Currently informational only — the server does not
   * use it for any gameplay outcome.
   */
  readonly clientTime?: number;
}

/**
 * Send a `request_move` intent through an already-joined Colyseus
 * room.
 *
 * The helper does not decide whether the room is in a state where
 * the intent is meaningful; it only checks the minimum conditions
 * required to safely forward a message:
 *   - a room reference is supplied
 *   - the room's connection state allows sending
 *   - the target coordinates are finite numbers
 *
 * Returns `{ dispatched: false, reason }` when the helper refuses to
 * send (so the caller does not have to catch). The server's
 * authoritative rejection (currently `request_move_rejected`) is
 * delivered separately through the room's `message` event and is
 * not surfaced through this return value.
 */
export function sendMovementIntent(
  room: Room<RoomState> | null | undefined,
  targetX: number,
  targetY: number,
  options: SendMovementIntentOptions = {},
): SendMovementIntentResult {
  if (!room) {
    return { dispatched: false, reason: "no_room" };
  }
  if (room.connection?.isOpen !== true) {
    return { dispatched: false, reason: "room_not_joined" };
  }
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
    return { dispatched: false, reason: "invalid_target" };
  }

  const message: RequestMoveClientMessage =
    options.clientTime !== undefined
      ? { type: "request_move", targetX, targetY, clientTime: options.clientTime }
      : { type: "request_move", targetX, targetY };

  room.send(message.type, message);
  return { dispatched: true };
}

/**
 * Type guard for the server's `request_move_rejected` message. UI
 * code that wants to surface movement-intent rejection can use this
 * to narrow a generic `message` payload before reading `reason` or
 * `clientTime`.
 */
export function isRequestMoveRejectedServerMessage(
  value: unknown,
): value is RequestMoveRejectedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== "request_move_rejected") {
    return false;
  }
  if (typeof candidate.reason !== "string") {
    return false;
  }
  if (
    candidate.clientTime !== undefined &&
    typeof candidate.clientTime !== "number"
  ) {
    return false;
  }
  return true;
}
