import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import type { ObjectiveUpdatedServerMessage, RequestAttackAcceptedServerMessage } from "@doomscrolls/shared";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { flushPendingDbWork } from "../support/flushPendingDbWork";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.18 -- Saltmere Docks, the fourth combat zone. Mirrors 0.16's
 * cinderworksObjectiveCoverage.test.ts pattern: proves the full join ->
 * spawn -> kill -> objective-progress chain actually fires for a brand
 * new zone, not just that the content data is well-formed (the
 * content-registry validator already covers that).
 */
describe("CombatRoom Saltmere Docks objective coverage", () => {
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

  it("advances brine_cull from a brine_crawler kill in Saltmere Docks", async () => {
    const client = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "saltmere_docks" as ZoneId,
    });

    const room = colyseus.getRoomById<CombatRoomState>(client.roomId);
    const player = room.state.playerPresence.get(client.sessionId);
    expect(player).toBeDefined();
    if (player === undefined) {
      throw new Error("expected joined player to have a presence entry");
    }

    player.hasObjective = true;
    player.objectiveId = "brine_cull";
    player.objectiveLabel = "Brine Cull";
    player.objectiveCurrent = 0;
    player.objectiveTarget = 4;
    player.objectiveCompleted = false;
    player.objectiveRewardGranted = false;

    const crawler = [...room.state.enemies.values()].find((e) => e.enemyId === "brine_crawler");
    expect(crawler).toBeDefined();
    if (crawler === undefined) {
      throw new Error("expected CombatRoom to spawn a brine_crawler in saltmere_docks");
    }

    crawler.hp = 1;
    player.x = crawler.x;
    player.y = crawler.y;

    const acceptedPromise = waitForMessage<RequestAttackAcceptedServerMessage>(client, "request_attack_accepted");
    const objectivePromise = waitForMessage<ObjectiveUpdatedServerMessage>(client, "objective_updated");
    client.send("request_attack", { type: "request_attack", targetEnemyId: crawler.id });
    await acceptedPromise;

    const progress = await objectivePromise;
    expect(progress.slot).toBe(1);
    expect(progress.objectiveId).toBe("brine_cull");
    expect(progress.current).toBe(1);

    // Core investigation §10 -- test-scope-only: let the fire-and-forget
    // XP-grant path's own background DB call (CombatRoom's `void
    // grantEnemyDefeatXp(...)`) finish before this test's afterEach
    // tears the room down. See flushPendingDbWork.ts for why there's no
    // server message to await here instead.
    await flushPendingDbWork();
  });
});
