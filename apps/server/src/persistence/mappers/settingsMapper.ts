import type { UserId, UserSettings } from "@doomscrolls/shared";
import type { UserSettings as PrismaUserSettings } from "@prisma/client";
import { toIsoDateTimeString } from "./dateMapper";

export function toUserSettingsDto(settings: PrismaUserSettings): UserSettings {
  return {
    userId: settings.userId as UserId,
    masterVolume: settings.masterVolume,
    musicVolume: settings.musicVolume,
    sfxVolume: settings.sfxVolume,
    showFpsCounter: settings.showFpsCounter,
    updatedAt: toIsoDateTimeString(settings.updatedAt),
  };
}