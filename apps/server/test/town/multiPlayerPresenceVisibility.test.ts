import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { UserId, ZoneId } from "@doomscrolls/shared";
import type { TownRoomState } from "../../src/realtime/rooms/TownRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitUntil } from "../support/waitUntil";
import {
  TEST_CHARACTER_ID,
  TEST_IRONCLAD_CHARACTER_ID,
  TEST_USER_ID,
} from "../support/fixtures";

const SECOND_TEST_USER_ID = "test-user-2" as UserId;

/**
 * Core 0.27 -- proves the multiplayer-visibility mechanism that was
 * architecturally present but never exercised: TownRoom is registered
 * with no `.filterBy` (see createRealtimeServer.ts) and only one town
 * zone (`nightmarket`) exists, so two real clients already land in the
 * same live room instance and Colyseus already syncs the *entire*
 * `playerPresence` MapSchema to both -- nothing about that data flow is
 * new. What was never tested is that a second client's own *replicated*
 * state (not the server's authoritative copy, which would be trivially
 * true by definition) actually reflects another session's presence, its
 * live position updates, and its removal on leave. See
 * docs/CORE_BUILD_0_27_PLAN.md.
 */
describe("TownRoom multiplayer presence visibility", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2591);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("two real sessions land in the same room and each sees the other's presence, live", async () => {
    const clientA = await colyseus.sdk.joinOrCreate("town", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "nightmarket" as ZoneId,
    });
    const clientB = await colyseus.sdk.joinOrCreate("town", {
      userId: SECOND_TEST_USER_ID,
      characterId: TEST_IRONCLAD_CHARACTER_ID,
      requestedZoneId: "nightmarket" as ZoneId,
    });

    // Same live room instance -- the no-`.filterBy` finding from the plan,
    // confirmed directly rather than assumed.
    expect(clientB.roomId).toBe(clientA.roomId);

    const room = colyseus.getRoomById<TownRoomState>(clientA.roomId);
    expect(room.state.playerPresence.size).toBe(2);

    // Each client's own REPLICATED state (not the server's authoritative
    // copy, which would be trivially true by definition) must eventually
    // contain the other session. Polled rather than pinned to a single
    // `onStateChange` event, since the initial full snapshot may already
    // have arrived by the time any listener could be attached.
    await waitUntil(() => clientB.state.playerPresence?.get(clientA.sessionId) !== undefined);
    await waitUntil(() => clientA.state.playerPresence?.get(clientB.sessionId) !== undefined);

    // Client B's replicated view of client A carries the fields Core
    // 0.27's rendering path actually needs (Question 2a's field audit).
    const aFromB = clientB.state.playerPresence?.get(clientA.sessionId);
    expect(aFromB?.displayName).toBe("Test Gravewalker");
    expect(aFromB?.classKey).toBe("gravewalker");
    expect(typeof aFromB?.x).toBe("number");
    expect(typeof aFromB?.y).toBe("number");

    // And the reverse direction, with the other fixture's distinct class --
    // proves this isn't a coincidental one-directional match.
    const bFromA = clientA.state.playerPresence?.get(clientB.sessionId);
    expect(bFromA?.displayName).toBe("Test Ironclad");
    expect(bFromA?.classKey).toBe("ironclad");

    // Live broadcast, not just a join-time snapshot: mutate A's position
    // on the server's authoritative schema and prove B's own replicated
    // state actually updates over the wire.
    const serverPlayerA = room.state.playerPresence.get(clientA.sessionId);
    expect(serverPlayerA).toBeDefined();
    if (serverPlayerA === undefined) {
      throw new Error("expected client A to have a server-side presence entry");
    }
    const nextX = serverPlayerA.x + 123;
    const nextY = serverPlayerA.y + 45;

    serverPlayerA.x = nextX;
    serverPlayerA.y = nextY;

    await waitUntil(() => clientB.state.playerPresence?.get(clientA.sessionId)?.x === nextX);
    const aFromBAfterMove = clientB.state.playerPresence?.get(clientA.sessionId);
    expect(aFromBAfterMove?.y).toBe(nextY);
  });

  it("removes the departed session from the remaining player's replicated state", async () => {
    const clientA = await colyseus.sdk.joinOrCreate("town", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "nightmarket" as ZoneId,
    });
    const clientB = await colyseus.sdk.joinOrCreate("town", {
      userId: SECOND_TEST_USER_ID,
      characterId: TEST_IRONCLAD_CHARACTER_ID,
      requestedZoneId: "nightmarket" as ZoneId,
    });

    await waitUntil(() => clientB.state.playerPresence?.get(clientA.sessionId) !== undefined);

    await clientA.leave();

    await waitUntil(() => clientB.state.playerPresence?.get(clientA.sessionId) === undefined);

    const room = colyseus.getRoomById<TownRoomState>(clientB.roomId);
    expect(room.state.playerPresence.size).toBe(1);
  });
});
