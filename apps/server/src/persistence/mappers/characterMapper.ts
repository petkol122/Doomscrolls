import type {
  CharacterClassKey,
  CharacterDeathState,
  CharacterDetails,
  CharacterId,
  CharacterSummary,
  CharacterStats,
  OriginKey,
  PassiveKey,
  UserId,
  ZoneId,
} from "@doomscrolls/shared";
import type { Character, CharacterPassive, CharacterStats as PrismaCharacterStats, Inventory } from "@prisma/client";
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
    createdAt: toIsoDateTimeString(character.createdAt),
    updatedAt: toIsoDateTimeString(character.updatedAt),
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
  };
}