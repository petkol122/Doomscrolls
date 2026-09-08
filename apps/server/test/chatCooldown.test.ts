import { describe, expect, it } from "vitest";
import {
  clearChatCooldown,
  consumeChatCooldown,
  isChatReady,
} from "../src/realtime/rooms/chatCooldown";

/**
 * Core 0.29 -- a direct unit test against `chatCooldown.ts`, not a
 * Colyseus integration test. An end-to-end "disconnect and reconnect"
 * test was considered and rejected for this: Colyseus assigns every
 * connection a fresh `sessionId`, so a reconnecting client gets a new
 * Map key regardless of whether the old entry was ever cleared -- a
 * test built that way would pass identically whether `clearChatCooldown`
 * is wired into `onLeave` or not, proving nothing. This test instead
 * proves the module's own contract directly: consuming a cooldown
 * makes a session not-ready, and clearing it makes the session ready
 * again immediately, without waiting out the cooldown. See
 * docs/CORE_BUILD_0_29_PLAN.md's Risk 5 and Question 3 correction.
 */
describe("chatCooldown", () => {
  it("is ready for a session that has never sent a message", () => {
    expect(isChatReady("session-never-seen", Date.now())).toBe(true);
  });

  it("is not ready immediately after consuming the cooldown", () => {
    const sessionId = "session-consume";
    const now = Date.now();
    consumeChatCooldown(sessionId, now, 700);
    expect(isChatReady(sessionId, now)).toBe(false);
    expect(isChatReady(sessionId, now + 699)).toBe(false);
    expect(isChatReady(sessionId, now + 700)).toBe(true);
  });

  it("clearChatCooldown makes the session ready again immediately, without waiting out the cooldown", () => {
    const sessionId = "session-clear";
    const now = Date.now();
    consumeChatCooldown(sessionId, now, 700);
    expect(isChatReady(sessionId, now)).toBe(false);

    clearChatCooldown(sessionId);

    expect(isChatReady(sessionId, now)).toBe(true);
  });

  it("clearChatCooldown on an unknown session is a safe no-op", () => {
    expect(() => clearChatCooldown("session-never-consumed")).not.toThrow();
  });
});
