import type { AvatarKey, DisplayName, Username } from "./UserTypes";
import type { IsoDateTimeString, ProfileId, UserId } from "../ids";

export interface UserProfile {
  readonly id: ProfileId;
  readonly userId: UserId;
  readonly displayName: DisplayName;
  readonly avatarKey: AvatarKey;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
}

export interface PublicProfile {
  readonly userId: UserId;
  readonly username: Username;
  readonly displayName: DisplayName;
  readonly avatarKey: AvatarKey;
}