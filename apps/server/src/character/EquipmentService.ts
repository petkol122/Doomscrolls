import { contentRegistry as defaultContentRegistry, type ContentRegistry } from "@doomscrolls/content";
import {
  type CharacterId,
  type EquipmentSlot,
  type ItemDefinitionId,
  type ItemInstanceId,
  type UserId,
} from "@doomscrolls/shared";
import { ItemLocationType, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrismaClient } from "../persistence/prisma";
import { ItemRepository } from "../persistence/repositories/ItemRepository";
import { InventoryRepository } from "../persistence/repositories/InventoryRepository";
import { CharacterRepository } from "../persistence/repositories/CharacterRepository";
import { EquipmentError, EquipmentErrorCode } from "./EquipmentErrors";
import { CharacterStatsService } from "./CharacterStatsService";

interface InventorySlotCoordinates {
  readonly pageIndex: number;
  readonly x: number;
  readonly y: number;
}

export class EquipmentService {
  private readonly characterStatsService = new CharacterStatsService();

  public constructor(
    private readonly db: PrismaClient = defaultPrismaClient,
    private readonly content: ContentRegistry = defaultContentRegistry,
  ) {}

  private async findFirstFreeInventorySlot(
    inventory: { readonly pageCount: number; readonly gridWidth: number; readonly gridHeight: number },
    itemRepo: ItemRepository,
    characterId: string,
    excludedItemIds: readonly string[] = [],
  ): Promise<InventorySlotCoordinates> {
    const excludedItemIdSet = new Set(excludedItemIds);
    const allInventoryItems = await itemRepo.listInventoryItems(characterId);
    const occupiedPositions = new Set(
      allInventoryItems
        .filter((i) => !excludedItemIdSet.has(i.id))
        .map((i) => `${i.inventoryPage}_${i.inventoryX}_${i.inventoryY}`),
    );

    for (let pageIndex = 0; pageIndex < inventory.pageCount; pageIndex++) {
      for (let y = 0; y < inventory.gridHeight; y++) {
        for (let x = 0; x < inventory.gridWidth; x++) {
          if (!occupiedPositions.has(`${pageIndex}_${x}_${y}`)) {
            return { pageIndex, x, y };
          }
        }
      }
    }

    throw new EquipmentError(EquipmentErrorCode.INVENTORY_FULL);
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
        const freeSlot = await this.findFirstFreeInventorySlot(inventory, txItemRepo, characterIdStr, [item.id]);

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

      const freeSlot = await this.findFirstFreeInventorySlot(inventory, txItemRepo, characterIdStr);

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
  }
}