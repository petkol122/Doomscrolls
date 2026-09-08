import type { Room } from "@colyseus/sdk";
import type {
  ChatMessageServerMessage,
  RequestChatClientMessage,
  RequestChatRejectedServerMessage,
  RoomState,
} from "@doomscrolls/shared";

/**
 * Mirrors `MAX_CHAT_MESSAGE_LENGTH` in
 * `apps/server/src/realtime/rooms/chatMessageValidation.ts`. The server
 * is the sole authority for this limit -- this copy exists only so the
 * client can reject an obviously-too-long message before a round trip,
 * not to decide validity itself. Keep both values in sync by hand if
 * the cap ever changes.
 */
const MAX_CHAT_MESSAGE_LENGTH = 240;

// ---------------------------------------------------------------------------
// Core 0.29 -- Room-Local Chat.
//
// Mirrors the shape of `dodgeIntentClient` / `healingFlaskIntentClient`:
//
//   - the only sanctioned way for the client UI to send a `request_chat`
//     intent is through `sendChatMessage(room, text)`;
//   - the helper does NOT decide whether the message is valid beyond a
//     cheap client-side early guard (trim, non-empty, under the length
//     cap) -- the server remains the sole authority;
//   - the server relays accepted messages by broadcasting `chat_message`
//     to the room (including back to the sender -- there is no separate
//     `request_chat_accepted`), or replies with `request_chat_rejected`.
// ---------------------------------------------------------------------------

export type SendChatMessageResult =
  | { readonly dispatched: true }
  | { readonly dispatched: false; readonly reason: SendChatMessageSkipReason };

export type SendChatMessageSkipReason =
  | "no_room"
  | "room_not_joined"
  | "empty_message"
  | "message_too_long";

export function sendChatMessage(
  room: Room<RoomState> | null | undefined,
  text: string,
): SendChatMessageResult {
  if (!room) {
    return { dispatched: false, reason: "no_room" };
  }
  if (room.connection?.isOpen !== true) {
    return { dispatched: false, reason: "room_not_joined" };
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { dispatched: false, reason: "empty_message" };
  }
  if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) {
    return { dispatched: false, reason: "message_too_long" };
  }

  const message: RequestChatClientMessage = {
    type: "request_chat",
    text: trimmed,
  };

  room.send(message.type, message);
  return { dispatched: true };
}

export function registerChatMessageListeners(
  room: Room<RoomState>,
  callbacks: {
    readonly onMessage: (message: ChatMessageServerMessage) => void;
    readonly onRejected: (message: RequestChatRejectedServerMessage) => void;
  },
): void {
  room.onMessage("chat_message", (raw: unknown) => {
    if (!isChatMessageServerMessage(raw)) {
      return;
    }
    callbacks.onMessage(raw);
  });

  room.onMessage("request_chat_rejected", (raw: unknown) => {
    if (!isRequestChatRejectedServerMessage(raw)) {
      return;
    }
    callbacks.onRejected(raw);
  });
}

function isChatMessageServerMessage(value: unknown): value is ChatMessageServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== "chat_message") {
    return false;
  }
  return (
    typeof candidate.sessionId === "string"
    && typeof candidate.displayName === "string"
    && typeof candidate.text === "string"
    && typeof candidate.sentAt === "number"
  );
}

function isRequestChatRejectedServerMessage(
  value: unknown,
): value is RequestChatRejectedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== "request_chat_rejected") {
    return false;
  }
  return typeof candidate.reason === "string";
}
