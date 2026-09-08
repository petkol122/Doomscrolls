import type { Prisma, PrismaClient } from "@prisma/client";
import { getSharedPrismaClient } from "../prisma";

type SettingsRepositoryClient = PrismaClient | Prisma.TransactionClient;

export interface UpdateSettingsData {
  readonly masterVolume?: number;
  readonly musicVolume?: number;
  readonly sfxVolume?: number;
  readonly showFpsCounter?: boolean;
}

export class SettingsRepository {
  public constructor(private readonly db: SettingsRepositoryClient = getSharedPrismaClient()) {}

  public createDefaultSettings(userId: string) {
    return this.db.userSettings.create({ data: { userId } });
  }

  public findByUserId(userId: string) {
    return this.db.userSettings.findUnique({ where: { userId } });
  }

  public updateSettings(userId: string, data: UpdateSettingsData) {
    return this.db.userSettings.update({ where: { userId }, data });
  }
}