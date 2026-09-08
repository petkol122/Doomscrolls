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
const TREADS_ITEM_ID = "test-item-sewer-treads";
const GLOVES_ITEM_ID = "test-item-wraptape-gloves";

// sewer_dweller (power 1, speed 2, mind 1, toughness 2) + gravewalker
// (power 3, speed 1, mind 2, toughness 3) = combined primary speed 3.
// Mirrors CharacterStatsService's own formulas exactly, rather than a
// hand-transcribed decimal, so floating-point results match bit-for-bit.
const BASE_MOVE_SPEED = 1 + 3 * 0.02;
const BASE_ATTACK_COOLDOWN_MS = Math.max(500, 1000 - 3 * 25);

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
    [
      TREADS_ITEM_ID,
      {
        id: TREADS_ITEM_ID,
        definitionId: "sewer_treads",
        ownerCharacterId: CHARACTER_ID,
        locationType: ItemLocationType.INVENTORY,
        inventoryPage: 0,
        inventoryX: 1,
        inventoryY: 0,
        equipmentSlot: null,
      },
    ],
    [
      GLOVES_ITEM_ID,
      {
        id: GLOVES_ITEM_ID,
        definitionId: "wraptape_gloves",
        ownerCharacterId: CHARACTER_ID,
        locationType: ItemLocationType.INVENTORY,
        inventoryPage: 0,
        inventoryX: 2,
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
    // Starter Pipe only modifies damage -- movementSpeed/attackCooldownMs
    // are pushed too (Core 0.31), but at their unmodified base values.
    expect(stats).toEqual({
      damage: 8,
      armor: 0,
      movementSpeed: BASE_MOVE_SPEED * 220,
      attackCooldownMs: BASE_ATTACK_COOLDOWN_MS,
    });
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
    expect(stats).toEqual({
      damage: 5,
      armor: 0,
      movementSpeed: BASE_MOVE_SPEED * 220,
      attackCooldownMs: BASE_ATTACK_COOLDOWN_MS,
    });
  });

  /**
   * Core 0.31 -- the movementSpeed/attackCooldownMs half of the same gap
   * Core 0.23's "Follow-up 2" fixed for damage/armor and explicitly named,
   * but left open, for these two fields. Real equipped items already
   * carry these modifiers (sewer_treads: moveSpeed +0.15; wraptape_gloves:
   * attackCooldownMs -40 -- see packages/content/src/data/items.ts).
   */
  it("pushes the new runtime movementSpeed (not the raw moveSpeed stat) into the live PlayerPresence on equip", async () => {
    const { db } = buildFakeDb();
    const service = new EquipmentService(db as never);

    await service.equip(CHARACTER_ID, USER_ID, TREADS_ITEM_ID, "feet");

    expect(updateConnectedPlayerLiveCombatStats).toHaveBeenCalledTimes(1);
    const [characterId, stats] = vi.mocked(updateConnectedPlayerLiveCombatStats).mock.calls[0]!;
    expect(characterId).toBe(CHARACTER_ID);
    // Base moveSpeed 1.06 + sewer_treads' +0.15 = 1.21 raw stat, then
    // converted through the same x220 world-units-per-second scale
    // TownRoom/CombatRoom apply at join (resolvePlayerMovementSpeed) --
    // not the raw 1.21 itself, which would be the exact unit-mismatch
    // bug this build's plan investigated and ruled out reintroducing.
    expect(stats.movementSpeed).toBe((BASE_MOVE_SPEED + 0.15) * 220);
    expect(stats.damage).toBe(5);
    expect(stats.armor).toBe(0);
    expect(stats.attackCooldownMs).toBe(BASE_ATTACK_COOLDOWN_MS);
  });

  it("pushes the new attackCooldownMs into the live PlayerPresence on equip", async () => {
    const { db } = buildFakeDb();
    const service = new EquipmentService(db as never);

    await service.equip(CHARACTER_ID, USER_ID, GLOVES_ITEM_ID, "hands");

    expect(updateConnectedPlayerLiveCombatStats).toHaveBeenCalledTimes(1);
    const [characterId, stats] = vi.mocked(updateConnectedPlayerLiveCombatStats).mock.calls[0]!;
    expect(characterId).toBe(CHARACTER_ID);
    // Base 925ms + wraptape_gloves' -40ms = 885ms, pushed as a direct
    // value (no unit conversion needed for this field, unlike moveSpeed).
    expect(stats.attackCooldownMs).toBe(BASE_ATTACK_COOLDOWN_MS - 40);
    expect(stats.damage).toBe(5);
    expect(stats.armor).toBe(0);
    expect(stats.movementSpeed).toBe(BASE_MOVE_SPEED * 220);
  });
});
