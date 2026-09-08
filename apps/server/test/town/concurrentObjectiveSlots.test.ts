import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import type {
  ObjectiveUpdatedServerMessage,
  RequestAttackAcceptedServerMessage,
  RequestStartBoardObjectiveRejectedServerMessage,
} from "@doomscrolls/shared";
import type { TownRoomState } from "../../src/realtime/rooms/TownRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.15 -- two objectives can now be active at once. Before this
 * build, `PlayerPresence` carried exactly one scalar objective-state
 * field set and `request_start_board_objective` rejected any second
 * start outright ("already_has_active_objective" meant "any objective
 * at all"). This proves: a second slot can be filled, a third request
 * is rejected once both slots are full, and a kill only advances the
 * slot(s) whose own `targetEnemyIds` actually include that enemy --
 * not every active slot indiscriminately.
 */
describe("TownRoom concurrent objective slots", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2585);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("fills both slots, rejects a third, and advances only the matching slot per kill", async () => {
    const client = await colyseus.sdk.joinOrCreate("town", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "nightmarket" as ZoneId,
    });

    const room = colyseus.getRoomById<TownRoomState>(client.roomId);
    const player = room.state.playerPresence.get(client.sessionId);
    expect(player).toBeDefined();
    if (player === undefined) {
      throw new Error("expected joined player to have a presence entry");
    }

    // break_the_brute targets only trashboar_brute; sewer_patrol targets
    // only trashboar_runt -- disjoint target sets, so a kill of one
    // enemy type must never touch the other slot's progress.
    client.send("request_start_board_objective", { type: "request_start_board_objective", objectiveId: "break_the_brute" });
    const firstStart = await waitForMessage<ObjectiveUpdatedServerMessage>(client, "objective_updated");
    expect(firstStart.slot).toBe(1);
    expect(firstStart.objectiveId).toBe("break_the_brute");

    client.send("request_start_board_objective", { type: "request_start_board_objective", objectiveId: "sewer_patrol" });
    const secondStart = await waitForMessage<ObjectiveUpdatedServerMessage>(client, "objective_updated");
    expect(secondStart.slot).toBe(2);
    expect(secondStart.objectiveId).toBe("sewer_patrol");

    // Both slots full -- a third start must be rejected, not silently
    // replace either slot.
    client.send("request_start_board_objective", { type: "request_start_board_objective", objectiveId: "cull_trashboars" });
    const rejected = await waitForMessage<RequestStartBoardObjectiveRejectedServerMessage>(
      client,
      "request_start_board_objective_rejected",
    );
    expect(rejected.reason).toBe("already_has_active_objective");

    const runt = [...room.state.enemies.values()].find((e) => e.enemyId === "trashboar_runt");
    const brute = [...room.state.enemies.values()].find((e) => e.enemyId === "trashboar_brute");
    expect(runt).toBeDefined();
    expect(brute).toBeDefined();
    if (runt === undefined || brute === undefined) {
      throw new Error("expected TownRoom to spawn both a trashboar_runt and a trashboar_brute for nightmarket");
    }

    // Kill the runt: must advance sewer_patrol (slot 2) only.
    // request_attack_accepted and objective_updated are both sent
    // synchronously, back-to-back -- both listeners must be
    // registered before the send, or the second message can arrive
    // (and be dropped) before its listener exists.
    runt.hp = 1;
    player.x = runt.x;
    player.y = runt.y;
    const runtAcceptedPromise = waitForMessage<RequestAttackAcceptedServerMessage>(client, "request_attack_accepted");
    const runtProgressPromise = waitForMessage<ObjectiveUpdatedServerMessage>(client, "objective_updated");
    client.send("request_attack", { type: "request_attack", targetEnemyId: runt.id });
    await runtAcceptedPromise;
    const runtProgress = await runtProgressPromise;
    expect(runtProgress.slot).toBe(2);
    expect(runtProgress.objectiveId).toBe("sewer_patrol");
    expect(runtProgress.current).toBe(1);
    expect(runtProgress.completed).toBe(false);
    // break_the_brute (slot 1) must be untouched by the runt kill.
    expect(player.objectiveCurrent).toBe(0);
    expect(player.objectiveCompleted).toBe(false);

    // Kill the brute: must advance break_the_brute (slot 1) only, and
    // complete it (requiredKills: 1).
    brute.hp = 1;
    player.x = brute.x;
    player.y = brute.y;
    // The runt kill just above consumed the attack cooldown
    // (attackCooldownMs); clear it directly so this second attack
    // isn't rejected as attack_on_cooldown -- this test is about
    // objective-slot isolation, not cooldown pacing.
    player.nextAttackAt = 0;
    const bruteAcceptedPromise = waitForMessage<RequestAttackAcceptedServerMessage>(client, "request_attack_accepted");
    const bruteProgressPromise = waitForMessage<ObjectiveUpdatedServerMessage>(client, "objective_updated");
    client.send("request_attack", { type: "request_attack", targetEnemyId: brute.id });
    await bruteAcceptedPromise;
    const bruteProgress = await bruteProgressPromise;
    expect(bruteProgress.slot).toBe(1);
    expect(bruteProgress.objectiveId).toBe("break_the_brute");
    expect(bruteProgress.current).toBe(1);
    expect(bruteProgress.completed).toBe(true);
    // sewer_patrol (slot 2) must be untouched by the brute kill.
    expect(player.objectiveCurrent2).toBe(1);
    expect(player.objectiveCompleted2).toBe(false);
  });
});
