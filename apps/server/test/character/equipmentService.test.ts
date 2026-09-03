import { beforeEach, describe, expect, it, vi } from "vitest";
import { ItemLocationType } from "@prisma/client";
import { EquipmentService } from "../../src/character/EquipmentService";

/**
 * Regression coverage for the missing `equipment_updated` broadcast
 * (found during Core 0.23's icon integration): equip/unequip mutate the
 * database correctly via HTTP routes, but the client's equipment panel
 * (icons + labels) is fed exclusively by a room message the server never
 * sent, so a real equip never rendered as equipped in that panel even
 * though the underlying mechanic worked.
 *
 * `EquipmentService` runs entirely outside any Colyseus room (it's called
 * from `equipment.routes.ts`), so it must reach the player's live room
 * session through `connectedPlayerRegistry.sendToConnectedPlayer` instead
 * of a room's own `client.send`. That's the seam this test asserts.
 */
vi.mock("../../src/realtime/rooms/connectedPlayerRegistry", () => ({
  sendToConnectedPlayer: vi.fn(),
}));

import { sendToConnectedPlayer } from "../../src/realtime/rooms/connectedPlayerRegistry";

const CHARACTER_ID = "test-character-equip";
const USER_ID = "test-user-equip";
const WEAPON_ITEM_ID = "test-item-starter-pipe";

interface FakeItemRow {
  id: string;
  definitionId: string;
  ownerCharacterId: string;
  locationType: ItemLocationType;
  inventoryPage: number | null;
  inventoryX: number | null;
  inventoryY: number | null;
  equipmentSlot: string | null;
}

function buildFakeDb() {
  const items = new Map<string, FakeItemRow>([
    [
      WEAPON_ITEM_ID,
      {
        id: WEAPON_ITEM_ID,
        definitionId: "starter_pipe",
        ownerCharacterId: CHARACTER_ID,
        locationType: ItemLocationType.INVENTORY,
        inventoryPage: 0,
        inventoryX: 0,
        inventoryY: 0,
        equipmentSlot: null,
      },
    ],
  ]);

  const characterStats = {
    characterId: CHARACTER_ID,
    power: 5,
    speed: 5,
    mind: 5,
    toughness: 5,
    maxHp: 120,
    damage: 12,
    armor: 4,
    moveSpeed: 5,
    attackCooldownMs: 550,
  };

  const db = {
    character: {
      findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
        where.id === CHARACTER_ID && where.userId === USER_ID ? { id: CHARACTER_ID, userId: USER_ID } : null,
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === CHARACTER_ID
          ? {
              id: CHARACTER_ID,
              level: 3,
              currentHp: 80,
              currentFlaskCharges: 3,
              originId: "sewer_dweller",
              classId: "gravewalker",
            }
          : null,
    },
    characterStats: {
      update: async ({ data }: { data: Record<string, number> }) => {
        Object.assign(characterStats, data);
        return characterStats;
      },
    },
    inventory: {
      findUnique: async ({ where }: { where: { characterId: string } }) =>
        where.characterId === CHARACTER_ID ? { characterId: CHARACTER_ID, pageCount: 1, gridWidth: 10, gridHeight: 6 } : null,
    },
    itemInstance: {
      findFirst: async ({ where }: { where: { id: string; ownerCharacterId: string } }) => {
        const item = items.get(where.id);
        return item !== undefined && item.ownerCharacterId === where.ownerCharacterId ? item : null;
      },
      findMany: async ({ where }: { where: { ownerCharacterId: string; locationType: ItemLocationType } }) =>
        [...items.values()].filter(
          (item) => item.ownerCharacterId === where.ownerCharacterId && item.locationType === where.locationType,
        ),
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeItemRow> }) => {
        const item = items.get(where.id);
        if (item === undefined) {
          throw new Error(`item not found: ${where.id}`);
        }
        Object.assign(item, data);
        return item;
      },
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
  };

  return { db, items };
}

describe("EquipmentService equipment_updated broadcast", () => {
  beforeEach(() => {
    vi.mocked(sendToConnectedPlayer).mockClear();
  });

  it("sends equipment_updated with the item in its slot after equip", async () => {
    const { db } = buildFakeDb();
    const service = new EquipmentService(db as never);

    await service.equip(CHARACTER_ID, USER_ID, WEAPON_ITEM_ID, "weapon");

    expect(sendToConnectedPlayer).toHaveBeenCalledTimes(1);
    const [characterId, type, message] = vi.mocked(sendToConnectedPlayer).mock.calls[0]!;
    expect(characterId).toBe(CHARACTER_ID);
    expect(type).toBe("equipment_updated");
    expect(message).toEqual({
      type: "equipment_updated",
      equipment: {
        weapon: WEAPON_ITEM_ID,
        head: null,
        chest: null,
        hands: null,
        feet: null,
        ring_1: null,
        amulet: null,
        belt: null,
        flask_1: null,
      },
    });
  });

  it("sends equipment_updated with the slot cleared after unequip", async () => {
    const { db, items } = buildFakeDb();
    // Pre-equip the item directly in the fake store so unequip has something to clear.
    const weapon = items.get(WEAPON_ITEM_ID)!;
    weapon.locationType = ItemLocationType.EQUIPMENT;
    weapon.equipmentSlot = "weapon";
    weapon.inventoryPage = null;
    weapon.inventoryX = null;
    weapon.inventoryY = null;

    const service = new EquipmentService(db as never);

    await service.unequip(CHARACTER_ID, USER_ID, "weapon");

    expect(sendToConnectedPlayer).toHaveBeenCalledTimes(1);
    const [characterId, type, message] = vi.mocked(sendToConnectedPlayer).mock.calls[0]!;
    expect(characterId).toBe(CHARACTER_ID);
    expect(type).toBe("equipment_updated");
    expect(message).toEqual({
      type: "equipment_updated",
      equipment: {
        weapon: null,
        head: null,
        chest: null,
        hands: null,
        feet: null,
        ring_1: null,
        amulet: null,
        belt: null,
        flask_1: null,
      },
    });
  });
});
