import type { Client, Room } from "colyseus";
import type {
  GlobalChatHistoryServerMessage,
  GlobalChatMessageServerMessage,
  RequestGlobalChatRejectedServerMessage,
} from "@doomscrolls/shared";
import type { PlayerPresence } from "./PlayerPresence";
import type { RoomLogger } from "./roomLogger";
import { validateGlobalChatMessage } from "./chatMessageValidation";
import { consumeGlobalChatCooldown, isGlobalChatReady } from "./globalChatCooldown";
import { broadcastToAllConnectedPlayers } from "./connectedPlayerRegistry";
import { ChatRepository } from "../../persistence/repositories/ChatRepository";

/**
 * Structural shape shared by TownRoomState and CombatRoomState -- see
 * `chatHandler.ts`'s identical interface for why this stays structural
 * rather than importing either concrete state class.
 */
interface RoomStateWithPlayerPresence {
  readonly playerPresence: {
    get(sessionId: string): PlayerPresence | undefined;
  };
}

/**
 * Global Chat -- server-run, logged chat reaching every connected
 * player, not just the sender's own room. Registers the
 * `request_global_chat` handler on `room`, mirroring
 * `registerChatHandler`'s shape (shared across TownRoom and
 * CombatRoom, no room-specific behavior). The two differences from
 * room-local chat:
 *
 *   - the accepted message is relayed via `broadcastToAllConnectedPlayers`
 *     instead of `room.broadcast`, so it reaches players in every room
 *     instance (Town zones and every sharded Combat zone alike);
 *   - the accepted message is persisted via `ChatRepository` so the
 *     conversation is logged server-side. The write is fire-and-forget
 *     (a chat message is not gameplay-critical state worth blocking the
 *     relay on) but failures are logged, never silently dropped.
 *
 * Moderation tooling (mute, delete, an admin console reading this log)
 * is explicitly out of scope here -- there is no admin/role concept in
 * the codebase yet to gate it on. This handler only makes sure every
 * accepted message is captured so that tooling has something to read
 * later.
 */
export function registerGlobalChatHandler(room: Room, log: RoomLogger): void {
  room.onMessage("request_global_chat", (client: Client, raw: unknown) => {
    const state = room.state as unknown as RoomStateWithPlayerPresence;
    const player = state.playerPresence.get(client.sessionId);

    if (player === undefined) {
      log.warn?.(
        {
          roomId: room.roomId,
          roomName: room.roomName,
          sessionId: client.sessionId,
        },
        "request_global_chat rejected: player not found.",
      );
      return;
    }

    const validation = validateGlobalChatMessage({ message: raw });
    if (!validation.ok) {
      sendGlobalChatRejection(client, validation.reason);
      log.warn?.(
        {
          roomId: room.roomId,
          roomName: room.roomName,
          sessionId: client.sessionId,
          reason: validation.reason,
        },
        "request_global_chat rejected: invalid message.",
      );
      return;
    }

    const now = Date.now();
    if (!isGlobalChatReady(client.sessionId, now)) {
      sendGlobalChatRejection(client, "chat_on_cooldown");
      log.debug?.(
        {
          roomId: room.roomId,
          roomName: room.roomName,
          sessionId: client.sessionId,
        },
        "request_global_chat rejected: chat on cooldown.",
      );
      return;
    }

    consumeGlobalChatCooldown(client.sessionId, now);

    const broadcastMessage: GlobalChatMessageServerMessage = {
      type: "global_chat_message",
      sessionId: client.sessionId,
      displayName: player.displayName,
      text: validation.text,
      sentAt: now,
    };

    broadcastToAllConnectedPlayers("global_chat_message", broadcastMessage);

    new ChatRepository()
      .create({
        channel: "global",
        characterId: player.characterId,
        displayName: player.displayName,
        text: validation.text,
      })
      .catch((error: unknown) => {
        log.error?.(
          {
            roomId: room.roomId,
            roomName: room.roomName,
            sessionId: client.sessionId,
            characterId: player.characterId,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to persist global chat message.",
        );
      });

    log.debug?.(
      {
        roomId: room.roomId,
        roomName: room.roomName,
        sessionId: client.sessionId,
      },
      "request_global_chat relayed to every connected player.",
    );
  });
}

/**
 * Number of recent global messages replayed to a joining client. Kept
 * in step with the client's own `MAX_RENDERED_MESSAGES` render cap
 * (`worldSessionChatView.ts`) -- there's no point fetching more history
 * than the chat log will ever display.
 */
const GLOBAL_CHAT_HISTORY_LIMIT = 50;

/**
 * Sends the recent global chat log to a just-joined client. Called
 * from `TownRoom.onJoin` / `CombatRoom.onJoin`; a failed fetch is
 * logged and swallowed rather than blocking the join.
 */
export async function sendGlobalChatHistory(client: Client, log: RoomLogger): Promise<void> {
  try {
    const history = await new ChatRepository().findRecentByChannel("global", GLOBAL_CHAT_HISTORY_LIMIT);
    const message: GlobalChatHistoryServerMessage = {
      type: "global_chat_history",
      messages: history,
    };
    client.send("global_chat_history", message);
  } catch (error: unknown) {
    log.error?.(
      {
        sessionId: client.sessionId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to load global chat history for joining client.",
    );
  }
}

function sendGlobalChatRejection(
  client: Client,
  reason: RequestGlobalChatRejectedServerMessage["reason"],
): void {
  const rejection: RequestGlobalChatRejectedServerMessage = {
    type: "request_global_chat_rejected",
    reason,
  };
  try {
    client.send("request_global_chat_rejected", rejection);
  } catch {
    // swallow send failures
  }
}
