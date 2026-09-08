import { SessionStatus, type Prisma, type PrismaClient } from "@prisma/client";
import { getSharedPrismaClient } from "../prisma";

type SessionRepositoryClient = PrismaClient | Prisma.TransactionClient;

export interface CreateSessionData {
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export class SessionRepository {
  public constructor(private readonly db: SessionRepositoryClient = getSharedPrismaClient()) {}

  public createSession(data: CreateSessionData) {
    return this.db.session.create({
      data: {
        ...data,
        status: SessionStatus.ACTIVE,
      },
    });
  }

  public findActiveByTokenHash(tokenHash: string, now: Date = new Date()) {
    return this.db.session.findFirst({
      where: {
        tokenHash,
        status: SessionStatus.ACTIVE,
        expiresAt: { gt: now },
      },
      include: { user: true },
    });
  }

  public revokeSession(sessionId: string, revokedAt: Date = new Date()) {
    return this.db.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.REVOKED,
        revokedAt,
      },
    });
  }

  public revokeAllForUser(userId: string, revokedAt: Date = new Date()) {
    return this.db.session.updateMany({
      where: {
        userId,
        status: SessionStatus.ACTIVE,
      },
      data: {
        status: SessionStatus.REVOKED,
        revokedAt,
      },
    });
  }

  public deleteExpiredSessions(now: Date) {
    return this.db.session.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });
  }
}