import type { AvatarKey, ProfileId, PublicProfile, UserId, UserProfile } from "@doomscrolls/shared";
import type { User, UserProfile as PrismaUserProfile } from "@prisma/client";
import { requireString, toIsoDateTimeString } from "./dateMapper";

export function toUserProfileDto(profile: PrismaUserProfile): UserProfile {
  return {
    id: profile.id as ProfileId,
    userId: profile.userId as UserId,
    displayName: profile.displayName,
    avatarKey: requireString(profile.avatarKey, "UserProfile.avatarKey") as AvatarKey,
    createdAt: toIsoDateTimeString(profile.createdAt),
    updatedAt: toIsoDateTimeString(profile.updatedAt),
  };
}

export function toPublicProfileDto(profile: PrismaUserProfile & { user: Pick<User, "username"> }): PublicProfile {
  return {
    userId: profile.userId as UserId,
    username: profile.user.username,
    displayName: profile.displayName,
    avatarKey: requireString(profile.avatarKey, "UserProfile.avatarKey") as AvatarKey,
  };
}