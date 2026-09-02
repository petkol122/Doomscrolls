import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import type { ObjectiveUpdatedServerMessage, RequestAttackAcceptedServerMessage } from "@doomscrolls/shared";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.16 -- Cinderworks, the third combat zone. Proves the same
 * "kills in the game's own dedicated combat zone actually count toward
 * something" chain 0.15 verified for Blackwire Sewers (skitter_hunt) and
 * Static Yard (static_cleanup) also holds for a zone added after that
 * chain existed -- i.e. wiring a new zone into spawnZones/objectives
 * data is sufficient, no room-logic change required.
 */
describe("CombatRoom Cinderworks objective coverage", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2589);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("advances slag_hunt from a slag_hound kill in Cinderworks", async () => {
    const client = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "cinderworks" as ZoneId,
    });

    const room = colyseus.getRoomById<CombatRoomState>(client.roomId);
    const player = room.state.playerPresence.get(client.sessionId);
    expect(player).toBeDefined();
    if (player === undefined) {
      throw new Error("expected joined player to have a presence entry");
    }

    player.hasObjective = true;
    player.objectiveId = "slag_hunt";
    player.objectiveLabel = "Slag Hunt";
    player.objectiveCurrent = 0;
    player.objectiveTarget = 4;
    player.objectiveCompleted = false;
    player.objectiveRewardGranted = false;

    const hound = [...room.state.enemies.values()].find((e) => e.enemyId === "slag_hound");
    expect(hound).toBeDefined();
    if (hound === undefined) {
      throw new Error("expected CombatRoom to spawn a slag_hound in cinderworks");
    }

    hound.hp = 1;
    player.x = hound.x;
    player.y = hound.y;

    const acceptedPromise = waitForMessage<RequestAttackAcceptedServerMessage>(client, "request_attack_accepted");
    const objectivePromise = waitForMessage<ObjectiveUpdatedServerMessage>(client, "objective_updated");
    client.send("request_attack", { type: "request_attack", targetEnemyId: hound.id });
    await acceptedPromise;

    const progress = await objectivePromise;
    expect(progress.slot).toBe(1);
    expect(progress.objectiveId).toBe("slag_hunt");
    expect(progress.current).toBe(1);
  });
});
