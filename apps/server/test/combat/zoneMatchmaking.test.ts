import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { CharacterId, ZoneId } from "@doomscrolls/shared";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { TEST_USER_ID } from "../support/fixtures";

/**
 * Regression for the Core 0.7 Task 361 hotfix (see
 * docs/CORE_BUILD_0_7_RELEASE_NOTES.md): `CombatRoom` was registered with
 * a plain `.define(...)`, with no filter on zone id, so
 * `joinOrCreate("combat", { requestedZoneId })` could silently reuse an
 * already-open combat room of a *different* zone. The fix added
 * `.filterBy(["requestedZoneId"])`; this test reproduces the original bug
 * scenario (two concurrent joins for different zones) plus the
 * same-zone reuse case the filter must not break.
 */
describe("CombatRoom zone-based matchmaking", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2573);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("routes concurrent joins for different zones to distinct rooms, and reuses one room for the same zone", async () => {
    const [clientA, clientB] = await Promise.all([
      colyseus.sdk.joinOrCreate("combat", {
        userId: TEST_USER_ID,
        characterId: "test-character-a" as CharacterId,
        requestedZoneId: "blackwire_sewers" as ZoneId,
      }),
      colyseus.sdk.joinOrCreate("combat", {
        userId: TEST_USER_ID,
        characterId: "test-character-b" as CharacterId,
        requestedZoneId: "static_yard" as ZoneId,
      }),
    ]);

    expect(clientA.roomId).not.toBe(clientB.roomId);

    const roomA = colyseus.getRoomById<CombatRoomState>(clientA.roomId);
    const roomB = colyseus.getRoomById<CombatRoomState>(clientB.roomId);
    expect(roomA.state.zoneId).toBe("blackwire_sewers");
    expect(roomB.state.zoneId).toBe("static_yard");

    const clientC = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: "test-character-c" as CharacterId,
      requestedZoneId: "blackwire_sewers" as ZoneId,
    });

    expect(clientC.roomId).toBe(clientA.roomId);
  });
});
