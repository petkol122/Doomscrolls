import { AuthErrorCode, AUTH_ERROR_MESSAGES, type AuthError } from "../../auth/AuthErrors";

/**
 * HTTP status code mapping for auth domain errors.
 */
const AUTH_ERROR_STATUS_MAP: Record<AuthErrorCode, number> = {
  [AuthErrorCode.INVALID_USERNAME]: 400,
  [AuthErrorCode.USERNAME_TAKEN]: 409,
  [AuthErrorCode.INVALID_PASSWORD]: 400,
  [AuthErrorCode.INVALID_DISPLAY_NAME]: 400,
  [AuthErrorCode.INVALID_CREDENTIALS]: 401,
  [AuthErrorCode.SESSION_INVALID]: 401,
  [AuthErrorCode.SESSION_EXPIRED]: 401,
  [AuthErrorCode.INTERNAL_ERROR]: 500,
};

/**
 * Safe HTTP error response body.
 * Never exposes stack traces, Prisma errors, passwordHash or tokenHash.
 */
export interface HttpErrorResponse {
  readonly error: string;
  readonly code: string;
}

/**
 * Map an AuthError to a safe HTTP status code.
 */
export function getHttpStatusFromAuthError(error: AuthError): number {
  return AUTH_ERROR_STATUS_MAP[error.code] ?? 500;
}

/**
 * Map an AuthError to a safe HTTP error response body.
 * Uses predefined safe messages; never leaks internal details.
 */
export function mapAuthErrorToHttpResponse(error: AuthError): HttpErrorResponse {
  return {
    error: AUTH_ERROR_MESSAGES[error.code] ?? "An internal error occurred",
    code: error.code,
  };
}