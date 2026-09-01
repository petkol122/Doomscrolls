import { type Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../prisma";

type ObjectiveRepositoryClient = PrismaClient | Prisma.TransactionClient;

/**
 * Repository for character-scoped persistent objective state.
 *
 * This is a targeted persistence layer for the single Nightmarket notice
 * board objective flow from Tasks 333A–333C. It is NOT a full quest journal
 * system; it supports only one objective per character at a time. Once a
 * proper quest manager is implemented, this repository should be replaced
 * or extended to support multiple concurrent objectives.
 */
export class ObjectiveRepository {
  public constructor(private readonly db: ObjectiveRepositoryClient = defaultPrisma) {}

  /**
   * Get the persisted objective state for a character + objective.
   * Returns `null` when no state exists (objective not yet started).
   */
  public async findByCharacterAndObjective(
    characterId: string,
    objectiveId: string,
  ): Promise<{
    readonly id: string;
    readonly characterId: string;
    readonly objectiveId: string;
    readonly currentProgress: number;
    readonly requiredProgress: number;
    readonly completed: boolean;
    readonly rewardGranted: boolean;
  } | null> {
    return this.db.characterObjective.findUnique({
      where: { characterId_objectiveId: { characterId, objectiveId } },
      select: {
        id: true,
        characterId: true,
        objectiveId: true,
        currentProgress: true,
        requiredProgress: true,
        completed: true,
        rewardGranted: true,
      },
    });
  }

  /**
   * Create (start) a new objective state record for a character.
   */
  public async create(
    characterId: string,
    objectiveId: string,
    requiredProgress: number,
  ): Promise<{
    readonly id: string;
    readonly characterId: string;
    readonly objectiveId: string;
    readonly currentProgress: number;
    readonly requiredProgress: number;
    readonly completed: boolean;
    readonly rewardGranted: boolean;
  }> {
    return this.db.characterObjective.create({
      data: {
        characterId,
        objectiveId,
        currentProgress: 0,
        requiredProgress,
        completed: false,
        rewardGranted: false,
      },
      select: {
        id: true,
        characterId: true,
        objectiveId: true,
        currentProgress: true,
        requiredProgress: true,
        completed: true,
        rewardGranted: true,
      },
    });
  }

  /**
   * Update the current progress value for an objective state record.
   * Clamps the new progress to `[0, requiredProgress]`.
   * Returns the updated record, or `null` if the record no longer exists.
   */
  public async updateProgress(
    characterId: string,
    objectiveId: string,
    newProgress: number,
  ): Promise<{
    readonly id: string;
    readonly currentProgress: number;
    readonly requiredProgress: number;
    readonly completed: boolean;
    readonly rewardGranted: boolean;
  } | null> {
    const existing = await this.db.characterObjective.findUnique({
      where: { characterId_objectiveId: { characterId, objectiveId } },
      select: { requiredProgress: true },
    });
    if (existing === null) {
      return null;
    }
    const clamped = Math.max(0, Math.min(existing.requiredProgress, Math.floor(newProgress)));
    const completed = clamped >= existing.requiredProgress;
    return this.db.characterObjective.update({
      where: { characterId_objectiveId: { characterId, objectiveId } },
      data: { currentProgress: clamped, completed },
      select: {
        id: true,
        currentProgress: true,
        requiredProgress: true,
        completed: true,
        rewardGranted: true,
      },
    });
  }

  /**
   * Mark the objective as completed (sets `completed = true`).
   * Returns the updated record, or `null` if the record no longer exists.
   */
  public async markCompleted(
    characterId: string,
    objectiveId: string,
  ): Promise<{
    readonly id: string;
    readonly currentProgress: number;
    readonly completed: boolean;
    readonly rewardGranted: boolean;
  } | null> {
    try {
      return this.db.characterObjective.update({
        where: { characterId_objectiveId: { characterId, objectiveId } },
        data: { completed: true },
        select: {
          id: true,
          currentProgress: true,
          completed: true,
          rewardGranted: true,
        },
      });
    } catch {
      return null;
    }
  }

  /**
   * Mark the reward as granted for an objective.
   * Sets `rewardGranted = true` and records `completedAt` if not already set.
   * Returns the updated record, or `null` if the record no longer exists.
   */
  public async markRewardGranted(
    characterId: string,
    objectiveId: string,
  ): Promise<{
    readonly id: string;
    readonly rewardGranted: boolean;
  } | null> {
    try {
      return this.db.characterObjective.update({
        where: { characterId_objectiveId: { characterId, objectiveId } },
        data: { rewardGranted: true },
        select: {
          id: true,
          rewardGranted: true,
        },
      });
    } catch {
      return null;
    }
  }

  /**
   * Find all completed-and-rewarded objectives for a character.
   * Returns objectives in NOTICE_BOARD_OBJECTIVE_SEQUENCE order for
   * display in the objective history / quest book.
   */
  public async findCompletedByCharacter(
    characterId: string,
  ): Promise<readonly {
    readonly objectiveId: string;
  }[]> {
    return this.db.characterObjective.findMany({
      where: { characterId, completed: true, rewardGranted: true },
      select: { objectiveId: true },
    });
  }
}
