import type {
  CharacterSummary,
  SessionId,
  SessionToken,
  UserId,
} from "@doomscrolls/shared";
import type { Prisma, PrismaClient, User as PrismaUser, UserProfile as PrismaUserProfile, UserSettings as PrismaUserSettings, Session as PrismaSession } from "@prisma/client";
import { SessionStatus } from "@prisma/client";
import { UserRepository } from "../persistence/repositories/UserRepository";
import { SessionRepository } from "../persistence/repositories/SessionRepository";
import { ProfileRepository } from "../persistence/repositories/ProfileRepository";
import { SettingsRepository } from "../persistence/repositories/SettingsRepository";
import { CharacterRepository } from "../persistence/repositories/CharacterRepository";
import { toSafeUserDto } from "../persistence/mappers/userMapper";
import { toPublicProfileDto } from "../persistence/mappers/profileMapper";
import { toUserSettingsDto } from "../persistence/mappers/settingsMapper";
import { toCharacterSummaryDto } from "../persistence/mappers/characterMapper";
import { toIsoDateTimeString } from "../persistence/mappers/dateMapper";
import { AuthErrorCode, AuthError } from "./AuthErrors";
import { UsernameService } from "./UsernameService";
import { PasswordService } from "./PasswordService";
import { SessionTokenService } from "./SessionTokenService";
import type {
  RegisterInput,
  LoginInput,
  AuthServiceConfig,
  AccountState,
  SafeAuthResponse,
} from "./AuthTypes";
import { DEFAULT_AUTH_CONFIG } from "./AuthTypes";

type AuthDbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Authentication service for Core 0.1.
 * Handles registration, login, and session validation.
 * Does not implement HTTP endpoints.
 */
export class AuthService {
  private readonly userRepository: UserRepository;
  private readonly sessionRepository: SessionRepository;
  private readonly profileRepository: ProfileRepository;
  private readonly settingsRepository: SettingsRepository;
  private readonly characterRepository: CharacterRepository;
  private readonly usernameService: UsernameService;
  private readonly passwordService: PasswordService;
  private readonly sessionTokenService: SessionTokenService;
  private readonly config: AuthServiceConfig;

  constructor(
    config: Partial<AuthServiceConfig> = {},
    db?: AuthDbClient,
  ) {
    this.config = { ...DEFAULT_AUTH_CONFIG, ...config };
    this.userRepository = new UserRepository(db);
    this.sessionRepository = new SessionRepository(db);
    this.profileRepository = new ProfileRepository(db);
    this.settingsRepository = new SettingsRepository(db);
    this.characterRepository = new CharacterRepository(db);
    this.usernameService = new UsernameService();
    this.passwordService = new PasswordService();
    this.sessionTokenService = new SessionTokenService();
  }

  /**
   * Register a new user account.
   * Creates user + profile + settings + session.
   * Returns safe auth response DTO.
   * 
   * TODO: Implement proper transaction support when repositories are refactored
   * to accept a shared transaction client. Currently, if a later step fails,
   * earlier records may remain orphaned.
   */
  public async register(input: RegisterInput): Promise<SafeAuthResponse> {
    // 1. Validate username
    const usernameValidation = this.usernameService.validateUsername(input.username);
    if (!usernameValidation.valid) {
      throw new AuthError(AuthErrorCode.INVALID_USERNAME, usernameValidation.error);
    }

    // 2. Normalize username
    const usernameNormalized = usernameValidation.normalized;

    // 3. Validate password
    const passwordValidation = this.passwordService.validatePassword(input.password);
    if (!passwordValidation.valid) {
      throw new AuthError(AuthErrorCode.INVALID_PASSWORD, passwordValidation.error);
    }

    // 4. Validate displayName
    const displayName = this.validateAndTrimDisplayName(input.displayName);

    // 5. Check username uniqueness
    const existingUser = await this.userRepository.findByUsernameNormalized(usernameNormalized);
    if (existingUser) {
      throw new AuthError(AuthErrorCode.USERNAME_TAKEN);
    }

    // 6. Hash password
    const passwordHash = await this.passwordService.hashPassword(input.password);

    // 7. Create user
    const user = await this.userRepository.createUser({
      username: input.username,
      usernameNormalized,
      passwordHash,
    });

    // 8. Create profile
    const avatarKey = input.avatarKey ?? this.config.defaultAvatarKey;
    const profile = await this.profileRepository.createProfile({
      userId: user.id,
      displayName,
      avatarKey,
    });

    // 9. Create default settings
    const settings = await this.settingsRepository.createDefaultSettings(user.id);

    // 10. Create session token
    const rawToken = this.sessionTokenService.createRawSessionToken();
    const tokenHash = this.sessionTokenService.hashSessionToken(rawToken);
    const expiresAt = this.sessionTokenService.calculateSessionExpiry(this.config.sessionExpiryDays);

    const session = await this.sessionRepository.createSession({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // 11. Return safe auth response DTO (no characters yet for new user)
    return this.buildSafeAuthResponse(user, profile, settings, session, rawToken, []);
  }

  /**
   * Login an existing user.
   * Does not create user on login.
   * Returns safe auth response DTO.
   */
  public async login(input: LoginInput): Promise<SafeAuthResponse> {
    // 1. Normalize username
    const usernameNormalized = this.usernameService.normalizeUsername(input.username);

    // 2. Find user by usernameNormalized
    const user = await this.userRepository.findByUsernameNormalized(usernameNormalized);
    if (!user) {
      // Use generic error to avoid username enumeration
      throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS);
    }

    // 3. Verify password
    const passwordValid = await this.passwordService.verifyPassword(input.password, user.passwordHash);
    if (!passwordValid) {
      // Use generic error to avoid credential enumeration
      throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS);
    }

    // 4. Create session
    const rawToken = this.sessionTokenService.createRawSessionToken();
    const tokenHash = this.sessionTokenService.hashSessionToken(rawToken);
    const expiresAt = this.sessionTokenService.calculateSessionExpiry(this.config.sessionExpiryDays);

    const session = await this.sessionRepository.createSession({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // 5. Update lastSeenAt
    await this.userRepository.updateLastSeen(user.id);

    // 6. Load profile/settings/characters
    const profile = await this.profileRepository.findByUserId(user.id);
    const settings = await this.settingsRepository.findByUserId(user.id);
    const characters = await this.characterRepository.listByUserId(user.id);

    if (!profile || !settings) {
      // This should not happen for a valid user, but handle it gracefully
      throw new AuthError(AuthErrorCode.INTERNAL_ERROR);
    }

    // 7. Return safe auth response DTO
    const characterSummaries = characters.map(toCharacterSummaryDto) as readonly CharacterSummary[];
    return this.buildSafeAuthResponse(user, profile, settings, session, rawToken, characterSummaries);
  }

  /**
   * Get account state from a raw session token.
   * Returns safe account state DTO.
   */
  public async getAccountStateFromToken(rawToken: string): Promise<AccountState> {
    // 1. Hash raw token
    const tokenHash = this.sessionTokenService.hashSessionToken(rawToken);

    // 2. Find active session by tokenHash
    const sessionWithUser = await this.sessionRepository.findActiveByTokenHash(tokenHash);
    if (!sessionWithUser) {
      throw new AuthError(AuthErrorCode.SESSION_INVALID);
    }

    // 3. Reject expired/revoked sessions
    const now = new Date();
    if (sessionWithUser.expiresAt < now) {
      throw new AuthError(AuthErrorCode.SESSION_EXPIRED);
    }

    if (sessionWithUser.status !== SessionStatus.ACTIVE) {
      throw new AuthError(AuthErrorCode.SESSION_INVALID);
    }

    // 4. Load user/profile/settings/characters
    const user = sessionWithUser.user;
    const profile = await this.profileRepository.findByUserId(user.id);
    const settings = await this.settingsRepository.findByUserId(user.id);
    const characters = await this.characterRepository.listByUserId(user.id);

    if (!profile || !settings) {
      throw new AuthError(AuthErrorCode.INTERNAL_ERROR);
    }

    // 5. Return safe account state DTO
    const characterSummaries = characters.map(toCharacterSummaryDto) as readonly CharacterSummary[];
    return {
      user: toSafeUserDto(user),
      profile: toPublicProfileDto({ ...profile, user: { username: user.username } }),
      settings: toUserSettingsDto(settings),
      characters: characterSummaries,
    };
  }

  /**
   * Validate and trim displayName.
   */
  private validateAndTrimDisplayName(input: string): string {
    const trimmed = input.trim();

    if (trimmed.length === 0) {
      throw new AuthError(AuthErrorCode.INVALID_DISPLAY_NAME, "Display name cannot be empty");
    }

    if (trimmed.length > 32) {
      throw new AuthError(AuthErrorCode.INVALID_DISPLAY_NAME, "Display name must be at most 32 characters");
    }

    // Reject unsafe control characters
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0E-\x1F\x7F]/.test(trimmed)) {
      throw new AuthError(AuthErrorCode.INVALID_DISPLAY_NAME, "Display name contains invalid characters");
    }

    return trimmed;
  }

  /**
   * Build a safe auth response DTO.
   * Excludes passwordHash from all DTOs.
   * Raw session token is returned to client only, never stored.
   */
  private buildSafeAuthResponse(
    user: PrismaUser,
    profile: PrismaUserProfile,
    settings: PrismaUserSettings,
    session: PrismaSession,
    rawToken: string,
    characterSummaries: readonly CharacterSummary[],
  ): SafeAuthResponse {
    return {
      user: toSafeUserDto(user),
      profile: toPublicProfileDto({ ...profile, user: { username: user.username } }),
      settings: toUserSettingsDto(settings),
      session: {
        id: session.id as SessionId,
        userId: session.userId as UserId,
        token: rawToken as SessionToken,
        expiresAt: toIsoDateTimeString(session.expiresAt),
        createdAt: toIsoDateTimeString(session.createdAt),
      },
      characters: characterSummaries,
    };
  }
}