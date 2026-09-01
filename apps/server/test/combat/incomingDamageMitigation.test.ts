import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import { contentRegistry } from "@doomscrolls/content";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.11 -- regression for the fix closing the gap flagged in
 * docs/CORE_BUILD_0_11_PLAN.md: enemy attacks used to apply their flat
 * content `damage` directly to `player.hp`, never consulting the
 * player's real `derived.armor` (base + equipped armor statModifiers).
 * This is CombatRoom's first-ever incoming-damage assertion -- before
 * this build, no test exercised an enemy attack landing at all.
 *
 * The enemy AI tick (`applyCombatEnemyAggroDamage`) runs on a real
 * `setSimulationInterval`, not a mockable clock, so these tests force a
 * landing on the very next tick by presetting `attackLandingAtMs` to a
 * past timestamp and co-locating the enemy with the target, then await
 * one real tick interval.
 */
describe("CombatRoom incoming damage mitigation", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2577);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("applies the raw enemy damage unmitigated when the player has no armor", async () => {
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
      throw new Error(`expected content definition for spawned enemy ${enemy.enemyId}`);
    }

    player.hp = 1000;
    player.maxHp = 1000;
    player.armor = 0;
    player.lifeState = "alive";

    enemy.defeated = false;
    enemy.hp = Math.max(1, enemy.hp);
    enemy.x = player.x;
    enemy.y = player.y;
    enemy.targetPlayerSessionId = player.sessionId;
    enemy.attackLandingAtMs = Date.now() - 100;

    await new Promise((resolve) => setTimeout(resolve, 200));

    const playerAfter = room.state.playerPresence.get(client.sessionId);
    expect(playerAfter?.hp).toBe(1000 - enemyDefinition.damage);
  });

  it("floors mitigated damage at 1 when armor exceeds the raw hit", async () => {
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

    player.hp = 1000;
    player.maxHp = 1000;
    // Far above every current enemy's damage/heavyAttackDamage value
    // (max 6, Trashboar Brute's heavy attack) -- proves the floor, not
    // just "less damage than before".
    player.armor = 999;
    player.lifeState = "alive";

    enemy.defeated = false;
    enemy.hp = Math.max(1, enemy.hp);
    enemy.x = player.x;
    enemy.y = player.y;
    enemy.targetPlayerSessionId = player.sessionId;
    enemy.attackLandingAtMs = Date.now() - 100;

    await new Promise((resolve) => setTimeout(resolve, 200));

    const playerAfter = room.state.playerPresence.get(client.sessionId);
    expect(playerAfter?.hp).toBe(1000 - 1);
  });
});
