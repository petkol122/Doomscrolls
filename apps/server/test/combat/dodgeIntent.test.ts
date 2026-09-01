import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { RequestDodgeAcceptedServerMessage, ZoneId } from "@doomscrolls/shared";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { resolveZoneBounds } from "../../src/realtime/rooms/resolveZoneBounds";
import { DEFAULT_DODGE_DISTANCE } from "../../src/realtime/rooms/dodgeCooldown";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.12 -- regression for the fix closing the gap flagged in
 * docs/CORE_BUILD_0_12_PLAN.md: `request_dodge` was previously
 * registered only in TownRoom.ts, so a player could not dodge at all
 * in Blackwire Sewers or Static Yard -- the game's only real combat
 * zones. This is CombatRoom's first-ever dodge assertion; it proves
 * the intent actually resolves (the player's real position changes
 * by the real dodge distance, clamped to the real zone bounds), not
 * just that sending the message doesn't error.
 */
describe("CombatRoom dodge", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2579);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("moves the player's real position by the real dodge distance", async () => {
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

    const startX = player.x;
    const startY = player.y;
    const startNextDodgeAt = player.nextDodgeAt;
    const bounds = resolveZoneBounds(room.state.zoneId);
    const expectedX = Math.min(Math.max(startX + DEFAULT_DODGE_DISTANCE, bounds.minX), bounds.maxX);

    client.send("request_dodge", {
      type: "request_dodge",
      dirX: 1,
      dirY: 0,
    });

    await waitForMessage<RequestDodgeAcceptedServerMessage>(client, "request_dodge_accepted");

    const playerAfter = room.state.playerPresence.get(client.sessionId);
    expect(playerAfter?.x).toBe(expectedX);
    expect(playerAfter?.y).toBe(startY);
    expect(playerAfter?.x).not.toBe(startX);
    expect(playerAfter?.nextDodgeAt).toBeGreaterThan(startNextDodgeAt);
  });
});
