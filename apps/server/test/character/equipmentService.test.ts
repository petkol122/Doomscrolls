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
 * Also covers the follow-on regression found asking "does this actually
 * change combat, not just the panel?": `recalculateEquippedCharacterStats`
 * wrote the new damage/armor to the database only, so a mid-session
 * equip/unequip left the player's *live* `PlayerPresence.damage`/`.armor`
 * (what combat actually reads) stale until they left and rejoined the
 * room.
 *
 * `EquipmentService` runs entirely outside any Colyseus room (it's called
 * from `equipment.routes.ts`), so it must reach the player's live room
 * session through `connectedPlayerRegistry` instead of a room's own
 * `client.send` / direct state mutation. That's the seam both sets of
 * tests below assert.
 */
vi.mock("../../src/realtime/rooms/connectedPlayerRegistry", () => ({
  sendToConnectedPlayer: vi.fn(),
  updateConnectedPlayerLiveCombatStats: vi.fn(),
}));

import { sendToConnectedPlayer, updateConnectedPlayerLiveCombatStats } from "../../src/realtime/rooms/connectedPlayerRegistry";

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

  return { db, items, characterStats };
}

describe("EquipmentService equipment_updated broadcast", () => {
  beforeEach(() => {
    vi.mocked(sendToConnectedPlayer).mockClear();
    vi.mocked(updateConnectedPlayerLiveCombatStats).mockClear();
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

describe("EquipmentService live combat stats", () => {
  beforeEach(() => {
    vi.mocked(sendToConnectedPlayer).mockClear();
    vi.mocked(updateConnectedPlayerLiveCombatStats).mockClear();
  });

  it("pushes the new weapon's damage into the live PlayerPresence on equip, not just the database", async () => {
    const { db, characterStats } = buildFakeDb();
    const service = new EquipmentService(db as never);

    await service.equip(CHARACTER_ID, USER_ID, WEAPON_ITEM_ID, "weapon");

    // Sanity check the database side actually changed too (base damage
    // 1 + power 4 = 5, +3 from the equipped Starter Pipe = 8).
    expect(characterStats.damage).toBe(8);

    expect(updateConnectedPlayerLiveCombatStats).toHaveBeenCalledTimes(1);
    const [characterId, stats] = vi.mocked(updateConnectedPlayerLiveCombatStats).mock.calls[0]!;
    expect(characterId).toBe(CHARACTER_ID);
    expect(stats).toEqual({ damage: 8, armor: 0 });
  });

  it("pushes damage back down into the live PlayerPresence on unequip", async () => {
    const { db, items } = buildFakeDb();
    const weapon = items.get(WEAPON_ITEM_ID)!;
    weapon.locationType = ItemLocationType.EQUIPMENT;
    weapon.equipmentSlot = "weapon";
    weapon.inventoryPage = null;
    weapon.inventoryX = null;
    weapon.inventoryY = null;

    const service = new EquipmentService(db as never);

    await service.unequip(CHARACTER_ID, USER_ID, "weapon");

    expect(updateConnectedPlayerLiveCombatStats).toHaveBeenCalledTimes(1);
    const [characterId, stats] = vi.mocked(updateConnectedPlayerLiveCombatStats).mock.calls[0]!;
    expect(characterId).toBe(CHARACTER_ID);
    // Base damage only (1 + power 4), the Starter Pipe's +3 no longer applies.
    expect(stats).toEqual({ damage: 5, armor: 0 });
  });
});
