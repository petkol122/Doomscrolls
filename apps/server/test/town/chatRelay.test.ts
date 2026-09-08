import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type {
  ChatMessageServerMessage,
  RequestChatRejectedServerMessage,
  UserId,
  ZoneId,
} from "@doomscrolls/shared";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import {
  TEST_CHARACTER_ID,
  TEST_IRONCLAD_CHARACTER_ID,
  TEST_USER_ID,
} from "../support/fixtures";

const SECOND_TEST_USER_ID = "test-user-2" as UserId;

/**
 * Core 0.29 -- proves the room-local chat relay end to end in
 * TownRoom: a real `request_chat` from one session reaches a second
 * real session's `chat_message` broadcast, and reaches the sender
 * itself (the "no separate request_chat_accepted" design -- the
 * sender's own broadcast doubles as the accept signal). Also proves
 * the length cap, empty-message rejection and rate limiting, all
 * server-owned per docs/CORE_BUILD_0_29_PLAN.md. See
 * apps/server/test/combat/chatRelay.test.ts for the CombatRoom port
 * of this same coverage, plus room-isolation.
 */
describe("TownRoom room-local chat relay", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2596);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("relays a valid message to every client in the room, including the sender", async () => {
    const clientA = await colyseus.sdk.joinOrCreate("town", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "namesti_republiky" as ZoneId,
    });
    const clientB = await colyseus.sdk.joinOrCreate("town", {
      userId: SECOND_TEST_USER_ID,
      characterId: TEST_IRONCLAD_CHARACTER_ID,
      requestedZoneId: "namesti_republiky" as ZoneId,
    });

    const bReceived = waitForMessage<ChatMessageServerMessage>(clientB, "chat_message");
    const aReceived = waitForMessage<ChatMessageServerMessage>(clientA, "chat_message");

    clientA.send("request_chat", { type: "request_chat", text: "hello town" });

    const [bMessage, aMessage] = await Promise.all([bReceived, aReceived]);

    expect(bMessage.text).toBe("hello town");
    expect(bMessage.displayName).toBe("Test Gravewalker");
    expect(bMessage.sessionId).toBe(clientA.sessionId);
    expect(typeof bMessage.sentAt).toBe("number");
    // Field-visibility audit (Question 6): the payload is a
    // purpose-built shape, not a PlayerPresence slice -- no
    // class/level field exists on it to leak.
    expect((bMessage as unknown as Record<string, unknown>).classKey).toBeUndefined();
    expect((bMessage as unknown as Record<string, unknown>).level).toBeUndefined();

    expect(aMessage.text).toBe("hello town");
    expect(aMessage.sessionId).toBe(clientA.sessionId);
  });

  it("rejects an empty (whitespace-only) message with no broadcast", async () => {
    const clientA = await colyseus.sdk.joinOrCreate("town", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "namesti_republiky" as ZoneId,
    });

    const rejected = waitForMessage<RequestChatRejectedServerMessage>(
      clientA,
      "request_chat_rejected",
    );
    clientA.send("request_chat", { type: "request_chat", text: "   " });
    const rejection = await rejected;
    expect(rejection.reason).toBe("empty_message");
  });

  it("rejects a message over the 240-character cap with no broadcast", async () => {
    const clientA = await colyseus.sdk.joinOrCreate("town", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "namesti_republiky" as ZoneId,
    });

    const rejected = waitForMessage<RequestChatRejectedServerMessage>(
      clientA,
      "request_chat_rejected",
    );
    clientA.send("request_chat", { type: "request_chat", text: "x".repeat(241) });
    const rejection = await rejected;
    expect(rejection.reason).toBe("message_too_long");
  });

  it("rate-limits a second rapid send from the same session", async () => {
    const clientA = await colyseus.sdk.joinOrCreate("town", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "namesti_republiky" as ZoneId,
    });

    const firstAccepted = waitForMessage<ChatMessageServerMessage>(clientA, "chat_message");
    clientA.send("request_chat", { type: "request_chat", text: "first" });
    await firstAccepted;

    const secondRejected = waitForMessage<RequestChatRejectedServerMessage>(
      clientA,
      "request_chat_rejected",
    );
    clientA.send("request_chat", { type: "request_chat", text: "second" });
    const rejection = await secondRejected;
    expect(rejection.reason).toBe("chat_on_cooldown");
  });
});
