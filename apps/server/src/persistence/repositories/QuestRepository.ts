import { type Prisma, type PrismaClient, QuestStatus } from "@prisma/client";
import { getSharedPrismaClient } from "../prisma";

type QuestRepositoryClient = PrismaClient | Prisma.TransactionClient;

export type PersistedQuestState = {
  readonly questId: string;
  readonly status: QuestStatus;
};

/**
 * Core 0.1 — Persistent Quest & Dialogue System foundation. One row per
 * (character, quest); status survives scene restarts and rejoins.
 * Mirrors {@link ObjectiveRepository}'s shape and conventions.
 */
export class QuestRepository {
  public constructor(private readonly db: QuestRepositoryClient = getSharedPrismaClient()) {}

  public async findByCharacter(characterId: string): Promise<readonly PersistedQuestState[]> {
    return this.db.characterQuest.findMany({
      where: { characterId },
      select: { questId: true, status: true },
    });
  }

  public async findOne(characterId: string, questId: string): Promise<PersistedQuestState | null> {
    return this.db.characterQuest.findUnique({
      where: { characterId_questId: { characterId, questId } },
      select: { questId: true, status: true },
    });
  }

  public async accept(characterId: string, questId: string): Promise<PersistedQuestState> {
    return this.db.characterQuest.create({
      data: { characterId, questId, status: QuestStatus.ACCEPTED },
      select: { questId: true, status: true },
    });
  }

  public async complete(characterId: string, questId: string): Promise<PersistedQuestState | null> {
    try {
      return await this.db.characterQuest.update({
        where: { characterId_questId: { characterId, questId } },
        data: { status: QuestStatus.COMPLETED, completedAt: new Date() },
        select: { questId: true, status: true },
      });
    } catch {
      return null;
    }
  }
}
