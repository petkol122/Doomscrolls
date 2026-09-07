import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { EnemyAttackTelegraphServerMessage, ZoneId } from "@doomscrolls/shared";
import { contentRegistry } from "@doomscrolls/content";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { mitigateIncomingDamage } from "../../src/realtime/rooms/incomingDamageMitigation";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { isolateSingleEnemy } from "../support/isolateSingleEnemy";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.24 -- CombatRoom's first-ever real enemy-retaliation proof.
 *
 * Before this build, `enemy.targetPlayerSessionId` was never assigned
 * to a real player anywhere in `CombatRoom.ts` -- every enemy sat in
 * "idle" forever and a player could not take damage in any combat
 * zone by any path (see `docs/CORE_BUILD_0_24_PLAN.md`). Every prior
 * CombatRoom damage test (`incomingDamageMitigation.test.ts`, etc.)
 * had to manually preset `targetPlayerSessionId` and
 * `attackLandingAtMs` to exercise the landing code in isolation,
 * because real acquisition never worked.
 *
 * This test does none of that: it only places the player at the
 * enemy's own real spawn point and lets the real acquisition ->
 * telegraph -> windup -> landing state machine run unassisted, then
 * proves an idle enemy actually locks on, warns the client, and
 * lands a real, armor-mitigated hit.
 */
describe("CombatRoom real enemy aggro acquisition", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2590);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("acquires an idle enemy's target by proximity, telegraphs, and lands a mitigated hit -- with no manual target preset", async () => {
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

    // No `targetPlayerSessionId`/`attackLandingAtMs` preset -- this is
    // the one thing every prior CombatRoom damage test had to fake.
    expect(enemy.targetPlayerSessionId).toBe("");
    expect(enemy.state).toBe("idle");

    // Multi-enemy aggro is real (Question 1): a same-pocket enemy
    // could otherwise also acquire the player once co-located and
    // muddy the single-hit assertion below.
    isolateSingleEnemy(room.state.enemies, enemy.id);

    player.hp = 1000;
    player.maxHp = 1000;
    player.armor = 0;
    player.lifeState = "alive";
    // Co-locate with the enemy's own real spawn point so proximity
    // acquisition has something in range on the very next tick,
    // without needing to reverse-engineer the zone's spawn geometry.
    player.x = enemy.spawnX;
    player.y = enemy.spawnY;

    const telegraph = await waitForMessage<EnemyAttackTelegraphServerMessage>(
      client,
      "enemy_attack_telegraph",
    );
    expect(telegraph.enemyId).toBe(enemy.id);
    expect(telegraph.attackKind).toBe("normal");

    // Real acquisition happened: the enemy locked onto this player
    // with no test code ever touching `targetPlayerSessionId`.
    expect(enemy.targetPlayerSessionId).toBe(player.sessionId);
    expect(enemy.state).toBe("chasing");

    // Wait past the windup for the telegraphed hit to land.
    await new Promise((resolve) => setTimeout(resolve, 500));

    const playerAfter = room.state.playerPresence.get(client.sessionId);
    const expectedDamage = mitigateIncomingDamage(enemyDefinition.damage, 0);
    expect(playerAfter?.hp).toBe(1000 - expectedDamage);
  });
});
