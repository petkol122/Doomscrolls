import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import { contentRegistry } from "@doomscrolls/content";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { mitigateIncomingDamage } from "../../src/realtime/rooms/incomingDamageMitigation";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { isolateSingleEnemy } from "../support/isolateSingleEnemy";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.24 -- regression guard for the Question 1 scope cut in
 * `docs/CORE_BUILD_0_24_PLAN.md`: heavy attacks are deliberately not
 * ported this build. Saltmere Docks' Drowned Hauler carries a real
 * `heavyAttackDamage` (7) content field and would, if the heavy branch
 * were ever read, have a 35% chance per eligible telegraph of landing
 * it instead of its normal 4-damage hit -- a hit that has never landed
 * on a real player anywhere in the game.
 *
 * This test proves the opposite is true today: across several attack
 * cycles, every single landed hit equals exactly the enemy's normal
 * `damage` value, never `heavyAttackDamage`. If a future change
 * accidentally re-wires the heavy branch into CombatRoom without
 * updating this test, this assertion fails.
 */
describe("CombatRoom heavy-anchor normal-only guard", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2591);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("only ever lands the Drowned Hauler's normal damage, never its heavyAttackDamage", async () => {
    const client = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "saltmere_docks" as ZoneId,
    });

    const room = colyseus.getRoomById<CombatRoomState>(client.roomId);
    const enemy = [...room.state.enemies.values()].find(
      (candidate) => candidate.enemyId === "drowned_hauler",
    );
    expect(enemy).toBeDefined();
    if (enemy === undefined) {
      throw new Error("expected Saltmere Docks to spawn a drowned_hauler heavy anchor");
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
    // Confirms this enemy is genuinely heavy-attack-*capable* in
    // content -- otherwise this guard would trivially pass for the
    // wrong reason (an enemy with no heavy attack to accidentally fire).
    expect(enemyDefinition.heavyAttackDamage).toBeGreaterThan(enemyDefinition.damage);

    isolateSingleEnemy(room.state.enemies, enemy.id);

    player.hp = 100000;
    player.maxHp = 100000;
    player.armor = 0;
    player.lifeState = "alive";
    player.x = enemy.spawnX;
    player.y = enemy.spawnY;

    // Cover several real attack cycles (normal cooldown 900ms) -- long
    // enough that if the heavy branch were live, its 35% per-eligible-
    // telegraph chance would almost certainly have fired at least once.
    await new Promise((resolve) => setTimeout(resolve, 3500));

    const playerAfter = room.state.playerPresence.get(client.sessionId);
    expect(playerAfter).toBeDefined();
    if (playerAfter === undefined) {
      throw new Error("expected player presence to still exist");
    }

    const totalDamageTaken = 100000 - playerAfter.hp;
    expect(totalDamageTaken).toBeGreaterThan(0);

    const normalMitigated = mitigateIncomingDamage(enemyDefinition.damage, 0);
    const heavyMitigated = mitigateIncomingDamage(enemyDefinition.heavyAttackDamage ?? 0, 0);

    // Every hit landed must be a whole number of normal-damage
    // increments -- if even one heavy hit (7, mitigated to 7 at armor
    // 0) had landed, this would not divide evenly by the normal
    // increment (4), since 4 and 7 are coprime.
    expect(totalDamageTaken % normalMitigated).toBe(0);
    expect(heavyMitigated).not.toBe(normalMitigated);

    expect(enemy.attackKind).toBe("normal");
  });
});
