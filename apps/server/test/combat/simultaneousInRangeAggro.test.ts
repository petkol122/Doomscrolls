import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import { contentRegistry } from "@doomscrolls/content";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { isolateSingleEnemy } from "../support/isolateSingleEnemy";
import { waitUntil } from "../support/waitUntil";
import {
  TEST_CHARACTER_ID,
  TEST_IRONCLAD_CHARACTER_ID,
  TEST_USER_ID,
} from "../support/fixtures";

/**
 * Core 0.28 follow-up check -- `twoPlayerAggroAcquisition.test.ts` only
 * ever had ONE of the two real players in range at any given moment
 * (far/near/re-acquire, sequential). It never covered the case this
 * test targets: both real players in range of the same enemy at the
 * SAME time, from the very first tick the enemy has no target at all.
 *
 * This proves three things a sequential-only test cannot:
 *  1. Exactly one target gets committed (not left null, not both).
 *  2. That commitment is stable across many ticks while both players
 *     remain alive and in range -- it must not flip between sessions
 *     tick-to-tick, which would look glitchy live (a telegraph arrow
 *     jumping between two players).
 *  3. Only the committed target's hp ever changes. CombatRoom's
 *     landing logic resolves a single `landingTarget` object per
 *     attack (`applyCombatEnemyAggroDamage`,
 *     apps/server/src/realtime/rooms/CombatRoom.ts) -- there is no
 *     code path that writes `.hp` on more than one player per landed
 *     hit, so the untargeted player must stay at full hp through at
 *     least one full attack cycle.
 */
describe("CombatRoom enemy aggro with two real players simultaneously in range", () => {
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

  it("commits to exactly one target consistently, and only that target ever takes damage", async () => {
    const clientA = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "blackwire_sewers" as ZoneId,
    });
    const clientB = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_IRONCLAD_CHARACTER_ID,
      requestedZoneId: "blackwire_sewers" as ZoneId,
    });

    const room = colyseus.getRoomById<CombatRoomState>(clientA.roomId);
    const enemy = [...room.state.enemies.values()][0];
    expect(enemy).toBeDefined();
    if (enemy === undefined) {
      throw new Error("expected CombatRoom to spawn at least one enemy for blackwire_sewers");
    }
    isolateSingleEnemy(room.state.enemies, enemy.id);

    const enemyDefinition = contentRegistry.enemies.get(enemy.enemyId as never);
    expect(enemyDefinition).toBeDefined();
    if (enemyDefinition === undefined) {
      throw new Error(`expected content definition for spawned enemy ${enemy.enemyId}`);
    }

    const playerA = room.state.playerPresence.get(clientA.sessionId);
    const playerB = room.state.playerPresence.get(clientB.sessionId);
    expect(playerA).toBeDefined();
    expect(playerB).toBeDefined();
    if (playerA === undefined || playerB === undefined) {
      throw new Error("expected both joined players to have presence entries");
    }

    // Both players in range of the enemy's attack (not just aggro
    // range) from the very first tick -- before this, the enemy has
    // never had a target at all (targetPlayerSessionId === "").
    expect(enemy.targetPlayerSessionId).toBe("");
    playerA.hp = 1000;
    playerA.maxHp = 1000;
    playerA.lifeState = "alive";
    playerA.x = enemy.spawnX - 5;
    playerA.y = enemy.spawnY;
    playerB.hp = 1000;
    playerB.maxHp = 1000;
    playerB.lifeState = "alive";
    playerB.x = enemy.spawnX + 5;
    playerB.y = enemy.spawnY;

    // 1) Exactly one target gets committed.
    await waitUntil(() => room.state.enemies.get(enemy.id)?.targetPlayerSessionId !== "", {
      timeoutMs: 3000,
    });
    const committedTarget = room.state.enemies.get(enemy.id)?.targetPlayerSessionId;
    expect([playerA.sessionId, playerB.sessionId]).toContain(committedTarget);

    // 2) That commitment is stable -- sample repeatedly across many
    // ticks (50ms tick rate) while both players stay alive and in
    // range. Every non-empty sample must be the same session; the
    // target must never flip to the other player.
    const observedTargets = new Set<string>();
    for (let i = 0; i < 16; i += 1) {
      const current = room.state.enemies.get(enemy.id)?.targetPlayerSessionId ?? "";
      if (current.length > 0) {
        observedTargets.add(current);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(observedTargets.size).toBe(1);
    expect([...observedTargets][0]).toBe(committedTarget);

    // 3) Only the committed target ever takes damage. Wait through a
    // full telegraph/windup/landing cycle (windup is 300ms) and
    // confirm exactly one player's hp dropped.
    await waitUntil(() => {
      const a = room.state.playerPresence.get(clientA.sessionId);
      const b = room.state.playerPresence.get(clientB.sessionId);
      return (a?.hp ?? 1000) < 1000 || (b?.hp ?? 1000) < 1000;
    }, { timeoutMs: 3000 });

    const targetedPlayer = committedTarget === playerA.sessionId ? playerA : playerB;
    const untargetedPlayer = committedTarget === playerA.sessionId ? playerB : playerA;

    expect(targetedPlayer.hp).toBeLessThan(1000);
    expect(untargetedPlayer.hp).toBe(1000);

    // Re-confirm the target didn't switch as a side effect of landing
    // the hit (e.g. re-acquisition logic accidentally re-running).
    expect(room.state.enemies.get(enemy.id)?.targetPlayerSessionId).toBe(committedTarget);
  });
});
