// Auth domain services
export { AuthService } from "./AuthService";
export { PasswordService } from "./PasswordService";
export { SessionTokenService } from "./SessionTokenService";
export { UsernameService } from "./UsernameService";

// Auth errors
export { AuthError, AuthErrorCode, AUTH_ERROR_MESSAGES, isAuthError } from "./AuthErrors";

// Auth types
export type {
  AccountState,
  AuthServiceConfig,
  DisplayNameValidationResult,
  ExtendedAuthResult,
  LoginInput,
  PasswordValidationResult,
  RegisterInput,
  SafeAuthResponse,
  UsernameValidationResult,
} from "./AuthTypes";

export { DEFAULT_AUTH_CONFIG } from "./AuthTypes";