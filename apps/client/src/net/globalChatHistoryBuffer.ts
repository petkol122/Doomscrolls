import type { Room } from "@colyseus/sdk";
import type { GlobalChatHistoryServerMessage, RoomState } from "@doomscrolls/shared";

/**
 * Same race `equipmentUpdateBuffer.ts` guards against: the server sends
 * `global_chat_history` during `onJoin` so a player who logs back in
 * sees the recent conversation instead of an empty log, but that
 * message can arrive over the socket before `WorldSessionScene` exists
 * to register the chat view's listener (the gap between the join
 * resolving and the new scene's `create()` running). Colyseus drops a
 * message with no handler registered for its type instead of queuing
 * it, so without this buffer the join-time history is silently lost.
 *
 * `bufferGlobalChatHistoryFor` is called immediately after a room join
 * resolves (the earliest point client code can run), well before any
 * scene transition. `consumeBufferedGlobalChatHistory` is called once
 * the chat view mounts, to pick up whatever arrived in the meantime.
 */
const bufferedHistoryByRoom = new WeakMap<Room<RoomState>, GlobalChatHistoryServerMessage["messages"]>();

export function bufferGlobalChatHistoryFor(room: Room<RoomState>): void {
  room.onMessage("global_chat_history", (message: unknown) => {
    const msg = message as GlobalChatHistoryServerMessage;
    if (msg.type === "global_chat_history" && Array.isArray(msg.messages)) {
      bufferedHistoryByRoom.set(room, msg.messages);
    }
  });
}

export function consumeBufferedGlobalChatHistory(
  room: Room<RoomState>,
): GlobalChatHistoryServerMessage["messages"] | null {
  const history = bufferedHistoryByRoom.get(room) ?? null;
  bufferedHistoryByRoom.delete(room);
  return history;
}
