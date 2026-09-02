import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import type { ObjectiveUpdatedServerMessage, RequestInteractClientMessage } from "@doomscrolls/shared";
import { ObjectiveRepository } from "../../src/persistence/repositories/ObjectiveRepository";
import type { TownRoomState } from "../../src/realtime/rooms/TownRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Hotfix regression — found during Core 0.15's regression trace, unrelated
 * to what 0.15 shipped. The notice-board turn-in handler used to leave
 * a slot's `hasObjective` gate open across three awaited calls
 * (`markRewardGranted`, `incrementMoneyCopper`, `grantFlatXpReward`).
 * Colyseus processes one room's messages sequentially but yields to the
 * next queued message at each `await`, so two `request_interact`
 * messages arriving before the first one's awaits resolved could both
 * snapshot `hasObjective: true` and both take the turn-in branch,
 * double-granting the reward.
 *
 * The fix closes the gate synchronously, before the first await. This
 * test proves it by slowing down the mocked `markRewardGranted` call
 * (giving a real window for a second concurrent `request_interact` to
 * be processed mid-await) and asserting it was only ever actually
 * invoked once.
 */
function defaultObjectiveRepositoryMock(): Partial<ObjectiveRepository> {
  return {
    findByCharacterAndObjective: vi.fn().mockResolvedValue(null),
    findCompletedByCharacter: vi.fn().mockResolvedValue([]),
    updateProgress: vi.fn().mockResolvedValue(undefined),
    markRewardGranted: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
    startOrRestart: vi.fn().mockResolvedValue(undefined),
    markCompleted: vi.fn().mockResolvedValue(undefined),
  };
}

describe("TownRoom objective turn-in race", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2588);
  });

  afterEach(async () => {
    vi.mocked(ObjectiveRepository).mockImplementation(defaultObjectiveRepositoryMock as never);
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("grants the reward exactly once when two turn-in requests race", async () => {
    let markRewardGrantedCallCount = 0;
    vi.mocked(ObjectiveRepository).mockImplementation(() => ({
      ...defaultObjectiveRepositoryMock(),
      // Real delay -- gives a second concurrent request a real window
      // to be processed while this call is still in flight, the same
      // shape of window the original bug relied on.
      markRewardGranted: vi.fn().mockImplementation(async () => {
        markRewardGrantedCallCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
      }),
    } as never));

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

    client.send("request_start_board_objective", { type: "request_start_board_objective", objectiveId: "break_the_brute" });
    await waitForMessage<ObjectiveUpdatedServerMessage>(client, "objective_updated");

    // Simulate the required kill directly -- kill-progress advancing
    // the slot is already covered elsewhere; this test is about the
    // turn-in race specifically.
    player.objectiveCurrent = 1;
    player.objectiveCompleted = true;

    const turnInMessage: RequestInteractClientMessage = {
      type: "request_interact",
      objectId: "nightmarket_notice_board_01",
    };
    // Fire both requests without awaiting between them -- this is the
    // "two request_interact messages arriving before the first
    // resolves" scenario the bug depended on.
    client.send("request_interact", turnInMessage);
    client.send("request_interact", turnInMessage);

    // Give both handlers (and the 30ms markRewardGranted delay) time
    // to fully complete.
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(markRewardGrantedCallCount).toBe(1);
    expect(player.hasObjective).toBe(false);
    expect(player.objectiveRewardGranted).toBe(true);
  });
});
