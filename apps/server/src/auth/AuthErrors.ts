/**
 * Authentication error codes for the auth domain.
 * These are safe, non-revealing error identifiers.
 */
export enum AuthErrorCode {
  INVALID_USERNAME = "INVALID_USERNAME",
  USERNAME_TAKEN = "USERNAME_TAKEN",
  INVALID_PASSWORD = "INVALID_PASSWORD",
  INVALID_DISPLAY_NAME = "INVALID_DISPLAY_NAME",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  SESSION_INVALID = "SESSION_INVALID",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Safe authentication error class.
 * Does not expose internal details or stack traces to clients.
 */
export class AuthError extends Error {
  public readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AuthError";
    this.code = code;
  }
}

/**
 * Type guard to check if an error is an AuthError.
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/**
 * Safe error messages for each error code.
 * These are user-facing and should not reveal implementation details.
 */
export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  [AuthErrorCode.INVALID_USERNAME]: "Invalid username format",
  [AuthErrorCode.USERNAME_TAKEN]: "Username is already taken",
  [AuthErrorCode.INVALID_PASSWORD]: "Invalid password format",
  [AuthErrorCode.INVALID_DISPLAY_NAME]: "Invalid display name format",
  [AuthErrorCode.INVALID_CREDENTIALS]: "Invalid username or password",
  [AuthErrorCode.SESSION_INVALID]: "Invalid session",
  [AuthErrorCode.SESSION_EXPIRED]: "Session has expired",
  [AuthErrorCode.INTERNAL_ERROR]: "An internal error occurred",
};