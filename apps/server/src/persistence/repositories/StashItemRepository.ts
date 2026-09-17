import type { Prisma, PrismaClient } from "@prisma/client";
import { getSharedPrismaClient } from "../prisma";

type StashItemRepositoryClient = PrismaClient | Prisma.TransactionClient;

/**
 * Milestone 0.2 — Account Stash Foundation. Persistence for the
 * account-wide (userId-keyed) `StashItem` table -- separate from
 * `ItemRepository`, which owns the per-character `ItemInstance` table.
 */
export class StashItemRepository {
  public constructor(private readonly db: StashItemRepositoryClient = getSharedPrismaClient()) {}

  public listByUserId(userId: string) {
    return this.db.stashItem.findMany({
      where: { userId },
      orderBy: { slotIndex: "asc" },
    });
  }

  public findByIdForUser(stashItemId: string, userId: string) {
    return this.db.stashItem.findFirst({
      where: { id: stashItemId, userId },
    });
  }

  public findByUserIdAndDefinitionId(userId: string, definitionId: string) {
    return this.db.stashItem.findUnique({
      where: { userId_definitionId: { userId, definitionId } },
    });
  }

  public async nextSlotIndex(userId: string): Promise<number> {
    const top = await this.db.stashItem.findFirst({
      where: { userId },
      orderBy: { slotIndex: "desc" },
      select: { slotIndex: true },
    });
    return (top?.slotIndex ?? -1) + 1;
  }

  public create(data: { readonly userId: string; readonly definitionId: string; readonly quantity: number; readonly slotIndex: number }) {
    return this.db.stashItem.create({ data });
  }

  public updateQuantity(stashItemId: string, quantity: number) {
    return this.db.stashItem.update({ where: { id: stashItemId }, data: { quantity } });
  }

  public delete(stashItemId: string) {
    return this.db.stashItem.delete({ where: { id: stashItemId } });
  }
}
