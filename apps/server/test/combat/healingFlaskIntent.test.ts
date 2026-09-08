import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type {
  RequestUseHealingFlaskAcceptedServerMessage,
  RequestUseHealingFlaskRejectedServerMessage,
  ZoneId,
} from "@doomscrolls/shared";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { HEALING_FLASK_HEAL_AMOUNT } from "../../src/realtime/rooms/healingFlaskConfig";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.12 -- regression for the fix closing the gap flagged in
 * docs/CORE_BUILD_0_12_PLAN.md: `request_use_healing_flask` was
 * previously registered only in TownRoom.ts, so a player could not
 * heal with their flask at all in Blackwire Sewers or Static Yard --
 * despite CombatRoom already tracking and persisting flask charges
 * end-to-end. This is CombatRoom's first-ever healing-flask
 * assertion; it proves the intent actually resolves (real HP gained,
 * a real charge consumed, a real cooldown set), not just that
 * sending the message doesn't error.
 */
describe("CombatRoom healing flask", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2580);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("heals real HP, consumes a real charge, and sets a real cooldown", async () => {
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

    // The test character fixture joins below max HP already (currentHp
    // 80 vs. derived.maxHp 120), so no manual HP reduction is needed to
    // exercise a real heal.
    const startHp = player.hp;
    const startCharges = player.flaskCharges;
    expect(startHp).toBeLessThan(player.maxHp);
    expect(startCharges).toBeGreaterThan(0);

    client.send("request_use_healing_flask", {
      type: "request_use_healing_flask",
    });

    const accepted = await waitForMessage<RequestUseHealingFlaskAcceptedServerMessage>(
      client,
      "request_use_healing_flask_accepted",
    );

    expect(accepted.healedAmount).toBe(HEALING_FLASK_HEAL_AMOUNT);

    const playerAfter = room.state.playerPresence.get(client.sessionId);
    expect(playerAfter?.hp).toBe(startHp + HEALING_FLASK_HEAL_AMOUNT);
    expect(playerAfter?.flaskCharges).toBe(startCharges - 1);
    expect(playerAfter?.nextFlaskAt).toBeGreaterThan(0);
  });

  it("rejects with no_charges once every charge is spent", async () => {
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

    // Directly deplete charges rather than depending on the real
    // per-charge cooldown timing across repeated real sends.
    player.flaskCharges = 0;

    client.send("request_use_healing_flask", {
      type: "request_use_healing_flask",
    });

    const rejected = await waitForMessage<RequestUseHealingFlaskRejectedServerMessage>(
      client,
      "request_use_healing_flask_rejected",
    );

    expect(rejected.reason).toBe("no_charges");
  });
});
