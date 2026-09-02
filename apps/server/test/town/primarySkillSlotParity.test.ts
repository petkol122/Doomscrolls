import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import type { RequestUseSkillSlotAcceptedServerMessage } from "@doomscrolls/shared";
import type { TownRoomState } from "../../src/realtime/rooms/TownRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { TEST_CHARACTER_ID, TEST_CHARACTER_STATS, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.14 -- `registerSkillSlotHandler` is implemented separately in
 * `TownRoom.ts` and `CombatRoom.ts` (not shared), so the new "primary"
 * slot needs its own proof in each room, the same way 0.12's dodge/flask
 * port needed a `CombatRoom`-specific test even though the underlying
 * logic already worked in `TownRoom`. This is that proof for `TownRoom`:
 * without it, a future change could re-widen only one room's handler and
 * silently reintroduce a one-room-only gap.
 */
describe("TownRoom primary skill-slot parity", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2583);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("accepts a primary skill-slot cast in TownRoom, same as CombatRoom", async () => {
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

    const expectedDamage = 3 + (TEST_CHARACTER_STATS.derived.damage - 1);
    expect(accepted.slot).toBe("primary");
    expect(accepted.damage).toBe(expectedDamage);
    expect(accepted.remainingHp).toBe(1000 - expectedDamage);
  });
});
