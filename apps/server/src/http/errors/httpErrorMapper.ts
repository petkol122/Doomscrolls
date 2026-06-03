import { AuthErrorCode, AUTH_ERROR_MESSAGES, type AuthError } from "../../auth/AuthErrors";
import { CharacterErrorCode, type CharacterError } from "../../character/CharacterErrors";

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
 * HTTP status code mapping for character domain errors.
 */
const CHARACTER_ERROR_STATUS_MAP: Record<CharacterErrorCode, number> = {
  [CharacterErrorCode.INVALID_CHARACTER_NAME]: 400,
  [CharacterErrorCode.CHARACTER_NAME_TAKEN]: 409,
  [CharacterErrorCode.INVALID_ORIGIN]: 400,
  [CharacterErrorCode.INVALID_CLASS]: 400,
  [CharacterErrorCode.ORIGIN_CLASS_NOT_ALLOWED]: 400,
  [CharacterErrorCode.CHARACTER_NOT_FOUND]: 404,
  [CharacterErrorCode.INTERNAL_ERROR]: 500,
};

/**
 * Safe public character error messages.
 */
const CHARACTER_ERROR_MESSAGES: Record<CharacterErrorCode, string> = {
  [CharacterErrorCode.INVALID_CHARACTER_NAME]: "Character name is invalid",
  [CharacterErrorCode.CHARACTER_NAME_TAKEN]: "Character name is already used by this account",
  [CharacterErrorCode.INVALID_ORIGIN]: "Origin is invalid",
  [CharacterErrorCode.INVALID_CLASS]: "Class is invalid",
  [CharacterErrorCode.ORIGIN_CLASS_NOT_ALLOWED]: "Class is not allowed for this origin",
  [CharacterErrorCode.CHARACTER_NOT_FOUND]: "Character was not found",
  [CharacterErrorCode.INTERNAL_ERROR]: "An internal error occurred",
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

/**
 * Map a CharacterError to a safe HTTP status code.
 */
export function getHttpStatusFromCharacterError(error: CharacterError): number {
  return CHARACTER_ERROR_STATUS_MAP[error.code] ?? 500;
}

/**
 * Map a CharacterError to a safe HTTP error response body.
 * Uses predefined safe messages; never leaks Prisma errors or stack traces.
 */
export function mapCharacterErrorToHttpResponse(error: CharacterError): HttpErrorResponse {
  return {
    error: CHARACTER_ERROR_MESSAGES[error.code] ?? "An internal error occurred",
    code: error.code,
  };
}