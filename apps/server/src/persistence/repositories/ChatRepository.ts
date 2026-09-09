import { type Prisma, type PrismaClient } from "@prisma/client";
import { getSharedPrismaClient } from "../prisma";

type ChatRepositoryClient = PrismaClient | Prisma.TransactionClient;

export interface CreateChatMessageData {
  readonly channel: string;
  readonly characterId: string;
  readonly displayName: string;
  readonly text: string;
}

export interface ChatMessageHistoryEntry {
  readonly displayName: string;
  readonly text: string;
  readonly sentAt: number;
}

/**
 * Persists global chat history and serves it back on join (see
 * `globalChatHandler.ts`'s `sendGlobalChatHistory`, called from
 * `TownRoom.onJoin` / `CombatRoom.onJoin`) so a player who logs back in
 * sees the recent conversation instead of an empty log. The server is
 * the sole writer -- a message is only ever logged after
 * `globalChatHandler.ts` accepts it (shape, length, and rate-limit
 * checks already passed).
 */
export class ChatRepository {
  public constructor(private readonly db: ChatRepositoryClient = getSharedPrismaClient()) {}

  public async create(data: CreateChatMessageData): Promise<void> {
    await this.db.chatMessage.create({
      data: {
        channel: data.channel,
        characterId: data.characterId,
        displayName: data.displayName,
        text: data.text,
      },
    });
  }

  /**
   * Most recent `limit` messages for a channel, oldest first (the
   * order a chat log renders in). Fetched newest-first from the
   * database (so `LIMIT` keeps the most recent ones) and reversed.
   */
  public async findRecentByChannel(
    channel: string,
    limit: number,
  ): Promise<readonly ChatMessageHistoryEntry[]> {
    const rows = await this.db.chatMessage.findMany({
      where: { channel },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { displayName: true, text: true, createdAt: true },
    });

    return rows
      .map((row) => ({
        displayName: row.displayName,
        text: row.text,
        sentAt: row.createdAt.getTime(),
      }))
      .reverse();
  }
}
