// ---------------------------------------------------------------------------
// Global Chat -- per-session rate limiting.
//
// Separate `Map` from `chatCooldown.ts`'s room-local one: global chat
// reaches every connected player process-wide (a much larger blast
// radius per message than a single room), so it is rate-limited
// independently rather than sharing a bucket with room-local chat.
// Same shape and cleanup contract as `chatCooldown.ts` --
// `clearGlobalChatCooldown` must be called from every room's
// `onLeave`, or a long-lived room like TownRoom leaks one entry per
// player who ever sent a global chat message.
// ---------------------------------------------------------------------------

const nextGlobalChatMessageAtBySessionId = new Map<string, number>();

/**
 * Slightly longer than `DEFAULT_CHAT_COOLDOWN_MS` (700 ms) -- a global
 * message is seen by every connected player, not just one room, so the
 * bar for "generous enough that typing never notices it" can sit a bit
 * higher while still comfortably outpacing normal typing speed.
 */
export const DEFAULT_GLOBAL_CHAT_COOLDOWN_MS = 1500;

export function isGlobalChatReady(sessionId: string, now: number): boolean {
  const nextMessageAt = nextGlobalChatMessageAtBySessionId.get(sessionId) ?? 0;
  return now >= nextMessageAt;
}

export function consumeGlobalChatCooldown(
  sessionId: string,
  now: number,
  cooldownMs: number = DEFAULT_GLOBAL_CHAT_COOLDOWN_MS,
): number {
  const nextMessageAt = now + cooldownMs;
  nextGlobalChatMessageAtBySessionId.set(sessionId, nextMessageAt);
  return nextMessageAt;
}

export function clearGlobalChatCooldown(sessionId: string): void {
  nextGlobalChatMessageAtBySessionId.delete(sessionId);
}
