// ---------------------------------------------------------------------------
// Core 0.29 -- Room-Local Chat.
//
// Per-session chat rate limiting. Unlike dodge/attack/flask cooldowns,
// this is intentionally NOT a field on the synced `PlayerPresence`
// schema -- no client UI needs to show a chat-cooldown countdown, and
// every `PlayerPresence` field is broadcast to every client in the
// room (see docs/CORE_BUILD_0_27_PLAN.md's field-visibility audit), so
// a value nobody but the room needs stays off that schema entirely.
//
// Backed by a plain in-memory `Map<sessionId, number>`, mirroring
// `connectedPlayerRegistry.ts`'s module-level `Map` shape. A plain
// `Map` does not clean itself up when a client disconnects --
// `clearChatCooldown` exists specifically so `TownRoom.onLeave` /
// `CombatRoom.onLeave` can delete the entry explicitly, mirroring
// `connectedPlayerRegistry.ts`'s `unregisterConnectedPlayer` for the
// identical class of problem. Without this, `TownRoom` in particular
// (long-lived, never disposed, reused across every player who ever
// visits Nightmarket) would leak one entry per player who ever chatted.
// ---------------------------------------------------------------------------

const nextChatMessageAtBySessionId = new Map<string, number>();

/**
 * Fixed, server-owned chat cooldown. Generous enough that a real
 * person typing and hitting Enter never notices it; tight enough to
 * stop a script or held-Enter key from flooding the room.
 */
export const DEFAULT_CHAT_COOLDOWN_MS = 700;

export function isChatReady(sessionId: string, now: number): boolean {
  const nextChatMessageAt = nextChatMessageAtBySessionId.get(sessionId) ?? 0;
  return now >= nextChatMessageAt;
}

/**
 * Mark the session's next chat message availability as `now + cooldownMs`.
 * Returns the new `nextChatMessageAt` timestamp.
 */
export function consumeChatCooldown(
  sessionId: string,
  now: number,
  cooldownMs: number = DEFAULT_CHAT_COOLDOWN_MS,
): number {
  const nextChatMessageAt = now + cooldownMs;
  nextChatMessageAtBySessionId.set(sessionId, nextChatMessageAt);
  return nextChatMessageAt;
}

/**
 * Remove a session's cooldown entry entirely. Must be called from
 * every room's `onLeave` -- see the module doc comment above.
 */
export function clearChatCooldown(sessionId: string): void {
  nextChatMessageAtBySessionId.delete(sessionId);
}
