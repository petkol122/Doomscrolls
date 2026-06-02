import { createHash, randomBytes } from "node:crypto";

/**
 * Session token generation and hashing service.
 * Uses cryptographically secure random tokens and SHA-256 hashing.
 */
export class SessionTokenService {
  /**
   * Create a cryptographically random session token.
   * Returns a hex-encoded string of 32 bytes (256 bits).
   * Never log the raw token.
   */
  public createRawSessionToken(): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Hash a session token for storage in the database.
   * Uses SHA-256 for deterministic hashing that supports lookup.
   * The raw token is never stored in the database.
   */
  public hashSessionToken(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }

  /**
   * Calculate session expiry date.
   * @param expiryDays Number of days until expiry (default: 30)
   */
  public calculateSessionExpiry(expiryDays: number = 30): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + expiryDays);
    return expiry;
  }
}