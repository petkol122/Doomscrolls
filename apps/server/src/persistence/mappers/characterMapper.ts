import type {
  CharacterClassKey,
  CharacterDeathState,
  CharacterDetails,
  CharacterId,
  CharacterSummary,
  CharacterStats,
  EquipmentSlot,
  EquippedItemSummary,
  InventorySummaryItem,
  ItemDefinitionId,
  ItemInstanceId,
  OriginKey,
  PassiveKey,
  UserId,
  ZoneId,
} from "@doomscrolls/shared";
import { t } from "@doomscrolls/localization";
import { contentRegistry } from "@doomscrolls/content";
import type { Character, CharacterPassive, CharacterStats as PrismaCharacterStats, Inventory, ItemInstance } from "@prisma/client";
import { ItemRepository } from "../repositories/ItemRepository";
import { prisma as defaultPrisma } from "../prisma";
import { toIsoDateTimeString } from "./dateMapper";

export function toCharacterStatsDto(character: Pick<Character, "currentHp">, stats: PrismaCharacterStats): CharacterStats {
  return {
    primary: {
      power: stats.power,
      speed: stats.speed,
      mind: stats.mind,
      toughness: stats.toughness,
    },
    derived: {
      maxHp: stats.maxHp,
      damage: stats.damage,
      armor: stats.armor,
      moveSpeed: stats.moveSpeed,
      attackCooldownMs: stats.attackCooldownMs,
    },
    currentHp: character.currentHp,
  };
}

export function toCharacterSummaryDto(character: Character): CharacterSummary {
  return {
    id: character.id as CharacterId,
    ownerUserId: character.userId as UserId,
    characterName: character.characterName,
    originKey: character.originId as OriginKey,
    classKey: character.classId as CharacterClassKey,
    level: character.level,
    xp: character.xp,
    currentZoneId: character.currentZoneId as ZoneId,
    moneyCopper: character.moneyCopper,
    createdAt: toIsoDateTimeString(character.createdAt),
    updatedAt: toIsoDateTimeString(character.updatedAt),
  };
}

export async function toCharacterSummaryWithInventoryDto(
  character: Character & { stats: PrismaCharacterStats | null; inventory: Inventory | null; items: readonly ItemInstance[] },
  itemRepository: ItemRepository = new ItemRepository(defaultPrisma),
): Promise<CharacterSummary> {
  const inventorySummaryItems: InventorySummaryItem[] = [];

  if (character.inventory !== null) {
    for (const item of character.items) {
      if (item.inventoryPage === null || item.inventoryX === null || item.inventoryY === null) {
        continue;
      }

      const definition = contentRegistry.items.get(item.definitionId as never);
      if (definition === undefined) {
        continue;
      }

      inventorySummaryItems.push({
        itemInstanceId: item.id as never,
        definitionId: definition.id,
        pageIndex: item.inventoryPage,
        x: item.inventoryX,
        y: item.inventoryY,
        label: t(definition.nameKey),
        category: definition.category,
        rarity: definition.rarity,
        allowedEquipmentSlots: definition.allowedEquipmentSlots,
        size: {
          width: definition.size.width,
          height: definition.size.height,
        },
        statModifiers: definition.statModifiers,
      });
    }
  }

  const equippedItems = await buildEquippedItemSummaries(character.id, itemRepository);

  return {
    ...toCharacterSummaryDto(character),
    ...(character.stats !== null ? { stats: toCharacterStatsDto(character, character.stats) } : {}),
    inventorySummaryItems,
    equippedItems,
  };
}

export async function buildEquippedItemSummaries(
  characterId: string,
  itemRepository: ItemRepository = new ItemRepository(defaultPrisma),
): Promise<readonly EquippedItemSummary[]> {
  const equippedRows = await itemRepository.listEquippedItems(characterId);
  const summaries: EquippedItemSummary[] = [];

  for (const item of equippedRows) {
    if (item.equipmentSlot === null) {
      continue;
    }

    const definition = contentRegistry.items.get(item.definitionId as never);
    if (definition === undefined) {
      continue;
    }

    summaries.push({
      itemInstanceId: item.id as ItemInstanceId,
      definitionId: definition.id as ItemDefinitionId,
      slot: item.equipmentSlot as EquipmentSlot,
      label: t(definition.nameKey),
      category: definition.category,
      rarity: definition.rarity,
      statModifiers: definition.statModifiers,
    });
  }

  return summaries;
}

export function toCharacterDetailsDto(
  character: Character & { stats: PrismaCharacterStats; passives: readonly CharacterPassive[]; inventory: Inventory; items?: readonly ItemInstance[] },
  deathState: CharacterDeathState,
): CharacterDetails {
  const inventorySummaryItems: InventorySummaryItem[] = [];

  if (character.items !== undefined) {
    for (const item of character.items) {
      if (item.inventoryPage === null || item.inventoryX === null || item.inventoryY === null) {
        continue;
      }

      const definition = contentRegistry.items.get(item.definitionId as never);
      if (definition === undefined) {
        continue;
      }

      inventorySummaryItems.push({
        itemInstanceId: item.id as never,
        definitionId: definition.id,
        pageIndex: item.inventoryPage,
        x: item.inventoryX,
        y: item.inventoryY,
        label: t(definition.nameKey),
        category: definition.category,
        rarity: definition.rarity,
        allowedEquipmentSlots: definition.allowedEquipmentSlots,
        size: {
          width: definition.size.width,
          height: definition.size.height,
        },
        statModifiers: definition.statModifiers,
      });
    }
  }

  return {
    ...toCharacterSummaryDto(character),
    passiveKeys: character.passives.map((passive) => passive.passiveId as PassiveKey),
    stats: toCharacterStatsDto(character, character.stats),
    inventory: {
      characterId: character.id as CharacterId,
      config: {
        pageCount: character.inventory.pageCount,
        gridWidth: character.inventory.gridWidth,
        gridHeight: character.inventory.gridHeight,
      },
      items: inventorySummaryItems,
    },
    deathState,
    ...(character.lastLocationZoneId !== null
      ? { lastLocationZoneId: character.lastLocationZoneId as ZoneId }
      : {}),
    ...(character.lastLocationX !== null ? { lastLocationX: character.lastLocationX } : {}),
    ...(character.lastLocationY !== null ? { lastLocationY: character.lastLocationY } : {}),
  };
}
