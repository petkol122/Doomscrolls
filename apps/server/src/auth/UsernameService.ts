import { AuthErrorCode, AuthError } from "./AuthErrors";
import type { UsernameValidationResult } from "./AuthTypes";

/**
 * Reserved usernames that cannot be registered.
 * Checked case-insensitively.
 */
const RESERVED_USERNAMES: readonly string[] = [
  "admin",
  "administrator",
  "moderator",
  "mod",
  "support",
  "staff",
  "system",
  "root",
  "api",
  "auth",
  "login",
  "register",
  "me",
  "profile",
  "settings",
  "doomscrolls",
  "moloch",
];

/**
 * Regex for valid username characters: a-z, 0-9, underscore, dot.
 * Must start with a letter or number.
 */
const USERNAME_REGEX = /^[a-z0-9][a-z0-9._]*$/;

/**
 * Username validation and normalization service.
 */
export class UsernameService {
  /**
   * Normalize a username for uniqueness comparison.
   * - Converts to lowercase
   * - Trims whitespace
   */
  public normalizeUsername(input: string): string {
    return input.toLowerCase().trim();
  }

  /**
   * Validate a username according to Core 0.1 rules:
   * - min length: 3
   * - max length: 24
   * - allowed characters: a-z, 0-9, underscore, dot
   * - must start with a letter or number
   * - no spaces
   * - no consecutive dots
   * - no leading/trailing dot
   * - case-insensitive unique through usernameNormalized
   * - reserved names blocked case-insensitively
   */
  public validateUsername(input: string): UsernameValidationResult {
    const trimmed = input.trim();

    // Check length
    if (trimmed.length < 3) {
      return {
        valid: false,
        normalized: "",
        error: "Username must be at least 3 characters long",
      };
    }

    if (trimmed.length > 24) {
      return {
        valid: false,
        normalized: "",
        error: "Username must be at most 24 characters long",
      };
    }

    // Check for spaces
    if (trimmed.includes(" ")) {
      return {
        valid: false,
        normalized: "",
        error: "Username cannot contain spaces",
      };
    }

    // Check leading/trailing dot
    if (trimmed.startsWith(".") || trimmed.endsWith(".")) {
      return {
        valid: false,
        normalized: "",
        error: "Username cannot start or end with a dot",
      };
    }

    // Check consecutive dots
    if (trimmed.includes("..")) {
      return {
        valid: false,
        normalized: "",
        error: "Username cannot contain consecutive dots",
      };
    }

    // Check valid characters and format
    const normalized = this.normalizeUsername(trimmed);
    if (!USERNAME_REGEX.test(normalized)) {
      return {
        valid: false,
        normalized: "",
        error: "Username can only contain letters, numbers, underscores, and dots",
      };
    }

    // Check reserved names
    if (RESERVED_USERNAMES.includes(normalized)) {
      return {
        valid: false,
        normalized: "",
        error: "This username is reserved",
      };
    }

    return {
      valid: true,
      normalized,
    };
  }

  /**
   * Check if a username is reserved (case-insensitive).
   */
  public isReservedUsername(input: string): boolean {
    const normalized = this.normalizeUsername(input);
    return RESERVED_USERNAMES.includes(normalized);
  }
}