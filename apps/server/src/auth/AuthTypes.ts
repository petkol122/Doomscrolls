import type { AuthResult, AuthSession, CharacterSummary, RegisterPayload } from "@doomscrolls/shared";

/**
 * Input type for the register method.
 * Extends RegisterPayload but makes avatarKey optional with a default.
 */
export interface RegisterInput {
  readonly username: string;
  readonly password: string;
  readonly displayName: string;
  readonly avatarKey?: string;
}

/**
 * Input type for the login method.
 */
export interface LoginInput {
  readonly username: string;
  readonly password: string;
}

/**
 * Username validation result.
 */
export interface UsernameValidationResult {
  readonly valid: boolean;
  readonly normalized: string;
  readonly error?: string;
}

/**
 * Display name validation result.
 */
export interface DisplayNameValidationResult {
  readonly valid: boolean;
  readonly trimmed: string;
  readonly error?: string;
}

/**
 * Password validation result.
 */
export interface PasswordValidationResult {
  readonly valid: boolean;
  readonly error?: string;
}

/**
 * Safe account state returned by getAccountStateFromToken.
 * Excludes sensitive fields like passwordHash.
 */
export interface AccountState {
  readonly user: AuthResult["user"];
  readonly profile: AuthResult["profile"];
  readonly settings: AuthResult["settings"];
  readonly characters: readonly CharacterSummary[];
}

/**
 * Extended AuthResult with characters for account state.
 * This extends the shared AuthResult to include character summaries.
 */
export interface ExtendedAuthResult extends AuthResult {
  readonly characters: readonly CharacterSummary[];
}

/**
 * Character summary for auth response.
 * Uses the shared CharacterSummary type from @doomscrolls/shared.
 */

/**
 * Safe auth response DTO.
 * Excludes passwordHash and raw session tokens from being stored.
 */
export interface SafeAuthResponse {
  readonly user: AuthResult["user"];
  readonly profile: AuthResult["profile"];
  readonly settings: AuthResult["settings"];
  readonly session: AuthSession;
  readonly characters: readonly CharacterSummary[];
}

/**
 * Configuration for auth service.
 */
export interface AuthServiceConfig {
  readonly sessionExpiryDays: number;
  readonly defaultAvatarKey: string;
}

/**
 * Default auth service configuration.
 * Session expiry: 30 days
 */
export const DEFAULT_AUTH_CONFIG: AuthServiceConfig = {
  sessionExpiryDays: 30,
  defaultAvatarKey: "default",
};