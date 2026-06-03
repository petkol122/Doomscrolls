import argon2 from "argon2";
import type { PasswordValidationResult } from "./AuthTypes";

/**
 * Password hashing and verification service.
 * Uses argon2id for secure password hashing.
 */
export class PasswordService {
  /**
   * Hash a password using argon2id.
   * Never log the password or the hash.
   */
  public async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verify a password against a stored hash.
   * Never log the password or the hash.
   */
  public async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      // If verification fails for any reason (e.g., invalid hash format),
      // return false rather than throwing
      return false;
    }
  }

  /**
   * Validate password according to Core 0.1 rules:
   * - min length: 8
   * - max length: 128
   * - must not be whitespace-only
   */
  public validatePassword(password: string): PasswordValidationResult {
    if (password.length < 8) {
      return {
        valid: false,
        error: "Password must be at least 8 characters long",
      };
    }

    if (password.length > 128) {
      return {
        valid: false,
        error: "Password must be at most 128 characters long",
      };
    }

    if (password.trim().length === 0) {
      return {
        valid: false,
        error: "Password cannot be whitespace-only",
      };
    }

    return { valid: true };
  }
}