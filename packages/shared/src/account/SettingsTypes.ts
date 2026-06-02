import type { IsoDateTimeString, UserId } from "../ids";

export interface UserSettings {
  readonly userId: UserId;
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly showFpsCounter: boolean;
  readonly updatedAt: IsoDateTimeString;
}

export interface UpdateUserSettingsPayload {
  readonly masterVolume?: number;
  readonly musicVolume?: number;
  readonly sfxVolume?: number;
  readonly showFpsCounter?: boolean;
}