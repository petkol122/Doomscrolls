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
 * Core 0.15 -- combat-zone objective coverage. Before this build, all
 * three existing objectives targeted only trashboar_runt/trashboar_brute
 * -- kill-progress tracking already fired in CombatRoom (the underlying
 * mechanism was never the gap), but no objective's targetEnemyIds ever
 * included trashboar_skitter or static_wretch, so a kill of either, in
 * the game's own dedicated combat zones, advanced nothing. `skitter_hunt`
 * closes that for Blackwire Sewers.
 */
describe("CombatRoom combat-zone objective coverage", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2586);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("advances skitter_hunt from a trashboar_skitter kill in Blackwire Sewers", async () => {
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

    // Directly seed an active skitter_hunt objective into slot 1 --
    // the notice board (and request_start_board_objective) only exists
    // in TownRoom; this mirrors what join-time restoration would carry
    // over for a character who started it in Nightmarket, without
    // re-testing the start flow itself (already covered elsewhere).
    player.hasObjective = true;
    player.objectiveId = "skitter_hunt";
    player.objectiveLabel = "Skitter Hunt";
    player.objectiveCurrent = 0;
    player.objectiveTarget = 4;
    player.objectiveCompleted = false;
    player.objectiveRewardGranted = false;

    const skitter = [...room.state.enemies.values()].find((e) => e.enemyId === "trashboar_skitter");
    expect(skitter).toBeDefined();
    if (skitter === undefined) {
      throw new Error("expected CombatRoom to spawn a trashboar_skitter in blackwire_sewers");
    }

    skitter.hp = 1;
    player.x = skitter.x;
    player.y = skitter.y;

    // request_attack_accepted and objective_updated are both sent
    // synchronously, back-to-back, within the same message handler --
    // both listeners must be registered before the send, or the
    // second message can arrive (and be dropped) before its listener
    // exists.
    const acceptedPromise = waitForMessage<RequestAttackAcceptedServerMessage>(client, "request_attack_accepted");
    const objectivePromise = waitForMessage<ObjectiveUpdatedServerMessage>(client, "objective_updated");
    client.send("request_attack", { type: "request_attack", targetEnemyId: skitter.id });
    await acceptedPromise;

    const progress = await objectivePromise;
    expect(progress.slot).toBe(1);
    expect(progress.objectiveId).toBe("skitter_hunt");
    expect(progress.current).toBe(1);

    // Core investigation §10 -- test-scope-only: let the fire-and-forget
    // XP-grant path's own background DB call (CombatRoom's `void
    // grantEnemyDefeatXp(...)`) finish before this test's afterEach
    // tears the room down. See flushPendingDbWork.ts for why there's no
    // server message to await here instead.
    await flushPendingDbWork();
  });
});
