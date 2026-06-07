import type {
  CharacterClassKey,
  CharacterDeathState,
  CharacterDetails,
  CharacterId,
  CharacterSummary,
  CharacterStats,
  InventorySummaryItem,
  OriginKey,
  PassiveKey,
  UserId,
  ZoneId,
} from "@doomscrolls/shared";
import { t } from "@doomscrolls/localization";
import { contentRegistry } from "@doomscrolls/content";
import type { Character, CharacterPassive, CharacterStats as PrismaCharacterStats, Inventory, ItemInstance } from "@prisma/client";
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

export function toCharacterSummaryWithInventoryDto(
  character: Character & { stats: PrismaCharacterStats | null; inventory: Inventory | null; items: readonly ItemInstance[] },
): CharacterSummary {
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

  return {
    ...toCharacterSummaryDto(character),
    ...(character.stats !== null ? { stats: toCharacterStatsDto(character, character.stats) } : {}),
    inventorySummaryItems,
  };
}

export function toCharacterDetailsDto(
  character: Character & { stats: PrismaCharacterStats; passives: readonly CharacterPassive[]; inventory: Inventory },
  deathState: CharacterDeathState,
): CharacterDetails {
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
      items: [],
    },
    deathState,
    ...(character.lastLocationZoneId !== null
      ? { lastLocationZoneId: character.lastLocationZoneId as ZoneId }
      : {}),
    ...(character.lastLocationX !== null ? { lastLocationX: character.lastLocationX } : {}),
    ...(character.lastLocationY !== null ? { lastLocationY: character.lastLocationY } : {}),
  };
}