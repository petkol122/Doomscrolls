import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import type { RequestUseSkillSlotAcceptedServerMessage } from "@doomscrolls/shared";
import type { TownRoomState } from "../../src/realtime/rooms/TownRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { TEST_IRONCLAD_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * TownRoom's first vitest regression case (see docs/CORE_BUILD_0_9_PLAN.md
 * -- a direct side effect of fixing `resolveSkillSlotDefinition` correctly,
 * not a separate backfill effort).
 *
 * Regression for Core 0.9's real fix: `resolveSkillSlotDefinition` used to
 * hardcode Gravewalker's skill mapping regardless of the joined
 * character's actual class. `TownRoom.ts` has its own call site
 * (`registerSkillSlotHandler`), separate from `CombatRoom.ts`'s -- this
 * proves the fix landed there too, not just in CombatRoom.
 */
describe("TownRoom skill-slot class resolution", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2574);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("resolves the joined character's own class, not a hardcoded default", async () => {
    const client = await colyseus.sdk.joinOrCreate("town", {
      userId: TEST_USER_ID,
      characterId: TEST_IRONCLAD_CHARACTER_ID,
      requestedZoneId: "nightmarket" as ZoneId,
    });

    const room = colyseus.getRoomById<TownRoomState>(client.roomId);
    const enemy = [...room.state.enemies.values()][0];
    expect(enemy).toBeDefined();
    if (enemy === undefined) {
      throw new Error("expected TownRoom to spawn at least one enemy for nightmarket");
    }

    // Avoid the enemy-defeat XP/objective/loot path entirely -- this test
    // is only about which skill the class resolves to.
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

    // Shatter Blow (Ironclad's secondary), not Grave Spark (Gravewalker's).
    expect(accepted.damage).toBe(6);
    expect(accepted.remainingHp).toBe(1000 - 6);
  });
});
