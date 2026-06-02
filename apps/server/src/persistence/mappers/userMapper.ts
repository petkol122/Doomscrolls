import type { PublicUser, User, UserId } from "@doomscrolls/shared";
import type { User as PrismaUser } from "@prisma/client";
import { toIsoDateTimeString } from "./dateMapper";

export function toSafeUserDto(user: PrismaUser): User {
  return {
    id: user.id as UserId,
    username: user.username,
    createdAt: toIsoDateTimeString(user.createdAt),
    updatedAt: toIsoDateTimeString(user.updatedAt),
  };
}

export function toPublicUserDto(user: PrismaUser): PublicUser {
  return {
    id: user.id as UserId,
    username: user.username,
  };
}