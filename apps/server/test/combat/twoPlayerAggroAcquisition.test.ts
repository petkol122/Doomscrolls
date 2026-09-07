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
 * Core 0.28 -- Wrinkle 1 from docs/CORE_BUILD_0_28_PLAN.md. CombatRoom's
 * enemy aggro acquisition was ported from TownRoom in Core 0.24 as a
 * direct copy of the proximity-scan-all-connected-players loop, and its
 * own doc comment already claims multi-player aggro "falls out of the
 * ported acquisition loop directly." That claim had never actually been
 * exercised with two real players in the same CombatRoom instance --
 * every prior CombatRoom test (enemyAggroAcquisition.test.ts,
 * enemyLeashReturn.test.ts, etc.) used exactly one real client. This
 * test proves the claim with two: an enemy must pick the nearer of two
 * real players, ignore the far one, and correctly re-acquire the
 * surviving player once the original target becomes out of range --
 * not just "the only player present."
 */
describe("CombatRoom enemy aggro acquisition with two real players", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2593);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("targets the in-range player over a far-away one, then re-acquires the surviving player once the first leaves range", async () => {
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

    // Same room instance -- Wrinkle 3's matchmaking finding, confirmed
    // directly rather than assumed for this specific test's setup too.
    expect(clientB.roomId).toBe(clientA.roomId);

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
    const outOfRangeOffset = enemyDefinition.aggroRange + 500;

    const playerA = room.state.playerPresence.get(clientA.sessionId);
    const playerB = room.state.playerPresence.get(clientB.sessionId);
    expect(playerA).toBeDefined();
    expect(playerB).toBeDefined();
    if (playerA === undefined || playerB === undefined) {
      throw new Error("expected both joined players to have presence entries");
    }
    playerA.hp = 1000;
    playerA.maxHp = 1000;
    playerA.lifeState = "alive";
    playerB.hp = 1000;
    playerB.maxHp = 1000;
    playerB.lifeState = "alive";

    // Phase 1: A is far outside aggro range, B is co-located with the
    // enemy's own spawn (well within range). The enemy must pick B --
    // not just "the only player present," since A is a real, live,
    // in-range-eligible-looking distraction.
    playerA.x = enemy.spawnX + outOfRangeOffset;
    playerA.y = enemy.spawnY;
    playerB.x = enemy.spawnX;
    playerB.y = enemy.spawnY;

    await waitUntil(() => room.state.enemies.get(enemy.id)?.targetPlayerSessionId === playerB.sessionId, {
      timeoutMs: 3000,
    });
    expect(room.state.enemies.get(enemy.id)?.state).toBe("chasing");

    // Phase 2: B (the current target) now moves far out of range too,
    // while A moves into range. The enemy must drop B and re-acquire
    // A -- proving real re-acquisition across a pool of two players,
    // not merely "drop the one target and re-target the same player."
    playerB.x = enemy.spawnX + outOfRangeOffset;
    playerB.y = enemy.spawnY;
    playerA.x = enemy.spawnX;
    playerA.y = enemy.spawnY;

    await waitUntil(() => room.state.enemies.get(enemy.id)?.targetPlayerSessionId === playerA.sessionId, {
      timeoutMs: 3000,
    });
    expect(room.state.enemies.get(enemy.id)?.state).toBe("chasing");
  });
});
