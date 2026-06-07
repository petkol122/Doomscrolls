import { ItemLocationType, type Character, type CharacterPassive, type CharacterStats, type Inventory, type Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../prisma";

type CharacterRepositoryClient = PrismaClient | Prisma.TransactionClient;

export interface CreateCharacterStatsData {
  readonly power: number;
  readonly speed: number;
  readonly mind: number;
  readonly toughness: number;
  readonly maxHp: number;
  readonly damage: number;
  readonly armor: number;
  readonly moveSpeed: number;
  readonly attackCooldownMs: number;
}

export interface CreateCharacterPassiveData {
  readonly passiveId: string;
  readonly sourceType: string;
  readonly sourceId?: string | null;
}

export interface CreateCharacterInventoryData {
  readonly pageCount: number;
  readonly gridWidth: number;
  readonly gridHeight: number;
}

export interface CreateCharacterWithInitialStateData {
  readonly userId: string;
  readonly characterName: string;
  readonly characterNameNormalized: string;
  readonly originId: string;
  readonly classId: string;
  readonly currentZoneId: string;
  readonly currentHp: number;
  readonly stats: CreateCharacterStatsData;
  readonly passives: readonly CreateCharacterPassiveData[];
  readonly inventory: CreateCharacterInventoryData;
}

const characterWithInitialStateInclude = { stats: true, passives: true, inventory: true } satisfies Prisma.CharacterInclude;

const characterAccountStateInclude = {
  stats: true,
  inventory: true,
  items: {
    where: { locationType: ItemLocationType.INVENTORY },
    orderBy: [{ inventoryPage: "asc" }, { inventoryY: "asc" }, { inventoryX: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.CharacterInclude;

export type CharacterWithInitialState = Prisma.CharacterGetPayload<{
  include: typeof characterWithInitialStateInclude;
}>;

export type CharacterForAccountState = Prisma.CharacterGetPayload<{
  include: typeof characterAccountStateInclude;
}>;

export interface CharacterProgressionContext {
  readonly id: string;
  readonly level: number;
  readonly currentHp: number;
  readonly originId: string;
  readonly classId: string;
}

export class CharacterRepository {
  public constructor(private readonly db: CharacterRepositoryClient = defaultPrisma) {}

  public findByIdForUser(characterId: string, userId: string) {
    return this.db.character.findFirst({
      where: { id: characterId, userId },
      include: { stats: true, passives: true, inventory: true },
    });
  }

  public listByUserId(userId: string) {
    return this.db.character.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  public listByUserIdForAccountState(userId: string): Promise<readonly CharacterForAccountState[]> {
    return this.db.character.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: characterAccountStateInclude,
    });
  }

  public findByUserIdAndNormalizedName(userId: string, characterNameNormalized: string) {
    return this.db.character.findUnique({
      where: { userId_characterNameNormalized: { userId, characterNameNormalized } },
    });
  }

  public createCharacterWithInitialState(data: CreateCharacterWithInitialStateData): Promise<CharacterWithInitialState> {
    const createCharacter = (tx: Prisma.TransactionClient) =>
      tx.character.create({
        data: {
          userId: data.userId,
          characterName: data.characterName,
          characterNameNormalized: data.characterNameNormalized,
          originId: data.originId,
          classId: data.classId,
          currentZoneId: data.currentZoneId,
          currentHp: data.currentHp,
          stats: { create: data.stats },
          passives: {
            create: data.passives.map((passive) => ({
              passiveId: passive.passiveId,
              sourceType: passive.sourceType,
              sourceId: passive.sourceId ?? null,
            })),
          },
          inventory: { create: data.inventory },
        },
        include: characterWithInitialStateInclude,
      });

    if ("$transaction" in this.db) {
      return this.db.$transaction(createCharacter);
    }

    return createCharacter(this.db);
  }

  public updateCurrentZone(characterId: string, zoneId: string) {
    return this.db.character.update({ where: { id: characterId }, data: { currentZoneId: zoneId } });
  }

  public updateCurrentHp(characterId: string, currentHp: number) {
    return this.db.character.update({ where: { id: characterId }, data: { currentHp } });
  }

  public updateStats(
    characterId: string,
    stats: CreateCharacterStatsData,
  ) {
    return this.db.characterStats.update({
      where: { characterId },
      data: {
        power: stats.power,
        speed: stats.speed,
        mind: stats.mind,
        toughness: stats.toughness,
        maxHp: stats.maxHp,
        damage: stats.damage,
        armor: stats.armor,
        moveSpeed: stats.moveSpeed,
        attackCooldownMs: stats.attackCooldownMs,
      },
    });
  }

  public updateXpAndLevel(characterId: string, xp: number, level: number) {
    return this.db.character.update({ where: { id: characterId }, data: { xp, level } });
  }

  public findProgressionContext(characterId: string): Promise<CharacterProgressionContext | null> {
    return this.db.character.findUnique({
      where: { id: characterId },
      select: {
        id: true,
        level: true,
        currentHp: true,
        originId: true,
        classId: true,
      },
    });
  }

  public updateProgressionState(
    characterId: string,
    input: {
      readonly xp: number;
      readonly level: number;
      readonly currentHp: number;
      readonly stats: CreateCharacterStatsData;
    },
  ) {
    return this.db.character.update({
      where: { id: characterId },
      data: {
        xp: input.xp,
        level: input.level,
        currentHp: input.currentHp,
        stats: {
          update: {
            power: input.stats.power,
            speed: input.stats.speed,
            mind: input.stats.mind,
            toughness: input.stats.toughness,
            maxHp: input.stats.maxHp,
            damage: input.stats.damage,
            armor: input.stats.armor,
            moveSpeed: input.stats.moveSpeed,
            attackCooldownMs: input.stats.attackCooldownMs,
          },
        },
      },
    });
  }

  public updateCharacterLocation(
    characterId: string,
    lastLocationZoneId: string,
    lastLocationX: number,
    lastLocationY: number,
    currentHp?: number,
  ) {
    return this.db.character.update({
      where: { id: characterId },
      data: {
        lastLocationZoneId,
        lastLocationX,
        lastLocationY,
        ...(currentHp !== undefined ? { currentHp } : {}),
      },
    });
  }
}