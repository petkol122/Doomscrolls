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
 * Core 0.17 -- Static Yard has never had its own objective-coverage
 * integration test. 0.15 added `static_cleanup` (targeting static_wretch)
 * as data only, relying on Blackwire's skitter_hunt test to prove the
 * shared kill-tracking mechanism; 0.16 gave Cinderworks a dedicated test
 * but Static Yard was skipped. This build's yard_drudge/drudge_patrol
 * addition is the right point to close that real, pre-existing gap.
 */
describe("CombatRoom Static Yard objective coverage", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2590);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("advances drudge_patrol from a yard_drudge kill in Static Yard", async () => {
    const client = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "static_yard" as ZoneId,
    });

    const room = colyseus.getRoomById<CombatRoomState>(client.roomId);
    const player = room.state.playerPresence.get(client.sessionId);
    expect(player).toBeDefined();
    if (player === undefined) {
      throw new Error("expected joined player to have a presence entry");
    }

    player.hasObjective = true;
    player.objectiveId = "drudge_patrol";
    player.objectiveLabel = "Drudge Patrol";
    player.objectiveCurrent = 0;
    player.objectiveTarget = 4;
    player.objectiveCompleted = false;
    player.objectiveRewardGranted = false;

    const drudge = [...room.state.enemies.values()].find((e) => e.enemyId === "yard_drudge");
    expect(drudge).toBeDefined();
    if (drudge === undefined) {
      throw new Error("expected CombatRoom to spawn a yard_drudge in static_yard");
    }

    drudge.hp = 1;
    player.x = drudge.x;
    player.y = drudge.y;

    const acceptedPromise = waitForMessage<RequestAttackAcceptedServerMessage>(client, "request_attack_accepted");
    const objectivePromise = waitForMessage<ObjectiveUpdatedServerMessage>(client, "objective_updated");
    client.send("request_attack", { type: "request_attack", targetEnemyId: drudge.id });
    await acceptedPromise;

    const progress = await objectivePromise;
    expect(progress.slot).toBe(1);
    expect(progress.objectiveId).toBe("drudge_patrol");
    expect(progress.current).toBe(1);

    // Core investigation §10 -- test-scope-only: let the fire-and-forget
    // XP-grant path's own background DB call (CombatRoom's `void
    // grantEnemyDefeatXp(...)`) finish before this test's afterEach
    // tears the room down. See flushPendingDbWork.ts for why there's no
    // server message to await here instead.
    await flushPendingDbWork();
  });

  /**
   * Core 0.19 -- Static Yard's heavy anchor swapped from a reused
   * trashboar_brute to its own arc_sentinel. This proves the swap
   * actually spawns the new enemy in the zone and that the new
   * arc_purge objective's kill-tracking works, not just that the
   * content data is well-formed.
   */
  it("advances arc_purge from an arc_sentinel kill in Static Yard", async () => {
    const client = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "static_yard" as ZoneId,
    });

    const room = colyseus.getRoomById<CombatRoomState>(client.roomId);
    const player = room.state.playerPresence.get(client.sessionId);
    expect(player).toBeDefined();
    if (player === undefined) {
      throw new Error("expected joined player to have a presence entry");
    }

    player.hasObjective = true;
    player.objectiveId = "arc_purge";
    player.objectiveLabel = "Arc Purge";
    player.objectiveCurrent = 0;
    player.objectiveTarget = 1;
    player.objectiveCompleted = false;
    player.objectiveRewardGranted = false;

    const sentinel = [...room.state.enemies.values()].find((e) => e.enemyId === "arc_sentinel");
    expect(sentinel).toBeDefined();
    if (sentinel === undefined) {
      throw new Error("expected CombatRoom to spawn an arc_sentinel in static_yard");
    }

    sentinel.hp = 1;
    player.x = sentinel.x;
    player.y = sentinel.y;

    const acceptedPromise = waitForMessage<RequestAttackAcceptedServerMessage>(client, "request_attack_accepted");
    const objectivePromise = waitForMessage<ObjectiveUpdatedServerMessage>(client, "objective_updated");
    client.send("request_attack", { type: "request_attack", targetEnemyId: sentinel.id });
    await acceptedPromise;

    const progress = await objectivePromise;
    expect(progress.slot).toBe(1);
    expect(progress.objectiveId).toBe("arc_purge");
    expect(progress.current).toBe(1);

    await flushPendingDbWork();
  });
});
