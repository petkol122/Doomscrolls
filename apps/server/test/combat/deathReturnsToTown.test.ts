import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { CombatTownReturnApprovedServerMessage, ZoneId } from "@doomscrolls/shared";
import { CharacterService } from "../../src/character/CharacterService";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";
import type { CombatRoomState } from "../../src/realtime/rooms/CombatRoomState";

/**
 * Core 0.14 -- death in a real combat zone now has a real consequence:
 * `CombatRoom`'s `request_respawn` handler no longer resurrects the
 * player in place (full HP, teleport to the spawn box centre, stay in
 * the room). Instead it performs the exact same handoff the voluntary
 * `request_combat_return` (clicking the return gate) already does --
 * `resolveCombatZoneReturnSpawnId` + `CharacterService.updateCharacterRoomIntent`
 * + `combat_town_return_approved` -- landing the player back in
 * Nightmarket with full HP/flask charges instead of a free in-place
 * respawn.
 *
 * This mirrors `apps/server/test/town/combatHandoffPositionPersistence.test.ts`'s
 * pattern exactly, including its "onLeave does not double-persist after
 * the client leaves" assertion: the death path sets the same
 * `pendingActionType: "zone_transition"` guard the voluntary path sets,
 * so `CombatRoom.onLeave`'s existing guard (hardened by that same fix)
 * must also skip its own persistence here, not just for a gate click.
 */
describe("CombatRoom death-to-town handoff", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2584);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("redirects a downed player's respawn request to Nightmarket, not an in-place respawn", async () => {
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

    // Simulate defeat.
    player.hp = 0;
    player.lifeState = "downed";

    client.send("request_respawn", { type: "request_respawn" });

    const approved = await waitForMessage<CombatTownReturnApprovedServerMessage>(
      client,
      "combat_town_return_approved",
    );
    expect(approved.fromRoomKind).toBe("combat");
    expect(approved.toRoomKind).toBe("town");
    expect(approved.targetZoneId).toBe("nightmarket");
    expect(approved.targetSpawnKey).toBe("nightmarket_blackwire_combat_entry");

    // Mirrors the real client: it calls room.leave() right after
    // receiving the approval (see WorldSessionScene's
    // combat_town_return_approved handler -> beginTownRoomReturnHandoff).
    await client.leave();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const constructedServices = vi.mocked(CharacterService).mock.results.map((result) => result.value);
    const roomIntentCalls = constructedServices.flatMap(
      (instance) => instance.updateCharacterRoomIntent.mock.calls,
    );
    const locationCalls = constructedServices.flatMap(
      (instance) => instance.updateCharacterLocation.mock.calls,
    );

    expect(roomIntentCalls).toHaveLength(1);
    const [, zoneId, x, y, hp] = roomIntentCalls[0];
    expect(zoneId).toBe("nightmarket");
    // nightmarket_blackwire_combat_entry's own real spawn coordinates
    // (packages/content/src/data/spawnPoints.ts), not an in-zone
    // combat-spawn-box position -- the old in-place respawn never left
    // the combat zone at all.
    expect(x).toBe(2860);
    expect(y).toBe(2120);
    expect(hp).toBe(player.maxHp);

    // The regression: onLeave must not have run its own overwrite with
    // this room's own (stale, in-combat-zone) position.
    expect(locationCalls).toHaveLength(0);
  });
});
