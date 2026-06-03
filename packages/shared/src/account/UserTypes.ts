import type { IsoDateTimeString, UserId } from "../ids";

export type Username = string;
export type DisplayName = string;
export type AvatarKey = string;

export interface User {
  readonly id: UserId;
  readonly username: Username;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
}

export interface PublicUser {
  readonly id: UserId;
  readonly username: Username;
}