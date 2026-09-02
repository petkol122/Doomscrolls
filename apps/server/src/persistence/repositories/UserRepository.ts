import type { Prisma, PrismaClient } from "@prisma/client";
import { getSharedPrismaClient } from "../prisma";

type UserRepositoryClient = PrismaClient | Prisma.TransactionClient;

export interface CreateUserData {
  readonly username: string;
  readonly usernameNormalized: string;
  readonly passwordHash: string;
}

export class UserRepository {
  public constructor(private readonly db: UserRepositoryClient = getSharedPrismaClient()) {}

  public findById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }

  public findByUsernameNormalized(usernameNormalized: string) {
    return this.db.user.findUnique({ where: { usernameNormalized } });
  }

  public async existsByUsernameNormalized(usernameNormalized: string): Promise<boolean> {
    const count = await this.db.user.count({ where: { usernameNormalized } });
    return count > 0;
  }

  public createUser(data: CreateUserData) {
    return this.db.user.create({ data });
  }

  public updateLastSeen(userId: string, lastSeenAt: Date = new Date()) {
    return this.db.user.update({ where: { id: userId }, data: { lastSeenAt } });
  }
}