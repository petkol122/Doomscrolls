import { contentRegistry as defaultContentRegistry, type ContentRegistry } from "@doomscrolls/content";
import {
  equipmentSlotToFlaskBeltSlot,
  type CharacterId,
  type EquipmentSlot,
  type EquipmentUpdatedServerMessage,
  type ItemDefinitionId,
  type ItemInstanceId,
  type UserId,
} from "@doomscrolls/shared";
import { ItemLocationType, type PrismaClient } from "@prisma/client";
import { getSharedPrismaClient } from "../persistence/prisma";
import { findFirstAvailableSlot, type PlacementItem } from "../realtime/rooms/itemGridPlacement";
import { ItemRepository } from "../persistence/repositories/ItemRepository";
import { InventoryRepository } from "../persistence/repositories/InventoryRepository";
import { CharacterRepository } from "../persistence/repositories/CharacterRepository";
import { EquipmentError, EquipmentErrorCode } from "./EquipmentErrors";
import { CharacterStatsService } from "./CharacterStatsService";
import {
  getConnectedPlayerPresence,
  sendToConnectedPlayer,
  updateConnectedPlayerLiveCombatStats,
} from "../realtime/rooms/connectedPlayerRegistry";
import { resolvePlayerMovementSpeed } from "../realtime/rooms/resolvePlayerMovementSpeed";
import { syncFlaskBeltSlotFromEquippedItem } from "../realtime/rooms/flaskBeltConfig";
import { buildEquipmentLoadout } from "./buildEquipmentLoadout";

interface InventorySlotCoordinates {
  readonly pageIndex: number;
  readonly x: number;
  readonly y: number;
}

export class EquipmentService {
  private readonly characterStatsService = new CharacterStatsService();

  public constructor(
    private readonly db: PrismaClient = getSharedPrismaClient(),
    private readonly content: ContentRegistry = defaultContentRegistry,
  ) {}

  /**
   * Finds the first inventory slot `targetSize` fits into without
   * overlapping any existing item's real footprint. Delegates to the
   * same rectangle-packing helper `moveInventoryItem.ts`/
   * `stashTransferItem.ts` use (`itemGridPlacement.ts`) -- this used to
   * be its own single-cell-only occupancy check (recording only each
   * existing item's origin cell, and never accounting for the size of
   * the item being placed), which let a multi-cell item like the 2x3
   * Sewer Jacket get placed on top of -- or itself be overlapped by --
   * a neighboring item.
   */
  private async findFirstFreeInventorySlot(
    inventory: { readonly pageCount: number; readonly gridWidth: number; readonly gridHeight: number },
    itemRepo: ItemRepository,
    characterId: string,
    targetSize: { readonly width: number; readonly height: number },
    excludedItemIds: readonly string[] = [],
  ): Promise<InventorySlotCoordinates> {
    const excludedItemIdSet = new Set(excludedItemIds);
    const allInventoryItems = await itemRepo.listInventoryItems(characterId);
    const otherItems: PlacementItem[] = allInventoryItems
      .filter((i) => !excludedItemIdSet.has(i.id))
      .map((i) => ({
        definitionId: i.definitionId as ItemDefinitionId,
        pageIndex: i.inventoryPage ?? null,
        x: i.inventoryX ?? null,
        y: i.inventoryY ?? null,
      }));

    const slot = findFirstAvailableSlot(
      { pageCount: inventory.pageCount, gridWidth: inventory.gridWidth, gridHeight: inventory.gridHeight },
      otherItems,
      targetSize,
    );
    if (slot === null) {
      throw new EquipmentError(EquipmentErrorCode.INVENTORY_FULL);
    }
    return slot;
  }

  /**
   * Equip an inventory item into a character's equipment slot.
   *
   * Validation flow:
   *  1. Item must exist and be owned by the character
   *  2. Item must be in inventory (not already equipped, not in loot, etc.)
   *  3. Item's definition must have allowedEquipmentSlots
   *  4. Requested slot must be in allowedEquipmentSlots
   *  5. If slot is occupied, the old item is moved to the first free inventory slot
   *  6. If inventory is full and a swap is needed, fail safely
   */
  public async equip(
    characterId: CharacterId | string,
    userId: UserId | string,
    itemInstanceId: ItemInstanceId | string,
    requestedSlot: EquipmentSlot,
  ): Promise<void> {
    const characterIdStr = characterId.toString();
    const userIdStr = userId.toString();

    // 1. Find the item by id and verify ownership
    const characterRepo = new CharacterRepository(this.db);
    const character = await characterRepo.findByIdForUser(characterIdStr, userIdStr);
    if (!character) {
      throw new EquipmentError(EquipmentErrorCode.ITEM_NOT_FOUND);
    }

    const itemRepo = new ItemRepository(this.db);
    const item = await itemRepo.findByIdForCharacter(itemInstanceId.toString(), characterIdStr);
    if (!item) {
      throw new EquipmentError(EquipmentErrorCode.ITEM_NOT_FOUND);
    }

    // 2. Verify item is in inventory
    if (item.locationType !== ItemLocationType.INVENTORY) {
      throw new EquipmentError(EquipmentErrorCode.ITEM_NOT_IN_INVENTORY);
    }

    // 3. Get item definition and check equipability
    const definition = this.content.items.get(item.definitionId as never);
    if (!definition || definition.allowedEquipmentSlots.length === 0) {
      throw new EquipmentError(EquipmentErrorCode.ITEM_NOT_EQUIPPABLE);
    }

    // 4. Verify requested slot is allowed
    if (!definition.allowedEquipmentSlots.includes(requestedSlot)) {
      throw new EquipmentError(EquipmentErrorCode.SLOT_MISMATCH);
    }

    // 5. Perform the equip (and slot swap if needed) in a transaction
    await this.db.$transaction(async (tx) => {
      const txItemRepo = new ItemRepository(tx);
      const txCharacterRepo = new CharacterRepository(tx);

      // Check if slot is currently occupied
      const equippedItems = await txItemRepo.listEquippedItems(characterIdStr);
      const existingItemInSlot = equippedItems.find(
        (e) => e.equipmentSlot === requestedSlot,
      );

      const inventoryRepo = new InventoryRepository(tx);
      const inventory = await inventoryRepo.findByCharacterId(characterIdStr);
      if (!inventory) {
        throw new EquipmentError(EquipmentErrorCode.INTERNAL_ERROR);
      }

      if (existingItemInSlot) {
        // Slot occupied -- need to move old item back to inventory first
        const existingItemDefinition = this.content.items.get(existingItemInSlot.definitionId as never);
        if (!existingItemDefinition) {
          throw new EquipmentError(EquipmentErrorCode.INTERNAL_ERROR);
        }
        const freeSlot = await this.findFirstFreeInventorySlot(
          inventory,
          txItemRepo,
          characterIdStr,
          existingItemDefinition.size,
          [item.id],
        );

        // Move old equipped item to inventory
        await txItemRepo.updateItemLocation(existingItemInSlot.id, {
          locationType: ItemLocationType.INVENTORY,
          ownerCharacterId: characterIdStr,
          inventoryPage: freeSlot.pageIndex,
          inventoryX: freeSlot.x,
          inventoryY: freeSlot.y,
          equipmentSlot: null,
          roomId: null,
          zoneId: null,
          positionX: null,
          positionY: null,
          corpseId: null,
        });
      }

      // Equip the requested item (clear its inventory coordinates, set equipment slot)
      await txItemRepo.updateItemLocation(item.id, {
        locationType: ItemLocationType.EQUIPMENT,
        ownerCharacterId: characterIdStr,
        equipmentSlot: requestedSlot,
        inventoryPage: null,
        inventoryX: null,
        inventoryY: null,
        roomId: null,
        zoneId: null,
        positionX: null,
        positionY: null,
        corpseId: null,
      });

      await this.recalculateEquippedCharacterStats(characterIdStr, txItemRepo, txCharacterRepo);
    });

    this.syncLiveFlaskBeltSlot(characterIdStr, requestedSlot, definition.useEffect);
    await this.notifyEquipmentUpdated(characterIdStr);
  }

  public async unequip(
    characterId: CharacterId | string,
    userId: UserId | string,
    requestedSlot: EquipmentSlot,
  ): Promise<void> {
    const characterIdStr = characterId.toString();
    const userIdStr = userId.toString();

    const characterRepo = new CharacterRepository(this.db);
    const character = await characterRepo.findByIdForUser(characterIdStr, userIdStr);
    if (!character) {
      throw new EquipmentError(EquipmentErrorCode.ITEM_NOT_FOUND);
    }

    await this.db.$transaction(async (tx) => {
      const txItemRepo = new ItemRepository(tx);
      const txCharacterRepo = new CharacterRepository(tx);
      const equippedItems = await txItemRepo.listEquippedItems(characterIdStr);
      const itemInSlot = equippedItems.find((item) => item.equipmentSlot === requestedSlot);

      const inventoryRepo = new InventoryRepository(tx);
      const inventory = await inventoryRepo.findByCharacterId(characterIdStr);
      if (!inventory) {
        throw new EquipmentError(EquipmentErrorCode.INTERNAL_ERROR);
      }

      if (!itemInSlot) {
        throw new EquipmentError(EquipmentErrorCode.ITEM_NOT_FOUND);
      }

      if (itemInSlot.locationType !== ItemLocationType.EQUIPMENT) {
        throw new EquipmentError(EquipmentErrorCode.ITEM_NOT_FOUND);
      }

      const itemDefinition = this.content.items.get(itemInSlot.definitionId as never);
      if (!itemDefinition) {
        throw new EquipmentError(EquipmentErrorCode.INTERNAL_ERROR);
      }

      const freeSlot = await this.findFirstFreeInventorySlot(inventory, txItemRepo, characterIdStr, itemDefinition.size);

      await txItemRepo.updateItemLocation(itemInSlot.id, {
        locationType: ItemLocationType.INVENTORY,
        ownerCharacterId: characterIdStr,
        inventoryPage: freeSlot.pageIndex,
        inventoryX: freeSlot.x,
        inventoryY: freeSlot.y,
        equipmentSlot: null,
        roomId: null,
        zoneId: null,
        positionX: null,
        positionY: null,
        corpseId: null,
      });

      await this.recalculateEquippedCharacterStats(characterIdStr, txItemRepo, txCharacterRepo);
    });

    this.syncLiveFlaskBeltSlot(characterIdStr, requestedSlot, undefined);
    await this.notifyEquipmentUpdated(characterIdStr);
  }

  /**
   * Milestone 0.3 -- 4-Slot Flask Belt. When the just-equipped/unequipped
   * slot is one of `flask_1`..`flask_4`, re-derives that belt slot's max
   * charges/effect on the character's live `PlayerPresence` (if
   * connected) straight from the item now occupying it -- `useEffect`
   * undefined means "empty" (unequip, or an item with no use effect).
   * A freshly equipped flask always starts full; this only ever runs on
   * an equip/unequip transition, never on a reconnect (join already
   * restores persisted charges via `syncFlaskBeltFromEquipment`).
   */
  private syncLiveFlaskBeltSlot(
    characterId: string,
    slot: EquipmentSlot,
    useEffect: { readonly type: string; readonly value: number; readonly charges: number } | undefined,
  ): void {
    const flaskSlot = equipmentSlotToFlaskBeltSlot(slot);
    if (flaskSlot === undefined) {
      return;
    }
    const presence = getConnectedPlayerPresence(characterId);
    if (presence === undefined) {
      return;
    }
    syncFlaskBeltSlotFromEquippedItem(presence, flaskSlot, useEffect);
  }

  private async notifyEquipmentUpdated(characterId: string): Promise<void> {
    const loadout = await buildEquipmentLoadout(characterId, this.db);
    const message: EquipmentUpdatedServerMessage = {
      type: "equipment_updated",
      equipment: loadout,
    };
    sendToConnectedPlayer(characterId, "equipment_updated", message);
  }

  private async recalculateEquippedCharacterStats(
    characterId: string,
    itemRepo: ItemRepository,
    characterRepo: CharacterRepository,
  ): Promise<void> {
    const character = await characterRepo.findProgressionContext(characterId);
    if (!character) {
      throw new EquipmentError(EquipmentErrorCode.INTERNAL_ERROR);
    }

    const origin = this.content.origins.get(character.originId as never);
    const characterClass = this.content.classes.get(character.classId as never);
    if (!origin || !characterClass) {
      throw new EquipmentError(EquipmentErrorCode.INTERNAL_ERROR);
    }

    const equippedItems = await itemRepo.listEquippedItems(characterId);
    const modifiers = equippedItems.flatMap((equippedItem) => {
      const definition = this.content.items.get(equippedItem.definitionId as ItemDefinitionId);
      return definition?.statModifiers ?? [];
    });

    const recalculatedStats = this.characterStatsService.calculateEquippedStats(
      this.characterStatsService.calculateLevelScaledStats(origin.baseStats, characterClass.baseStats, character.level).primary,
      modifiers,
      character.level,
    );

    await characterRepo.updateStats(characterId, {
      ...recalculatedStats.primary,
      ...recalculatedStats.derived,
    });

    // The database write above is necessary but not sufficient: if this
    // character is currently connected to a room, combat/movement reads
    // player.damage/.armor/.movementSpeed/.attackCooldownMs directly off
    // the live synced PlayerPresence, not the database, so that live copy
    // must be pushed too or it stays stale (old weapon's damage, old
    // armor's mitigation, old boots' move speed, old gloves' attack
    // cadence) until the player leaves and rejoins the room. Core 0.23
    // fixed this for damage/armor only; movementSpeed/attackCooldownMs
    // had the identical gap, named but left open at the time (see
    // docs/CORE_BUILD_0_23_RELEASE_NOTES.md's Follow-up 2) -- closed here
    // (Core 0.31).
    //
    // attackCooldownMs is a direct value, pushed exactly like damage/armor
    // (no resolve-with-fallback wrapper: recalculatedStats is a freshly
    // computed, always-finite number, not a possibly-corrupt DB read, so
    // resolveAttackCooldownMs's NaN/undefined guard would be a no-op here
    // -- same reasoning damage/armor already relied on by skipping
    // resolvePlayerDamage/resolvePlayerArmor).
    //
    // movementSpeed is NOT a direct value -- PlayerPresence.movementSpeed
    // is the *converted* runtime world-units-per-second value, not the
    // raw moveSpeed stat, so it must go through the same
    // resolvePlayerMovementSpeed conversion TownRoom/CombatRoom already
    // apply at join (unrelated to `toWorldUnits`'s separate x24
    // tile-to-pixel scalar used for enemy aggro/leash ranges -- conflating
    // the two was the exact bug Core 0.24 found and fixed for enemy
    // moveSpeed; player moveSpeed was never subject to it, since it has
    // only ever gone through resolvePlayerMovementSpeed).
    updateConnectedPlayerLiveCombatStats(characterId, {
      damage: recalculatedStats.derived.damage,
      armor: recalculatedStats.derived.armor,
      movementSpeed: resolvePlayerMovementSpeed(recalculatedStats.derived.moveSpeed),
      attackCooldownMs: recalculatedStats.derived.attackCooldownMs,
    });
  }
}