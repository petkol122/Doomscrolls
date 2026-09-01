import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import type { RequestUseSkillSlotAcceptedServerMessage } from "@doomscrolls/shared";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { TEST_CHARACTER_ID, TEST_IRONCLAD_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Regression for Core 0.7 Task 360's "Unplanned finding" (see
 * docs/CORE_BUILD_0_7_RELEASE_NOTES.md): `request_use_skill_slot` was
 * registered only in TownRoom.ts, so neither skill slot could be cast in
 * either real combat zone. Before the fix, a client sending this message
 * to CombatRoom simply never heard back -- this test fails the same way
 * (a timeout waiting for the accepted message) if that regresses.
 */
describe("CombatRoom skill-slot casting", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2571);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("accepts a secondary skill-slot cast against an in-range enemy", async () => {
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

    // Avoid the enemy-defeat XP/objective/loot path entirely -- this test
    // is only about the skill-slot handler existing and responding.
    enemy.hp = 1000;
    enemy.maxHp = 1000;

    const player = room.state.playerPresence.get(client.sessionId);
    expect(player).toBeDefined();
    if (player === undefined) {
      throw new Error("expected joined player to have a presence entry");
    }
    player.x = enemy.x;
    player.y = enemy.y;

    client.send("request_use_skill_slot", {
      type: "request_use_skill_slot",
      slot: "secondary",
      targetEnemyId: enemy.id,
    });

    const accepted = await waitForMessage<RequestUseSkillSlotAcceptedServerMessage>(
      client,
      "request_use_skill_slot_accepted",
    );

    expect(accepted.slot).toBe("secondary");
    expect(accepted.targetEnemyId).toBe(enemy.id);
    expect(accepted.damage).toBeGreaterThan(0);
    expect(accepted.defeated).toBe(false);
    expect(accepted.remainingHp).toBe(1000 - accepted.damage);
  });

  /**
   * Regression for Core 0.9's real fix: `resolveSkillSlotDefinition` used
   * to hardcode Gravewalker's skill mapping regardless of the joined
   * character's actual class. An Ironclad player casting "secondary"
   * must land Shatter Blow (damage 6), not Grave Spark (damage 3) --
   * proving the *joined* character's class, not a default, determines
   * which skill actually lands.
   */
  it("resolves the joined character's own class, not a hardcoded default", async () => {
    const client = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_IRONCLAD_CHARACTER_ID,
      requestedZoneId: "blackwire_sewers" as ZoneId,
    });

    const room = colyseus.getRoomById<CombatRoomState>(client.roomId);
    const enemy = [...room.state.enemies.values()][0];
    expect(enemy).toBeDefined();
    if (enemy === undefined) {
      throw new Error("expected CombatRoom to spawn at least one enemy for blackwire_sewers");
    }

    enemy.hp = 1000;
    enemy.maxHp = 1000;

    const player = room.state.playerPresence.get(client.sessionId);
    expect(player).toBeDefined();
    if (player === undefined) {
      throw new Error("expected joined player to have a presence entry");
    }
    expect(player.classKey).toBe("ironclad");
    player.x = enemy.x;
    player.y = enemy.y;

    client.send("request_use_skill_slot", {
      type: "request_use_skill_slot",
      slot: "secondary",
      targetEnemyId: enemy.id,
    });

    const accepted = await waitForMessage<RequestUseSkillSlotAcceptedServerMessage>(
      client,
      "request_use_skill_slot_accepted",
    );

    expect(accepted.damage).toBe(6);
    expect(accepted.remainingHp).toBe(1000 - 6);
  });
});
