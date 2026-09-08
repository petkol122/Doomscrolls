import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { EquipmentUpdatedServerMessage, ZoneId } from "@doomscrolls/shared";
import { createTestRealtimeServer } from "../support/testRealtimeServer";
import { waitForMessage } from "../support/waitForMessage";
import { TEST_CHARACTER_ID, TEST_USER_ID } from "../support/fixtures";

/**
 * Regression for the "equipment_updated is never sent" bug found during
 * Core 0.23's icon integration: the client's equipment panel (labels, and
 * 0.23's icons) is fed exclusively by this message, and a client that
 * reconnects or enters the world with gear already equipped from a
 * previous session would otherwise see every slot as empty until its next
 * equip/unequip in that session -- see `EquipmentService`'s
 * `notifyEquipmentUpdated` (fired after equip/unequip; covered by
 * `test/character/equipmentService.test.ts`) and `buildEquipmentLoadout`,
 * which both `TownRoom.onJoin` and `CombatRoom.onJoin` also call directly.
 *
 * These tests only prove the room sends the message with the right shape
 * on join (the equipped-item-mapping itself is unit-tested separately
 * against a fake db in `equipmentService.test.ts`, avoiding a dependency
 * on real equipped-item rows existing for the shared DB-backed fixture
 * character).
 */
describe("equipment_updated on room join", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await createTestRealtimeServer(2586);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("TownRoom sends equipment_updated on join", async () => {
    const client = await colyseus.sdk.joinOrCreate("town", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
    });

    const message = await waitForMessage<EquipmentUpdatedServerMessage>(client, "equipment_updated");

    expect(message.type).toBe("equipment_updated");
    expect(message.equipment).toMatchObject({
      weapon: null,
      head: null,
      chest: null,
      hands: null,
      feet: null,
      ring_1: null,
      amulet: null,
      belt: null,
      flask_1: null,
    });
  });

  it("CombatRoom sends equipment_updated on join", async () => {
    const client = await colyseus.sdk.joinOrCreate("combat", {
      userId: TEST_USER_ID,
      characterId: TEST_CHARACTER_ID,
      requestedZoneId: "blackwire_sewers" as ZoneId,
    });

    const message = await waitForMessage<EquipmentUpdatedServerMessage>(client, "equipment_updated");

    expect(message.type).toBe("equipment_updated");
    expect(message.equipment).toMatchObject({
      weapon: null,
      head: null,
      chest: null,
      hands: null,
      feet: null,
      ring_1: null,
      amulet: null,
      belt: null,
      flask_1: null,
    });
  });
});
