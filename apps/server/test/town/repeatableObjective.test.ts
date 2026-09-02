import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import type {
  InteractResponseServerMessage,
  ObjectiveUpdatedServerMessage,
  RequestInteractClientMessage,
} from "@doomscrolls/shared";
import type { TownRoomState } from "../../src/realtime/rooms/TownRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.15 -- `sewer_patrol` is the first objective ever marked
 * `repeatable: true`. The gating logic that lets a repeatable
 * objective bypass the completion-block
 * (`isObjectiveRepeatable`/`isObjectiveStartBlockedByCompletion`) has
 * existed in `TownRoom.ts` since some earlier, undocumented task, but
 * had never actually been exercised: no objective had ever set the
 * flag, so nothing had ever tried to *restart* one after completion --
 * which is exactly the path that would have hit
 * `ObjectiveRepository.create()`'s (characterId, objectiveId) unique
 * constraint and failed, had this test not caught it first (see the
 * new `startOrRestart` upsert method this build added specifically
 * for that reason).
 */
describe("TownRoom repeatable objective", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2587);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("can be turned in, then started a second time with progress reset to 0", async () => {
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
    // The notice board's real world position (packages/content/src/data/worldProps.ts).
    player.x = 190;
    player.y = 235;

    client.send("request_start_board_objective", { type: "request_start_board_objective", objectiveId: "sewer_patrol" });
    const started = await waitForMessage<ObjectiveUpdatedServerMessage>(client, "objective_updated");
    expect(started.slot).toBe(1);
    expect(started.current).toBe(0);

    // Simulate the 2 required kills directly -- kill-progress advancing
    // the right slot is already covered by
    // test/town/concurrentObjectiveSlots.test.ts; this test is about
    // the turn-in -> repeat -> restart path specifically.
    player.objectiveCurrent = 2;
    player.objectiveCompleted = true;

    const turnInMessage: RequestInteractClientMessage = {
      type: "request_interact",
      objectId: "nightmarket_notice_board_01",
    };
    client.send("request_interact", turnInMessage);
    const turnInResponse = await waitForMessage<InteractResponseServerMessage>(client, "interact_response");
    expect(turnInResponse.objectId).toBe("nightmarket_notice_board_01");

    // Turn-in clears the HUD display fields for the slot.
    expect(player.hasObjective).toBe(false);
    expect(player.objectiveCurrent).toBe(0);
    expect(player.objectiveCompleted).toBe(false);
    // objectiveId/objectiveRewardGranted are kept (not cleared) so
    // completion-block checks can see this objective was completed --
    // but sewer_patrol is repeatable, so that must NOT block a restart.
    expect(player.objectiveId).toBe("sewer_patrol");
    expect(player.objectiveRewardGranted).toBe(true);

    // Restart: must succeed (not rejected as already-completed), land
    // back in an open slot, and reset progress to 0 -- the real proof
    // that `startOrRestart`'s upsert (not `create`'s insert-only path)
    // is what actually persists this.
    client.send("request_start_board_objective", { type: "request_start_board_objective", objectiveId: "sewer_patrol" });
    const restarted = await waitForMessage<ObjectiveUpdatedServerMessage>(client, "objective_updated");
    expect(restarted.objectiveId).toBe("sewer_patrol");
    expect(restarted.current).toBe(0);
    expect(restarted.completed).toBe(false);
    expect(player.hasObjective || player.hasObjective2).toBe(true);
  });
});
