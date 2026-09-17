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
  StatModifier,
  UserId,
  ZoneId,
} from "@doomscrolls/shared";
import { buildCharacterWallet, buildMaterialBalances, parseMaterialBalancesJson, parseProfessionsJson, parseRolledAffixes, parseWalletBalancesJson, rolledAffixToStatModifier } from "@doomscrolls/shared";
import { t } from "@doomscrolls/localization";
import { contentRegistry, type ItemContentDefinition } from "@doomscrolls/content";
import { calculatePlayerNetWorth } from "../../character/calculatePlayerNetWorth";
import type { Character, CharacterPassive, CharacterStats as PrismaCharacterStats, Inventory, ItemInstance } from "@prisma/client";
import { ItemRepository } from "../repositories/ItemRepository";
import { getSharedPrismaClient } from "../prisma";
import { toIsoDateTimeString } from "./dateMapper";

/**
 * Milestone 0.3 -- Server-Authoritative Item Rarity & Random Affix
 * Engine. Merges an item instance's rolled tier/affixes (persisted on
 * the DB row, see `affixRollEngine.ts`) with its definition's fixed
 * base rarity/statModifiers. A "normal" (0-affix) instance is
 * indistinguishable from the old fixed-rarity behavior; magic/rare/
 * legendary override the displayed rarity and append rolled stat
 * modifiers on top of the base ones.
 */
function resolveInstanceRarityAndStats(
  item: Pick<ItemInstance, "rarityTier" | "rolledAffixes">,
  definition: ItemContentDefinition,
): { readonly rarity: string; readonly statModifiers: readonly StatModifier[]; readonly affixNames: readonly string[] } {
  const rolledAffixes = parseRolledAffixes(item.rolledAffixes);
  const rarity = item.rarityTier.length > 0 && item.rarityTier !== "normal" ? item.rarityTier : definition.rarity;
  const statModifiers = rolledAffixes.length === 0
    ? definition.statModifiers
    : [...definition.statModifiers, ...rolledAffixes.map(rolledAffixToStatModifier)];
  const affixNames = rolledAffixes.map((affix) => t(affix.nameKey as never));
  return { rarity, statModifiers, affixNames };
}

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
    // `walletBalancesJson` is declared on the Prisma schema but read via an index
    // signature here so this compiles even before the generated Prisma client is
    // refreshed for the new column (`npx prisma generate`).
    wallet: buildCharacterWallet(
      character.moneyCopper,
      parseWalletBalancesJson((character as unknown as { walletBalancesJson?: string }).walletBalancesJson),
    ),
    // `materialBalancesJson` is declared on the Prisma schema but read via an
    // index signature here for the same reason `walletBalancesJson` is above.
    materialBalances: buildMaterialBalances(
      parseMaterialBalancesJson((character as unknown as { materialBalancesJson?: string }).materialBalancesJson),
    ),
    createdAt: toIsoDateTimeString(character.createdAt),
    updatedAt: toIsoDateTimeString(character.updatedAt),
  };
}

export async function toCharacterSummaryWithInventoryDto(
  character: Character & { stats: PrismaCharacterStats | null; inventory: Inventory | null; items: readonly ItemInstance[] },
  itemRepository: ItemRepository = new ItemRepository(getSharedPrismaClient()),
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

      const { rarity, statModifiers, affixNames } = resolveInstanceRarityAndStats(item, definition);
      inventorySummaryItems.push({
        itemInstanceId: item.id as never,
        definitionId: definition.id,
        pageIndex: item.inventoryPage,
        x: item.inventoryX,
        y: item.inventoryY,
        label: t(definition.nameKey),
        category: definition.category,
        rarity,
        allowedEquipmentSlots: definition.allowedEquipmentSlots,
        size: {
          width: definition.size.width,
          height: definition.size.height,
        },
        statModifiers,
        quantity: item.quantity,
        ...(affixNames.length > 0 ? { affixNames } : {}),
      });
    }
  }

  const equippedItems = await buildEquippedItemSummaries(character.id, itemRepository);
  const summary = toCharacterSummaryDto(character);

  return {
    ...summary,
    ...(character.stats !== null ? { stats: toCharacterStatsDto(character, character.stats) } : {}),
    inventorySummaryItems,
    equippedItems,
    netWorth: calculatePlayerNetWorth(summary.wallet, equippedItems),
    professions: parseProfessionsJson((character as unknown as { professionsJson?: string }).professionsJson),
  };
}

export async function buildEquippedItemSummaries(
  characterId: string,
  itemRepository: ItemRepository = new ItemRepository(getSharedPrismaClient()),
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

    const { rarity, statModifiers, affixNames } = resolveInstanceRarityAndStats(item, definition);
    summaries.push({
      itemInstanceId: item.id as ItemInstanceId,
      definitionId: definition.id as ItemDefinitionId,
      slot: item.equipmentSlot as EquipmentSlot,
      label: t(definition.nameKey),
      category: definition.category,
      rarity,
      statModifiers,
      ...(affixNames.length > 0 ? { affixNames } : {}),
    });
  }

  return summaries;
}

export async function toCharacterDetailsDto(
  character: Character & { stats: PrismaCharacterStats; passives: readonly CharacterPassive[]; inventory: Inventory; items?: readonly ItemInstance[] },
  deathState: CharacterDeathState,
  itemRepository: ItemRepository = new ItemRepository(getSharedPrismaClient()),
): Promise<CharacterDetails> {
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

      const { rarity, statModifiers, affixNames } = resolveInstanceRarityAndStats(item, definition);
      inventorySummaryItems.push({
        itemInstanceId: item.id as never,
        definitionId: definition.id,
        pageIndex: item.inventoryPage,
        x: item.inventoryX,
        y: item.inventoryY,
        label: t(definition.nameKey),
        category: definition.category,
        rarity,
        allowedEquipmentSlots: definition.allowedEquipmentSlots,
        size: {
          width: definition.size.width,
          height: definition.size.height,
        },
        statModifiers,
        quantity: item.quantity,
        ...(affixNames.length > 0 ? { affixNames } : {}),
      });
    }
  }

  const equippedItems = await buildEquippedItemSummaries(character.id, itemRepository);
  const summary = toCharacterSummaryDto(character);

  return {
    ...summary,
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
    equippedItems,
    netWorth: calculatePlayerNetWorth(summary.wallet, equippedItems),
    deathState,
    ...(character.lastLocationZoneId !== null
      ? { lastLocationZoneId: character.lastLocationZoneId as ZoneId }
      : {}),
    ...(character.lastLocationX !== null ? { lastLocationX: character.lastLocationX } : {}),
    ...(character.lastLocationY !== null ? { lastLocationY: character.lastLocationY } : {}),
    skillPoints: character.skillPoints,
    primarySkillRank: character.primarySkillRank,
    secondarySkillRank: character.secondarySkillRank,
    tertiarySkillRank: character.tertiarySkillRank,
    // `professionsJson` is declared on the Prisma schema but read via an index
    // signature here for the same reason `walletBalancesJson` is above.
    professions: parseProfessionsJson((character as unknown as { professionsJson?: string }).professionsJson),
  };
}
