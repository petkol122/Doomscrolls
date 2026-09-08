import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { UserId, ZoneId } from "@doomscrolls/shared";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitUntil } from "../support/waitUntil";
import {
  TEST_CHARACTER_ID,
  TEST_IRONCLAD_CHARACTER_ID,
  TEST_USER_ID,
} from "../support/fixtures";

const SECOND_TEST_USER_ID = "test-user-2" as UserId;

/**
 * Core 0.28 -- the CombatRoom counterpart to
 * apps/server/test/town/multiPlayerPresenceVisibility.test.ts. The
 * client-side rendering needed no changes for CombatRoom (the same
 * shared worldSessionAreaView.ts already renders other players
 * generically, regardless of room kind -- see
 * docs/CORE_BUILD_0_28_PLAN.md's Build Framing). What had never been
 * proven is Wrinkle 3: `zoneMatchmaking.test.ts` already confirms two
 * joins for the same zone land in the same room, but only checks
 * roomId/zoneId equality, never that a second real session's own
 * *replicated* presence state actually contains the first.
 */
describe("CombatRoom multiplayer presence visibility", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2594);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("two real sessions land in the same combat room and each sees the other's presence, live", async () => {
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

    // Same live room instance -- Core 0.7's `.filterBy(["requestedZoneId"])`
    // hotfix, confirmed with actual presence cross-visibility rather than
    // just roomId/zoneId equality (zoneMatchmaking.test.ts's own coverage).
    expect(clientB.roomId).toBe(clientA.roomId);

    const room = colyseus.getRoomById<CombatRoomState>(clientA.roomId);
    expect(room.state.playerPresence.size).toBe(2);

    await waitUntil(() => clientB.state.playerPresence?.get(clientA.sessionId) !== undefined);
    await waitUntil(() => clientA.state.playerPresence?.get(clientB.sessionId) !== undefined);

    // Same six-field whitelist as TownRoom (Wrinkle 2: re-confirmed, not
    // expanded) -- displayName, classKey, x, y, hp, maxHp.
    const aFromB = clientB.state.playerPresence?.get(clientA.sessionId);
    expect(aFromB?.displayName).toBe("Test Gravewalker");
    expect(aFromB?.classKey).toBe("gravewalker");
    expect(typeof aFromB?.x).toBe("number");
    expect(typeof aFromB?.y).toBe("number");

    const bFromA = clientA.state.playerPresence?.get(clientB.sessionId);
    expect(bFromA?.displayName).toBe("Test Ironclad");
    expect(bFromA?.classKey).toBe("ironclad");

    // Live broadcast, not just a join-time snapshot.
    const serverPlayerA = room.state.playerPresence.get(clientA.sessionId);
    expect(serverPlayerA).toBeDefined();
    if (serverPlayerA === undefined) {
      throw new Error("expected client A to have a server-side presence entry");
    }
    const nextX = serverPlayerA.x + 111;
    const nextY = serverPlayerA.y + 22;
    serverPlayerA.x = nextX;
    serverPlayerA.y = nextY;

    await waitUntil(() => clientB.state.playerPresence?.get(clientA.sessionId)?.x === nextX);
    expect(clientB.state.playerPresence?.get(clientA.sessionId)?.y).toBe(nextY);
  });

  it("removes the departed session from the remaining player's replicated state", async () => {
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

    await waitUntil(() => clientB.state.playerPresence?.get(clientA.sessionId) !== undefined);

    await clientA.leave();

    await waitUntil(() => clientB.state.playerPresence?.get(clientA.sessionId) === undefined);

    const room = colyseus.getRoomById<CombatRoomState>(clientB.roomId);
    expect(room.state.playerPresence.size).toBe(1);
  });
});
