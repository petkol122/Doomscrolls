import type { Client, Room } from "colyseus";
import type {
  ChatMessageServerMessage,
  RequestChatRejectedServerMessage,
} from "@doomscrolls/shared";
import type { PlayerPresence } from "./PlayerPresence";
import type { RoomLogger } from "./roomLogger";
import { validateChatMessage } from "./chatMessageValidation";
import { consumeChatCooldown, isChatReady } from "./chatCooldown";

/**
 * Structural shape shared by TownRoomState and CombatRoomState -- both
 * declare `playerPresence` as a `MapSchema<PlayerPresence>` keyed by
 * sessionId. Kept structural (not imported from either concrete state
 * class), same pattern as `connectedPlayerRegistry.ts`'s
 * `RoomStateWithPlayerPresence`, so this handler stays usable from
 * either room without a dependency on one or the other.
 */
interface RoomStateWithPlayerPresence {
  readonly playerPresence: {
    get(sessionId: string): PlayerPresence | undefined;
  };
}

/**
 * Core 0.29 -- Room-Local Chat.
 *
 * Registers the `request_chat` handler on `room`. Unlike
 * `request_dodge` / `request_attack` (each independently registered
 * per room because they diverge on room-specific combat behavior),
 * chat has no room-specific behavior at all -- a message means the
 * same thing in TownRoom and CombatRoom. This is therefore a single
 * shared handler called from both `TownRoom.onCreate` and
 * `CombatRoom.onCreate`, rather than a per-room `registerXHandler`
 * method. See docs/CORE_BUILD_0_29_PLAN.md.
 *
 * The caller is responsible for its own double-registration guard
 * flag (e.g. `this.chatHandlerRegistered`), matching the convention
 * every other room handler already uses.
 */
export function registerChatHandler(room: Room, log: RoomLogger): void {
  room.onMessage("request_chat", (client: Client, raw: unknown) => {
    const state = room.state as unknown as RoomStateWithPlayerPresence;
    const player = state.playerPresence.get(client.sessionId);

    if (player === undefined) {
      log.warn?.(
        {
          roomId: room.roomId,
          roomName: room.roomName,
          sessionId: client.sessionId,
        },
        "request_chat rejected: player not found.",
      );
      return;
    }

    const validation = validateChatMessage({ message: raw });
    if (!validation.ok) {
      sendChatRejection(client, validation.reason);
      log.warn?.(
        {
          roomId: room.roomId,
          roomName: room.roomName,
          sessionId: client.sessionId,
          reason: validation.reason,
        },
        "request_chat rejected: invalid message.",
      );
      return;
    }

    const now = Date.now();
    if (!isChatReady(client.sessionId, now)) {
      sendChatRejection(client, "chat_on_cooldown");
      log.debug?.(
        {
          roomId: room.roomId,
          roomName: room.roomName,
          sessionId: client.sessionId,
        },
        "request_chat rejected: chat on cooldown.",
      );
      return;
    }

    consumeChatCooldown(client.sessionId, now);

    const broadcastMessage: ChatMessageServerMessage = {
      type: "chat_message",
      sessionId: client.sessionId,
      displayName: player.displayName,
      text: validation.text,
      sentAt: now,
    };

    // First use of Colyseus's `broadcast()` in this codebase -- every
    // prior "everyone in the room finds out" case was schema sync or a
    // targeted `client.send`. `broadcast` only reaches `this.clients`
    // on the room it's called on, so this is inherently room-local;
    // see the room-isolation test in docs/CORE_BUILD_0_29_PLAN.md.
    room.broadcast("chat_message", broadcastMessage);

    log.debug?.(
      {
        roomId: room.roomId,
        roomName: room.roomName,
        sessionId: client.sessionId,
      },
      "request_chat relayed to room.",
    );
  });
}

function sendChatRejection(
  client: Client,
  reason: RequestChatRejectedServerMessage["reason"],
): void {
  const rejection: RequestChatRejectedServerMessage = {
    type: "request_chat_rejected",
    reason,
  };
  try {
    client.send("request_chat_rejected", rejection);
  } catch {
    // swallow send failures
  }
}
