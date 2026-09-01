import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import type { RequestAttackAcceptedServerMessage } from "@doomscrolls/shared";
import type { TownRoomState } from "../../src/realtime/rooms/TownRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { TEST_CHARACTER_ID, TEST_CHARACTER_STATS, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.10 -- TownRoom equivalent of
 * `test/combat/basicAttackDamage.test.ts`. `TownRoom.ts` has its own
 * separate `request_attack` handler and its own `applyProgressionUpdate`,
 * so the fix (and this proof) must land here independently of CombatRoom.
 */
describe("TownRoom basic attack damage", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2576);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("deals the joined character's real derived.damage, not a hardcoded literal", async () => {
    const client = await colyseus.sdk.joinOrCreate("town", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "nightmarket" as ZoneId,
    });

    const room = colyseus.getRoomById<TownRoomState>(client.roomId);
    const enemy = [...room.state.enemies.values()][0];
    expect(enemy).toBeDefined();
    if (enemy === undefined) {
      throw new Error("expected TownRoom to spawn at least one enemy for nightmarket");
    }

    // High HP so the hit lands without triggering the defeat/respawn path.
    enemy.hp = 1000;
    enemy.maxHp = 1000;

    const player = room.state.playerPresence.get(client.sessionId);
    expect(player).toBeDefined();
    if (player === undefined) {
      throw new Error("expected joined player to have a presence entry");
    }
    expect(player.damage).toBe(TEST_CHARACTER_STATS.derived.damage);
    player.x = enemy.x;
    player.y = enemy.y;

    client.send("request_attack", {
      type: "request_attack",
      targetEnemyId: enemy.id,
    });

    await waitForMessage<RequestAttackAcceptedServerMessage>(client, "request_attack_accepted");

    const enemyAfter = room.state.enemies.get(enemy.id);
    expect(enemyAfter).toBeDefined();
    expect(enemyAfter?.hp).toBe(1000 - TEST_CHARACTER_STATS.derived.damage);
  });
});
