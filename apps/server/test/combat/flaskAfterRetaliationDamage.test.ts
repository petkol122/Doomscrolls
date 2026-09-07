import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { RequestUseHealingFlaskAcceptedServerMessage, ZoneId } from "@doomscrolls/shared";
import { contentRegistry } from "@doomscrolls/content";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { mitigateIncomingDamage } from "../../src/realtime/rooms/incomingDamageMitigation";
import { HEALING_FLASK_HEAL_AMOUNT } from "../../src/realtime/rooms/healingFlaskConfig";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { isolateSingleEnemy } from "../support/isolateSingleEnemy";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.24 -- closes the loop `docs/CORE_BUILD_0_24_PLAN.md` (Question
 * 3) flagged for flask: the healing-flask handler was already ported
 * correctly in 0.12, but had nothing meaningful to heal from, since
 * CombatRoom could not deal real damage before this build. This test
 * takes a real, mitigated retaliation hit through the real landing
 * code path, then proves a flask heal on top of that real damage
 * restores HP correctly.
 */
describe("CombatRoom healing flask after real retaliation damage", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2594);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("heals up from a real enemy hit, not just a synthetic HP reduction", async () => {
    const client = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "blackwire_sewers" as ZoneId,
    });

    const room = colyseus.getRoomById<CombatRoomState>(client.roomId);
    const enemy = [...room.state.enemies.values()][0];
    expect(enemy).toBeDefined();
    if (enemy === undefined) {
      throw new Error("expected CombatRoom to spawn at least one enemy for blackwire_sewers");
    }

    const player = room.state.playerPresence.get(client.sessionId);
    expect(player).toBeDefined();
    if (player === undefined) {
      throw new Error("expected joined player to have a presence entry");
    }

    const enemyDefinition = contentRegistry.enemies.get(enemy.enemyId as never);
    expect(enemyDefinition).toBeDefined();
    if (enemyDefinition === undefined) {
      throw new Error(`expected content definition for ${enemy.enemyId}`);
    }

    isolateSingleEnemy(room.state.enemies, enemy.id);

    // maxHp is set well above starting hp so the real (small) enemy
    // hit still leaves enough headroom for a full, unclamped flask
    // heal -- otherwise the heal-amount assertion below would be
    // testing the maxHp clamp, not the real heal amount.
    player.hp = 100;
    player.maxHp = 200;
    player.armor = 0;
    player.lifeState = "alive";
    expect(player.flaskCharges).toBeGreaterThan(0);

    // Force a real landing on the very next tick (same technique as
    // `test/combat/incomingDamageMitigation.test.ts`) -- this still
    // runs the genuine mitigation + hp-write code path; it only skips
    // waiting through the real-time acquisition/windup for speed.
    enemy.x = player.x;
    enemy.y = player.y;
    enemy.spawnX = player.x;
    enemy.spawnY = player.y;
    enemy.targetPlayerSessionId = player.sessionId;
    enemy.attackLandingAtMs = Date.now() - 100;

    await new Promise((resolve) => setTimeout(resolve, 200));

    const hpAfterDamage = room.state.playerPresence.get(client.sessionId)?.hp;
    const expectedDamage = mitigateIncomingDamage(enemyDefinition.damage, 0);
    expect(hpAfterDamage).toBe(100 - expectedDamage);

    client.send("request_use_healing_flask", { type: "request_use_healing_flask" });

    const accepted = await waitForMessage<RequestUseHealingFlaskAcceptedServerMessage>(
      client,
      "request_use_healing_flask_accepted",
    );
    expect(accepted.healedAmount).toBe(HEALING_FLASK_HEAL_AMOUNT);

    const playerAfterHeal = room.state.playerPresence.get(client.sessionId);
    expect(playerAfterHeal?.hp).toBe((hpAfterDamage ?? 0) + HEALING_FLASK_HEAL_AMOUNT);
  });
});
