import { CorpseStatus, type Prisma, type PrismaClient } from "@prisma/client";
import { getSharedPrismaClient } from "../prisma";

type CorpseRepositoryClient = PrismaClient | Prisma.TransactionClient;

export interface CreateCorpseData {
  readonly characterId: string;
  readonly zoneId: string;
  readonly roomId?: string;
  readonly positionX: number;
  readonly positionY: number;
}

export interface MarkCorpseRecoveredData {
  readonly recoveredAt?: Date;
  readonly forcedRecovery?: boolean;
}

export class CorpseRepository {
  public constructor(private readonly db: CorpseRepositoryClient = getSharedPrismaClient()) {}

  public createCorpse(data: CreateCorpseData) {
    return this.db.corpse.create({ data });
  }

  public findActiveByCharacterId(characterId: string) {
    return this.db.corpse.findFirst({
      where: {
        characterId,
        status: CorpseStatus.ACTIVE,
      },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
  }

  public findByIdForCharacter(corpseId: string, characterId: string) {
    return this.db.corpse.findFirst({
      where: {
        id: corpseId,
        characterId,
      },
      include: { items: true },
    });
  }

  public markRecovered(corpseId: string, data: MarkCorpseRecoveredData = {}) {
    return this.db.corpse.update({
      where: { id: corpseId },
      data: {
        status: CorpseStatus.RECOVERED,
        recoveredAt: data.recoveredAt ?? new Date(),
        forcedRecovery: data.forcedRecovery ?? false,
      },
    });
  }
}