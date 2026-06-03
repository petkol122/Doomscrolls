import type { DisplayName, User } from "./UserTypes";
import type { PublicProfile } from "./ProfileTypes";
import type { UserSettings } from "./SettingsTypes";
import type { IsoDateTimeString, SessionId, SessionToken, UserId } from "../ids";

export interface RegisterPayload {
  readonly username: string;
  readonly password: string;
  readonly displayName: DisplayName;
  readonly avatarKey: string;
}

export interface LoginPayload {
  readonly username: string;
  readonly password: string;
}

export interface AuthSession {
  readonly id: SessionId;
  readonly userId: UserId;
  readonly token: SessionToken;
  readonly expiresAt: IsoDateTimeString;
  readonly createdAt: IsoDateTimeString;
}

export interface AuthResult {
  readonly user: User;
  readonly profile: PublicProfile;
  readonly settings: UserSettings;
  readonly session: AuthSession;
}