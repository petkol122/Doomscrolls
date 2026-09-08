import type { Prisma, PrismaClient } from "@prisma/client";
import { getSharedPrismaClient } from "../prisma";

type ProfileRepositoryClient = PrismaClient | Prisma.TransactionClient;

export interface CreateProfileData {
  readonly userId: string;
  readonly displayName: string;
  readonly avatarKey: string;
}

export interface UpdateProfileData {
  readonly displayName?: string;
  readonly avatarKey?: string;
}

export class ProfileRepository {
  public constructor(private readonly db: ProfileRepositoryClient = getSharedPrismaClient()) {}

  public createProfile(data: CreateProfileData) {
    return this.db.userProfile.create({ data });
  }

  public findByUserId(userId: string) {
    return this.db.userProfile.findUnique({ where: { userId } });
  }

  public updateProfile(userId: string, data: UpdateProfileData) {
    return this.db.userProfile.update({ where: { userId }, data });
  }
}