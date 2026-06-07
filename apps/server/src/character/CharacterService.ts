import type { ContentRegistry } from "@doomscrolls/content";
import { contentRegistry as defaultContentRegistry } from "@doomscrolls/content";
import type { CharacterDetails, CharacterId, UserId } from "@doomscrolls/shared";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrismaClient } from "../persistence/prisma";
import { CharacterRepository } from "../persistence/repositories/CharacterRepository";
import { toCharacterDetailsDto, toCharacterSummaryDto } from "../persistence/mappers/characterMapper";
import { CharacterError, CharacterErrorCode } from "./CharacterErrors";
import { CharacterNameService } from "./CharacterNameService";
import { CharacterStatsService } from "./CharacterStatsService";
import {
  DEFAULT_CHARACTER_SERVICE_CONFIG,
  type CharacterServiceConfig,
  type CreateCharacterInput,
  type CreateCharacterResult,
  type ListCharactersResult,
} from "./CharacterTypes";

function isPrismaUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Temporary pre-death-system baseline: character creation and generic detail reads report
// persisted characters as alive until the dedicated death/corpse service owns this state.
const ALIVE_DEATH_STATE = { lifeState: "alive" } as const;

export class CharacterService {
  private readonly characterNameService: CharacterNameService;
  private readonly characterStatsService: CharacterStatsService;
  private readonly config: CharacterServiceConfig;

  public constructor(
    private readonly db: PrismaClient = defaultPrismaClient,
    private readonly content: ContentRegistry = defaultContentRegistry,
    config: Partial<CharacterServiceConfig> = {},
  ) {
    this.characterNameService = new CharacterNameService();
    this.characterStatsService = new CharacterStatsService();
    this.config = { ...DEFAULT_CHARACTER_SERVICE_CONFIG, ...config };
  }

  public async listCharacters(userId: UserId | string): Promise<ListCharactersResult> {
    const characterRepository = new CharacterRepository(this.db);
    const characters = await characterRepository.listByUserId(userId.toString());

    return characters.map(toCharacterSummaryDto);
  }

  public async getCharacterForUser(characterId: CharacterId | string, userId: UserId | string): Promise<CharacterDetails> {
    const characterRepository = new CharacterRepository(this.db);
    const character = await characterRepository.findByIdForUser(characterId.toString(), userId.toString());

    if (!character?.stats || !character.inventory) {
      throw new CharacterError(CharacterErrorCode.CHARACTER_NOT_FOUND);
    }

    return toCharacterDetailsDto({ ...character, stats: character.stats, inventory: character.inventory }, ALIVE_DEATH_STATE);
  }

  public async createCharacter(userId: UserId | string, input: CreateCharacterInput): Promise<CreateCharacterResult> {
    const nameValidation = this.characterNameService.validateCharacterName(input.characterName);
    if (!nameValidation.valid) {
      throw new CharacterError(CharacterErrorCode.INVALID_CHARACTER_NAME, nameValidation.error);
    }

    const origin = this.content.origins.get(input.originId);
    if (!origin) {
      throw new CharacterError(CharacterErrorCode.INVALID_ORIGIN);
    }

    const characterClass = this.content.classes.get(input.classId);
    if (!characterClass) {
      throw new CharacterError(CharacterErrorCode.INVALID_CLASS);
    }

    if (!origin.allowedClassIds.includes(characterClass.id)) {
      throw new CharacterError(CharacterErrorCode.ORIGIN_CLASS_NOT_ALLOWED);
    }

    const startingStats = this.characterStatsService.calculateStartingStats(origin.baseStats, characterClass.baseStats);
    const userIdString = userId.toString();

    const characterRepository = new CharacterRepository(this.db);
    const existingCharacter = await characterRepository.findByUserIdAndNormalizedName(userIdString, nameValidation.normalized);
    if (existingCharacter) {
      throw new CharacterError(CharacterErrorCode.CHARACTER_NAME_TAKEN);
    }

    try {
      const character = await characterRepository.createCharacterWithInitialState({
        userId: userIdString,
        characterName: nameValidation.characterName,
        characterNameNormalized: nameValidation.normalized,
        originId: origin.id,
        classId: characterClass.id,
        currentZoneId: origin.startingZoneId,
        currentHp: startingStats.derived.maxHp,
        stats: {
          ...startingStats.primary,
          ...startingStats.derived,
        },
        passives: origin.passiveIds.map((passiveId) => ({
          passiveId,
          sourceType: "origin",
          sourceId: origin.id,
        })),
        inventory: {
          pageCount: this.config.inventoryPageCount,
          gridWidth: this.config.inventoryGridWidth,
          gridHeight: this.config.inventoryGridHeight,
        },
      });

      if (!character.stats || !character.inventory) {
        throw new CharacterError(CharacterErrorCode.INTERNAL_ERROR);
      }

      return toCharacterDetailsDto({ ...character, stats: character.stats, inventory: character.inventory }, ALIVE_DEATH_STATE);
    } catch (error: unknown) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new CharacterError(CharacterErrorCode.CHARACTER_NAME_TAKEN);
      }

      if (error instanceof CharacterError) {
        throw error;
      }

      throw new CharacterError(CharacterErrorCode.INTERNAL_ERROR);
    }
  }

  public async updateCharacterLocation(
    characterId: CharacterId | string,
    zoneId: string,
    x: number,
    y: number,
    currentHp?: number,
  ): Promise<void> {
    try {
      const characterRepository = new CharacterRepository(this.db);
      await characterRepository.updateCharacterLocation(characterId.toString(), zoneId, x, y, currentHp);
    } catch (error: unknown) {
      if (error instanceof CharacterError) {
        throw error;
      }
      throw new CharacterError(CharacterErrorCode.INTERNAL_ERROR);
    }
  }
}