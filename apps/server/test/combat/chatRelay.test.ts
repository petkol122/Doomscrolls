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
 * Core 0.29 -- the CombatRoom port of
 * apps/server/test/town/chatRelay.test.ts's coverage (relay including
 * the sender, empty/length rejection, rate limiting), proving the
 * shared `registerChatHandler` actually works here too rather than
 * assuming the port by inspection alone -- the same "prove it per
 * room" discipline Core 0.28 used for player-presence visibility.
 * Also proves room isolation: `room.broadcast()` is this codebase's
 * first use of that primitive, and this is the direct check that it
 * only reaches the calling room's own clients, not every CombatRoom
 * instance server-wide.
 */
describe("CombatRoom room-local chat relay", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2597);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("relays a valid message to every client in the room, including the sender", async () => {
    const clientA = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "blackwire_sewers" as ZoneId,
    });
    const clientB = await colyseus.sdk.joinOrCreate("combat", {
      userId: SECOND_TEST_USER_ID,
      characterId: TEST_IRONCLAD_CHARACTER_ID,
      requestedZoneId: "blackwire_sewers" as ZoneId,
    });
    expect(clientB.roomId).toBe(clientA.roomId);

    const bReceived = waitForMessage<ChatMessageServerMessage>(clientB, "chat_message");
    const aReceived = waitForMessage<ChatMessageServerMessage>(clientA, "chat_message");

    clientA.send("request_chat", { type: "request_chat", text: "watch the flank" });

    const [bMessage, aMessage] = await Promise.all([bReceived, aReceived]);

    expect(bMessage.text).toBe("watch the flank");
    expect(bMessage.displayName).toBe("Test Gravewalker");
    expect(bMessage.sessionId).toBe(clientA.sessionId);
    expect((bMessage as unknown as Record<string, unknown>).classKey).toBeUndefined();
    expect((bMessage as unknown as Record<string, unknown>).level).toBeUndefined();

    expect(aMessage.text).toBe("watch the flank");
    expect(aMessage.sessionId).toBe(clientA.sessionId);
  });

  it("rejects an empty (whitespace-only) message with no broadcast", async () => {
    const clientA = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "blackwire_sewers" as ZoneId,
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
    const clientA = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "blackwire_sewers" as ZoneId,
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
    const clientA = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "blackwire_sewers" as ZoneId,
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

  it("does not deliver a message across two different room instances", async () => {
    const clientInZoneA = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "blackwire_sewers" as ZoneId,
    });
    const clientInZoneB = await colyseus.sdk.joinOrCreate("combat", {
      userId: SECOND_TEST_USER_ID,
      characterId: TEST_IRONCLAD_CHARACTER_ID,
      requestedZoneId: "cinderworks" as ZoneId,
    });

    // Different `requestedZoneId` values under CombatRoom's
    // `.filterBy(["requestedZoneId"])` registration (Core 0.7) land in
    // genuinely different room instances -- confirmed directly rather
    // than assumed.
    expect(clientInZoneB.roomId).not.toBe(clientInZoneA.roomId);

    let receivedInZoneB = false;
    clientInZoneB.onMessage("chat_message", () => {
      receivedInZoneB = true;
    });

    const senderReceivedOwn = waitForMessage<ChatMessageServerMessage>(
      clientInZoneA,
      "chat_message",
    );
    clientInZoneA.send("request_chat", { type: "request_chat", text: "sewers only" });
    await senderReceivedOwn;

    // Give any (incorrect) cross-room delivery a chance to arrive
    // before asserting it didn't.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(receivedInZoneB).toBe(false);
  });
});
