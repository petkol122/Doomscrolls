import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import type {
  RequestUseSkillSlotAcceptedServerMessage,
  RequestUseSkillSlotRejectedServerMessage,
} from "@doomscrolls/shared";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { TEST_CHARACTER_ID, TEST_CHARACTER_STATS, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.14 -- `heavy_strike` (every class's `startingSkillId`) becomes
 * a playable "primary" skill slot, resolved through the exact same
 * pipeline the existing "secondary"/"tertiary" slots already use (see
 * `apps/server/test/combat/skillSlotCasting.test.ts`, the pattern this
 * mirrors). Before this build, `request_use_skill_slot.slot` had no
 * "primary" value at all, so this message would have been rejected at
 * the type/parsing layer with `skill_unavailable` regardless of what
 * was sent.
 */
describe("CombatRoom primary skill-slot casting", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2582);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("accepts a primary skill-slot cast against an in-range enemy", async () => {
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

    // Avoid the enemy-defeat XP/objective/loot path entirely -- this
    // test is only about the primary slot resolving and landing.
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
      slot: "primary",
      targetEnemyId: enemy.id,
    });

    const accepted = await waitForMessage<RequestUseSkillSlotAcceptedServerMessage>(
      client,
      "request_use_skill_slot_accepted",
    );

    // heavy_strike's own baseDamage (3) plus the fixture's power/equipment
    // damage bonus (TEST_CHARACTER_STATS.derived.damage - 1), the same
    // formula the secondary/tertiary tests already assert against.
    const expectedDamage = 3 + (TEST_CHARACTER_STATS.derived.damage - 1);
    expect(accepted.slot).toBe("primary");
    expect(accepted.targetEnemyId).toBe(enemy.id);
    expect(accepted.damage).toBe(expectedDamage);
    expect(accepted.defeated).toBe(false);
    expect(accepted.remainingHp).toBe(1000 - expectedDamage);
  });

  it("rejects an immediate re-cast of the primary slot as on cooldown", async () => {
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
      slot: "primary",
      targetEnemyId: enemy.id,
    });
    await waitForMessage<RequestUseSkillSlotAcceptedServerMessage>(client, "request_use_skill_slot_accepted");

    client.send("request_use_skill_slot", {
      type: "request_use_skill_slot",
      slot: "primary",
      targetEnemyId: enemy.id,
    });
    const rejected = await waitForMessage<RequestUseSkillSlotRejectedServerMessage>(
      client,
      "request_use_skill_slot_rejected",
    );

    expect(rejected.slot).toBe("primary");
    expect(rejected.reason).toBe("skill_on_cooldown");
  });
});
