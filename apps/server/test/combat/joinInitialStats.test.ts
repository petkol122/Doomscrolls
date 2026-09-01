import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import {
  TEST_CHARACTER_ID,
  TEST_CHARACTER_STATS,
  TEST_MOVEMENT_SPEED_UNITS_PER_SECOND,
  TEST_USER_ID,
} from "../support/fixtures";

/**
 * Regression for Core 0.7 Task 360's "Unplanned finding" (see
 * docs/CORE_BUILD_0_7_RELEASE_NOTES.md): `CombatRoom.onJoin` hardcoded
 * hp/maxHp/movementSpeed/attackCooldownMs to 0 for every fresh join
 * instead of reading the character's persisted stats the way
 * `TownRoom.onJoin` already did. That silently blocked every alive-gated
 * action (basic attack included) in both real combat zones.
 */
describe("CombatRoom.onJoin initial player stats", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2572);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("derives real hp/maxHp/movementSpeed/attackCooldownMs from the character's stats", async () => {
    const client = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "blackwire_sewers" as ZoneId,
    });

    const room = colyseus.getRoomById<CombatRoomState>(client.roomId);
    const player = room.state.playerPresence.get(client.sessionId);

    expect(player).toBeDefined();
    if (player === undefined) {
      throw new Error("expected joined player to have a presence entry");
    }

    expect(player.maxHp).toBe(TEST_CHARACTER_STATS.derived.maxHp);
    expect(player.hp).toBe(TEST_CHARACTER_STATS.currentHp);
    expect(player.movementSpeed).toBe(TEST_MOVEMENT_SPEED_UNITS_PER_SECOND);
    expect(player.attackCooldownMs).toBe(TEST_CHARACTER_STATS.derived.attackCooldownMs);
    expect(player.lifeState).toBe("alive");
  });
});
