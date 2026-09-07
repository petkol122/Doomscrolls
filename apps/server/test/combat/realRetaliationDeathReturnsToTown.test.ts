import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { CombatTownReturnApprovedServerMessage, ZoneId } from "@doomscrolls/shared";
import { contentRegistry } from "@doomscrolls/content";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { isolateSingleEnemy } from "../support/isolateSingleEnemy";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.24 -- the first genuine end-to-end proof that dying in a
 * combat zone works as designed. `test/combat/deathReturnsToTown.test.ts`
 * (Core 0.14) proved the Nightmarket handoff itself, but manually
 * poked `player.hp = 0; player.lifeState = "downed"` to get there --
 * because before this build, no code path in CombatRoom could ever
 * actually bring a player's HP to 0 (see `docs/CORE_BUILD_0_24_PLAN.md`,
 * Question 3). This sibling test lets a real enemy attack land the
 * killing blow through the real landing code path, then confirms the
 * same 0.14 death-to-Nightmarket handoff still fires from a real
 * death, not just a simulated one.
 */
describe("CombatRoom death-to-town handoff from a real retaliation kill", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2595);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("a real enemy hit that brings hp to 0 downs the player, and respawn still redirects to Nightmarket", async () => {
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

    // Exactly one hit's worth of HP, unarmored, so the real landing
    // code path's own downed-on-death branch fires on this one hit.
    player.hp = enemyDefinition.damage;
    player.maxHp = enemyDefinition.damage;
    player.armor = 0;
    player.lifeState = "alive";

    enemy.x = player.x;
    enemy.y = player.y;
    enemy.spawnX = player.x;
    enemy.spawnY = player.y;
    enemy.targetPlayerSessionId = player.sessionId;
    enemy.attackLandingAtMs = Date.now() - 100;

    await new Promise((resolve) => setTimeout(resolve, 200));

    const playerAfterHit = room.state.playerPresence.get(client.sessionId);
    expect(playerAfterHit?.hp).toBe(0);
    expect(playerAfterHit?.lifeState).toBe("downed");

    client.send("request_respawn", { type: "request_respawn" });

    const approved = await waitForMessage<CombatTownReturnApprovedServerMessage>(
      client,
      "combat_town_return_approved",
    );
    expect(approved.fromRoomKind).toBe("combat");
    expect(approved.toRoomKind).toBe("town");
    expect(approved.targetZoneId).toBe("nightmarket");
  });
});
