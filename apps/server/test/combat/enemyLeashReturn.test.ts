import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.24 -- leash/return-to-spawn parity check against
 * `TownRoom.applyEnemyAggroDamage`. Before this build, CombatRoom had
 * no leash logic at all (an enemy that somehow had a target, however
 * far from its spawn, would just keep chasing forever) -- this proves
 * the ported behavior: a target that leaves aggro range is dropped,
 * the enemy switches to "returning", walks back to its own spawn
 * point, and re-idles once it arrives.
 */
describe("CombatRoom enemy leash / return-to-spawn", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2592);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("drops an out-of-range target, returns to spawn, and re-idles", async () => {
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
    player.lifeState = "alive";
    // Far beyond any enemy's aggro range (max ~204 world units).
    player.x = enemy.spawnX + 5000;
    player.y = enemy.spawnY + 5000;

    // Simulate a mid-chase enemy a real distance from its own spawn --
    // far enough that the return walk takes long enough to reliably
    // observe the intermediate "returning" state below (a too-small
    // offset can fully resolve to "idle" before the first check runs),
    // close enough to still settle well within the test timeout.
    enemy.x = enemy.spawnX + 150;
    enemy.y = enemy.spawnY;
    enemy.state = "chasing";
    enemy.targetPlayerSessionId = player.sessionId;

    // One tick's worth of time is enough for the existing-target
    // aggro-range re-check to fire and clear the target.
    await new Promise((resolve) => setTimeout(resolve, 100));

    const enemyAfterDrop = room.state.enemies.get(enemy.id);
    expect(enemyAfterDrop?.targetPlayerSessionId).toBe("");
    expect(enemyAfterDrop?.state).toBe("returning");

    // Poll for the "idle" transition instead of a single fixed wait --
    // once idle, the shared `applyWanderMovement` helper starts
    // nudging the enemy within a wander radius on later ticks, so a
    // late read could show a position that has already drifted from
    // the exact spawn point despite having arrived correctly.
    const deadline = Date.now() + 2000;
    let enemyAfterReturn = room.state.enemies.get(enemy.id);
    while (enemyAfterReturn?.state !== "idle" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      enemyAfterReturn = room.state.enemies.get(enemy.id);
    }

    expect(enemyAfterReturn?.state).toBe("idle");
    expect(enemyAfterReturn?.targetPlayerSessionId).toBe("");
    expect(Math.hypot(
      (enemyAfterReturn?.x ?? 0) - enemy.spawnX,
      (enemyAfterReturn?.y ?? 0) - enemy.spawnY,
    )).toBeLessThan(5);
  });
});
