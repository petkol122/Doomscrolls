import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type {
  EnemyAttackResolvedServerMessage,
  EnemyAttackTelegraphServerMessage,
  ZoneId,
} from "@doomscrolls/shared";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { ENEMY_ATTACK_RANGE } from "../../src/realtime/rooms/enemyAiHelpers";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { isolateSingleEnemy } from "../support/isolateSingleEnemy";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Core 0.24 -- first-ever proof, in either room, that dodging an
 * already-telegraphed enemy attack actually causes it to miss.
 *
 * Dodge (Core 0.12) has no explicit dodge-chance/invulnerability flag
 * -- it only avoids damage indirectly, by moving the player outside
 * `ENEMY_ATTACK_RANGE` before the landing re-check runs (see
 * `docs/CORE_BUILD_0_24_PLAN.md`, Question 3). That mechanism could
 * never be exercised in CombatRoom before this build, because no
 * enemy ever telegraphed a real attack here. This test lets a real
 * telegraph start, dodges out of range mid-windup, and confirms the
 * landing resolves as a server-authoritative miss with no HP lost.
 */
describe("CombatRoom dodge avoids a telegraphed retaliation hit", () => {
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

  it("dodging mid-windup resolves the telegraph as a miss and costs no HP", async () => {
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

    isolateSingleEnemy(room.state.enemies, enemy.id);

    player.hp = 1000;
    player.maxHp = 1000;
    player.armor = 0;
    player.lifeState = "alive";
    player.x = enemy.spawnX;
    player.y = enemy.spawnY;

    await waitForMessage<EnemyAttackTelegraphServerMessage>(client, "enemy_attack_telegraph");

    // A real telegraph is now in flight (attackLandingAtMs > 0). Dodge
    // straight away from the enemy -- the default dodge distance (60
    // world units) exceeds ENEMY_ATTACK_RANGE (44), so this should
    // clear the landing range re-check.
    const dodgeDirX = player.x >= enemy.x ? 1 : -1;
    client.send("request_dodge", {
      type: "request_dodge",
      dirX: dodgeDirX,
      dirY: 0,
    });

    await waitForMessage(client, "request_dodge_accepted");

    const playerAfterDodge = room.state.playerPresence.get(client.sessionId);
    expect(playerAfterDodge).toBeDefined();
    if (playerAfterDodge === undefined) {
      throw new Error("expected player presence to still exist after dodge");
    }
    const distanceAfterDodge = Math.hypot(playerAfterDodge.x - enemy.x, playerAfterDodge.y - enemy.y);
    expect(distanceAfterDodge).toBeGreaterThan(ENEMY_ATTACK_RANGE);

    const resolved = await waitForMessage<EnemyAttackResolvedServerMessage>(
      client,
      "enemy_attack_resolved",
    );
    expect(resolved.outcome).toBe("miss");

    const playerAfterLanding = room.state.playerPresence.get(client.sessionId);
    expect(playerAfterLanding?.hp).toBe(1000);
  });
});
