import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import { contentRegistry } from "@doomscrolls/content";
import type { TownRoomState } from "../../src/realtime/rooms/TownRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.11 -- TownRoom equivalent of
 * `test/combat/incomingDamageMitigation.test.ts`. `TownRoom.ts` has its
 * own separate enemy-attack tick (`applyEnemyAggroDamage`) with its own
 * aggro/leash re-validation before the landing check, so the fix (and
 * this proof) must land here independently of CombatRoom.
 *
 * The enemy is co-located with its own spawn point (not just the
 * target) so the tick's aggro/leash-range re-checks trivially pass
 * regardless of each enemy's content-configured range.
 */
describe("TownRoom incoming damage mitigation", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2578);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("applies the raw enemy damage unmitigated when the player has no armor", async () => {
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
    player.x = enemy.spawnX;
    player.y = enemy.spawnY;

    enemy.defeated = false;
    enemy.hp = Math.max(1, enemy.hp);
    enemy.x = enemy.spawnX;
    enemy.y = enemy.spawnY;
    enemy.attackKind = "normal";
    enemy.targetPlayerSessionId = player.sessionId;
    enemy.attackLandingAtMs = Date.now() - 100;

    await new Promise((resolve) => setTimeout(resolve, 200));

    const playerAfter = room.state.playerPresence.get(client.sessionId);
    expect(playerAfter?.hp).toBe(1000 - enemyDefinition.damage);
  });

  it("floors mitigated damage at 1 when armor exceeds the raw hit", async () => {
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
    player.x = enemy.spawnX;
    player.y = enemy.spawnY;

    enemy.defeated = false;
    enemy.hp = Math.max(1, enemy.hp);
    enemy.x = enemy.spawnX;
    enemy.y = enemy.spawnY;
    enemy.attackKind = "normal";
    enemy.targetPlayerSessionId = player.sessionId;
    enemy.attackLandingAtMs = Date.now() - 100;

    await new Promise((resolve) => setTimeout(resolve, 200));

    const playerAfter = room.state.playerPresence.get(client.sessionId);
    expect(playerAfter?.hp).toBe(1000 - 1);
  });
});
