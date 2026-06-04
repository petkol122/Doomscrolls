import type {
  CharacterSummary,
  SessionId,
  SessionToken,
  UserId,
} from "@doomscrolls/shared";
import { Prisma, type PrismaClient, type User as PrismaUser, type UserProfile as PrismaUserProfile, type UserSettings as PrismaUserSettings, type Session as PrismaSession } from "@prisma/client";
import { SessionStatus } from "@prisma/client";
import { prisma as defaultPrismaClient } from "../persistence/prisma";
import { UserRepository } from "../persistence/repositories/UserRepository";
import { SessionRepository } from "../persistence/repositories/SessionRepository";
import { ProfileRepository } from "../persistence/repositories/ProfileRepository";
import { SettingsRepository } from "../persistence/repositories/SettingsRepository";
import { CharacterRepository } from "../persistence/repositories/CharacterRepository";
import { toSafeUserDto } from "../persistence/mappers/userMapper";
import { toPublicProfileDto } from "../persistence/mappers/profileMapper";
import { toUserSettingsDto } from "../persistence/mappers/settingsMapper";
import { toCharacterSummaryDto, toCharacterSummaryWithInventoryDto } from "../persistence/mappers/characterMapper";
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
 * Type guard to check if an error is a Prisma unique constraint violation (P2002).
 * Used to map race-condition unique violations to safe auth errors.
 */
function isPrismaUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

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
   * Creates user + profile + settings + session inside a single Prisma transaction.
   * If any step fails, no partial account state remains.
   * Returns safe auth response DTO.
   *
   * Validation and password hashing happen outside the transaction
   * to avoid holding a database connection during expensive operations.
   * The username uniqueness pre-check is an optimization; the database
   * unique constraint on usernameNormalized is the authoritative guard.
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

    // 5. Pre-check username uniqueness (optimization; DB constraint is authoritative)
    const existingUser = await this.userRepository.findByUsernameNormalized(usernameNormalized);
    if (existingUser) {
      throw new AuthError(AuthErrorCode.USERNAME_TAKEN);
    }

    // 6. Hash password (expensive; done outside transaction)
    const passwordHash = await this.passwordService.hashPassword(input.password);

    // 7. Generate session token material before transaction
    //    Raw token is returned to client only if the transaction succeeds.
    const rawToken = this.sessionTokenService.createRawSessionToken();
    const tokenHash = this.sessionTokenService.hashSessionToken(rawToken);
    const expiresAt = this.sessionTokenService.calculateSessionExpiry(this.config.sessionExpiryDays);

    // 8. Create user + profile + settings + session in one atomic transaction
    const avatarKey = input.avatarKey ?? this.config.defaultAvatarKey;

    let user: PrismaUser;
    let profile: PrismaUserProfile;
    let settings: PrismaUserSettings;
    let session: PrismaSession;

    try {
      ({ user, profile, settings, session } = await defaultPrismaClient.$transaction(
        async (tx) => {
          const txUserRepo = new UserRepository(tx);
          const txProfileRepo = new ProfileRepository(tx);
          const txSettingsRepo = new SettingsRepository(tx);
          const txSessionRepo = new SessionRepository(tx);

          const txUser = await txUserRepo.createUser({
            username: input.username,
            usernameNormalized,
            passwordHash,
          });

          const txProfile = await txProfileRepo.createProfile({
            userId: txUser.id,
            displayName,
            avatarKey,
          });

          const txSettings = await txSettingsRepo.createDefaultSettings(txUser.id);

          const txSession = await txSessionRepo.createSession({
            userId: txUser.id,
            tokenHash,
            expiresAt,
          });

          return {
            user: txUser,
            profile: txProfile,
            settings: txSettings,
            session: txSession,
          };
        },
      ));
    } catch (error: unknown) {
      // Map Prisma unique constraint violation on usernameNormalized to safe error
      if (isPrismaUniqueConstraintError(error)) {
        throw new AuthError(AuthErrorCode.USERNAME_TAKEN);
      }
      // Re-throw AuthError instances directly
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(AuthErrorCode.INTERNAL_ERROR);
    }

    // 9. Return safe auth response DTO (no characters yet for new user)
    //    Raw token is returned to the client only after successful transaction.
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
    const characters = await this.characterRepository.listByUserIdForAccountState(user.id);

    if (!profile || !settings) {
      // This should not happen for a valid user, but handle it gracefully
      throw new AuthError(AuthErrorCode.INTERNAL_ERROR);
    }

    // 7. Return safe auth response DTO
    const characterSummaries = characters.map(toCharacterSummaryWithInventoryDto) as readonly CharacterSummary[];
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
    const characters = await this.characterRepository.listByUserIdForAccountState(user.id);

    if (!profile || !settings) {
      throw new AuthError(AuthErrorCode.INTERNAL_ERROR);
    }

    // 5. Return safe account state DTO
    const characterSummaries = characters.map(toCharacterSummaryWithInventoryDto) as readonly CharacterSummary[];
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