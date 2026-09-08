import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { ZoneId } from "@doomscrolls/shared";
import type { RequestAttackAcceptedServerMessage } from "@doomscrolls/shared";
import { ObjectiveRepository } from "../../src/persistence/repositories/ObjectiveRepository";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

// Core investigation §11 follow-up -- spy on CombatRoom's own logger so
// the "a rejected write is logged, not silently dropped" half of the
// fix has a real assertion behind it. `createRoomLogger`'s real
// implementation already no-ops safely when no logger is attached (as
// is the case in this test harness), so mocking it here doesn't change
// any other test's behavior -- it just makes the same no-op-shaped
// calls observable. `vi.hoisted` is required because `vi.mock`
// factories are hoisted above normal module-scope declarations.
const roomLoggerErrorSpy = vi.hoisted(() => vi.fn());
vi.mock("../../src/realtime/rooms/roomLogger", () => ({
  createRoomLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: roomLoggerErrorSpy,
  })),
}));

function defaultObjectiveRepositoryMock(): Partial<ObjectiveRepository> {
  return {
    findByCharacterAndObjective: vi.fn().mockResolvedValue(null),
    findCompletedByCharacter: vi.fn().mockResolvedValue([]),
    updateProgress: vi.fn().mockResolvedValue(undefined),
    markRewardGranted: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
    startOrRestart: vi.fn().mockResolvedValue(undefined),
    markCompleted: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Production hotfix -- docs/PRISMA_WINDOWS_TEARDOWN_CRASH_INVESTIGATION.md
 * §11. `CombatRoom`'s enemy-kill handler fires XP/objective-progress
 * writes with `void` (fire-and-forget; combat shouldn't block on a DB
 * round-trip to feel responsive). Before this fix, tearing the room
 * down (zone travel, disconnect, matchmaking routing) while one of
 * those writes was still in flight could orphan it -- the same
 * write-not-awaited-before-teardown shape §10 confirmed corrupts a
 * native client under test.
 *
 * Three things are proven here, not just hand-verified (AGENTS.md's
 * "Verification Must Be Permanent" rule):
 *  1. `onDispose` waits for a tracked write to actually settle before
 *     the room finishes closing (slow the mocked
 *     `ObjectiveRepository.updateProgress` call, tear the room down
 *     via `room.disconnect()` -- which Colyseus resolves only once
 *     `onDispose`'s own promise settles -- while it is still in
 *     flight).
 *  2. A write that *rejects* is logged (not silently dropped) and
 *     still lets disposal complete without hanging.
 *  3. Each tracked write is pruned from the pending Set as it settles,
 *     not only cleared in bulk when the room finally disposes -- so a
 *     long-lived room doesn't accumulate one referenced promise per
 *     kill for its entire session.
 */
describe("CombatRoom pending-write flush on dispose", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2592);
  });

  afterEach(async () => {
    vi.mocked(ObjectiveRepository).mockImplementation(defaultObjectiveRepositoryMock as never);
    roomLoggerErrorSpy.mockClear();
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("waits for an in-flight objective-progress write before the room finishes disposing", async () => {
    let updateProgressResolved = false;
    vi.mocked(ObjectiveRepository).mockImplementation(() => ({
      ...defaultObjectiveRepositoryMock(),
      // Real delay -- gives the room a real window to be torn down
      // while this write is still in flight, the same shape of window
      // the production bug this fixes depends on.
      updateProgress: vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        updateProgressResolved = true;
      }),
    } as never));

    const client = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "blackwire_sewers" as ZoneId,
    });

    const room = colyseus.getRoomById<CombatRoomState>(client.roomId);
    const player = room.state.playerPresence.get(client.sessionId);
    expect(player).toBeDefined();
    if (player === undefined) {
      throw new Error("expected joined player to have a presence entry");
    }

    player.hasObjective = true;
    player.objectiveId = "cull_trashboars";
    player.objectiveLabel = "Cull Trashboars";
    player.objectiveCurrent = 0;
    player.objectiveTarget = 3;
    player.objectiveCompleted = false;
    player.objectiveRewardGranted = false;

    const runt = [...room.state.enemies.values()].find((e) => e.enemyId === "trashboar_runt");
    expect(runt).toBeDefined();
    if (runt === undefined) {
      throw new Error("expected CombatRoom to spawn a trashboar_runt in blackwire_sewers");
    }

    runt.hp = 1;
    player.x = runt.x;
    player.y = runt.y;

    const acceptedPromise = waitForMessage<RequestAttackAcceptedServerMessage>(client, "request_attack_accepted");
    client.send("request_attack", { type: "request_attack", targetEnemyId: runt.id });
    await acceptedPromise;

    // The kill has been processed synchronously; the mocked
    // updateProgress call has started (200ms delay in flight) but has
    // not resolved yet. Tear the room down right now, before it
    // resolves -- the exact scenario this fix targets.
    // `room.disconnect()` resolves only once CombatRoom's `onDispose`
    // itself resolves (Colyseus awaits `onDispose`'s return value
    // internally, in `Room#_dispose`, before emitting the "disconnect"
    // event `disconnect()` waits on) -- so if the write were still
    // orphaned rather than tracked, this assertion would see `false`.
    await room.disconnect();

    expect(updateProgressResolved).toBe(true);
  });

  it("logs a rejected write and still completes disposal without hanging", async () => {
    vi.mocked(ObjectiveRepository).mockImplementation(() => ({
      ...defaultObjectiveRepositoryMock(),
      updateProgress: vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        throw new Error("simulated DB failure");
      }),
    } as never));

    const client = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "blackwire_sewers" as ZoneId,
    });

    const room = colyseus.getRoomById<CombatRoomState>(client.roomId);
    const player = room.state.playerPresence.get(client.sessionId);
    expect(player).toBeDefined();
    if (player === undefined) {
      throw new Error("expected joined player to have a presence entry");
    }

    player.hasObjective = true;
    player.objectiveId = "cull_trashboars";
    player.objectiveLabel = "Cull Trashboars";
    player.objectiveCurrent = 0;
    player.objectiveTarget = 3;
    player.objectiveCompleted = false;
    player.objectiveRewardGranted = false;

    const runt = [...room.state.enemies.values()].find((e) => e.enemyId === "trashboar_runt");
    expect(runt).toBeDefined();
    if (runt === undefined) {
      throw new Error("expected CombatRoom to spawn a trashboar_runt in blackwire_sewers");
    }

    runt.hp = 1;
    player.x = runt.x;
    player.y = runt.y;

    const acceptedPromise = waitForMessage<RequestAttackAcceptedServerMessage>(client, "request_attack_accepted");
    client.send("request_attack", { type: "request_attack", targetEnemyId: runt.id });
    await acceptedPromise;

    // The mocked write is in flight and will *reject* in 50ms. Tear the
    // room down now, before that happens. `room.disconnect()` must
    // still resolve (proving `trackPendingWrite`'s internal catch keeps
    // a rejected write from making `Promise.all` in `onDispose` itself
    // reject and hang disposal) -- Vitest's own test timeout would
    // catch a genuine hang here regardless, but the assertions below
    // confirm the specific mechanism, not just "it didn't time out".
    await room.disconnect();

    expect(roomLoggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ write: "objectiveProgress.updateProgress" }),
      "CombatRoom fire-and-forget write failed.",
    );
  });

  it("prunes each tracked write from the pending set as it settles, not only in bulk at dispose", async () => {
    // Default (fast, non-delayed) mock -- this test is about whether
    // the Set shrinks as writes settle during a long-lived room's
    // session, not about a slow write racing teardown.
    const client = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "blackwire_sewers" as ZoneId,
    });

    const room = colyseus.getRoomById<CombatRoomState>(client.roomId);
    const player = room.state.playerPresence.get(client.sessionId);
    expect(player).toBeDefined();
    if (player === undefined) {
      throw new Error("expected joined player to have a presence entry");
    }

    const pendingWrites = (room as unknown as { pendingWrites: Set<Promise<unknown>> }).pendingWrites;
    expect(pendingWrites.size).toBe(0);

    // Every kill tracks two writes (grantEnemyDefeatXp +
    // objective-progress). If nothing pruned each write from the Set
    // as it settled -- only clearing it in bulk at dispose -- this
    // would grow to 2, 4, 6... across these three kills instead of
    // returning to 0 after each one settles, which is exactly the
    // unbounded-growth-over-a-room's-lifetime concern this guards
    // against.
    const enemies = [...room.state.enemies.values()].slice(0, 3);
    expect(enemies.length).toBe(3);

    for (const enemy of enemies) {
      enemy.hp = 1;
      player.x = enemy.x;
      player.y = enemy.y;
      // Bypass the player's own attack cooldown (600ms default,
      // apps/server/src/realtime/rooms/attackCooldown.ts) directly
      // rather than waiting it out -- this test is about pending-write
      // pruning across kills, not attack pacing.
      player.nextAttackAt = 0;

      const acceptedPromise = waitForMessage<RequestAttackAcceptedServerMessage>(client, "request_attack_accepted");
      client.send("request_attack", { type: "request_attack", targetEnemyId: enemy.id });
      await acceptedPromise;

      // Give this kill's (fast, unmocked-delay) tracked writes a
      // moment to settle before checking the Set again.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(pendingWrites.size).toBe(0);
    }
  });
});
