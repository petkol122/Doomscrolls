import type { Prisma, PrismaClient } from "@prisma/client";
import { getSharedPrismaClient } from "../prisma";

type InventoryRepositoryClient = PrismaClient | Prisma.TransactionClient;

export interface CreateInventoryConfig {
  readonly pageCount: number;
  readonly gridWidth: number;
  readonly gridHeight: number;
}

export class InventoryRepository {
  public constructor(private readonly db: InventoryRepositoryClient = getSharedPrismaClient()) {}

  public findByCharacterId(characterId: string) {
    return this.db.inventory.findUnique({ where: { characterId } });
  }

  public createInventory(characterId: string, config: CreateInventoryConfig) {
    return this.db.inventory.create({
      data: {
        characterId,
        ...config,
      },
    });
  }
}