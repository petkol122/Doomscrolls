import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { RequestInteractClientMessage, TownCombatHandoffApprovedServerMessage, ZoneId } from "@doomscrolls/shared";
import { CharacterService } from "../../src/character/CharacterService";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";
import type { TownRoomState } from "../../src/realtime/rooms/TownRoomState";

/**
 * Regression for a bug found while investigating a live report ("spawn
 * outside the map" / "should spawn on the edge properly" when entering a
 * combat zone from Nightmarket): `TownRoom.onLeave` unconditionally
 * persisted the player's *live TownRoom* position (this room's own
 * "nightmarket" zoneId + whatever x/y they were standing at) whenever the
 * client disconnected -- including immediately after a `request_interact`
 * combat-zone handoff had just been approved and had already persisted
 * the *correct* destination (the target combat zone id + an interior
 * point near its own return gate) via `updateCharacterRoomIntent`.
 *
 * Since the client legitimately calls `room.leave()` right after
 * receiving `town_combat_handoff_approved`, `onLeave` always ran a beat
 * later and clobbered the correct combat-zone position with a
 * nightmarket-scale one, which `CombatRoom`'s own join-time restoration
 * would then read back -- landing the player at nightmarket coordinates
 * that are numerically outside the combat zone's much smaller bounds.
 *
 * The fix: `onLeave` now skips its own persistence when the player's
 * presence carries an already-approved room handoff. This test proves
 * the fix by asserting `CharacterService.updateCharacterLocation` (the
 * method `onLeave` calls) is never invoked once a handoff has been
 * approved and the client leaves -- only `updateCharacterRoomIntent`
 * (the handoff's own persistence) fires, with the target combat zone's
 * interior entry position, not the player's stale in-room position.
 */
describe("TownRoom combat-handoff position persistence", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2581);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("does not let onLeave overwrite the just-approved combat-zone landing position", async () => {
    const client = await colyseus.sdk.joinOrCreate("town", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "nightmarket" as ZoneId,
    });

    const room = colyseus.getRoomById<TownRoomState>(client.roomId);
    const player = room.state.playerPresence.get(client.sessionId);
    expect(player).toBeDefined();
    if (player === undefined) {
      throw new Error("expected joined player to have a presence entry");
    }
    // Stand exactly on the Blackwire Gate (world 735, 560) so the
    // interact resolves immediately instead of queuing a move-closer.
    player.x = 735;
    player.y = 560;

    const interactMessage: RequestInteractClientMessage = {
      type: "request_interact",
      objectId: "nightmarket_blackwire_gate_01",
    };
    client.send("request_interact", interactMessage);

    const approved = await waitForMessage<TownCombatHandoffApprovedServerMessage>(
      client,
      "town_combat_handoff_approved",
    );
    expect(approved.targetZoneId).toBe("blackwire_sewers");

    // Mirrors the real client: it calls room.leave() right after
    // receiving the approval, without waiting for anything else.
    await client.leave();
    // Give onLeave's async persistence call a tick to run.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const constructedServices = vi.mocked(CharacterService).mock.results.map((result) => result.value);
    const roomIntentCalls = constructedServices.flatMap(
      (instance) => instance.updateCharacterRoomIntent.mock.calls,
    );
    const locationCalls = constructedServices.flatMap(
      (instance) => instance.updateCharacterLocation.mock.calls,
    );

    expect(roomIntentCalls).toHaveLength(1);
    const [, zoneId, x, y] = roomIntentCalls[0];
    expect(zoneId).toBe("blackwire_sewers");
    // The target combat zone's own interior entry point (COMBAT_SPAWN_BOX's
    // center), not a nightmarket-scale coordinate -- this is the exact
    // number the original bug got wrong.
    expect(x).toBe(138);
    expect(y).toBe(470);

    // The regression: onLeave must not have run its own overwrite.
    expect(locationCalls).toHaveLength(0);
  });
});
