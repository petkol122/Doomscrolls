import type { AuthResult, AuthSession, CharacterSummary, LoginPayload, PublicProfile, User, UserSettings } from "@doomscrolls/shared";

export interface HealthCheckResult {
  readonly ok: boolean;
  readonly status: number;
}

export interface RegisterRequest {
  readonly username: string;
  readonly password: string;
  readonly displayName: string;
}

export type LoginRequest = LoginPayload;

export interface AccountState {
  readonly user: User;
  readonly profile: PublicProfile;
  readonly settings: UserSettings;
  readonly characters: readonly CharacterSummary[];
}

export interface AuthResponse extends AuthResult {
  readonly session: AuthSession;
  readonly characters: readonly CharacterSummary[];
}

export type ApiErrorCode =
  | "API_URL_MISSING"
  | "SERVER_UNAVAILABLE"
  | "VALIDATION_ERROR"
  | "INVALID_USERNAME"
  | "INVALID_PASSWORD"
  | "INVALID_DISPLAY_NAME"
  | "USERNAME_TAKEN"
  | "INVALID_CREDENTIALS"
  | "SESSION_INVALID"
  | "SESSION_EXPIRED"
  | "AUTH_ERROR"
  | "INTERNAL_ERROR"
  | "UNKNOWN_ERROR";

export class ApiClientError extends Error {
  public constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface ErrorResponseBody {
  readonly error?: unknown;
  readonly code?: unknown;
}

export class ApiClient {
  public constructor(private readonly apiUrl: URL) {}

  public async getHealth(): Promise<HealthCheckResult> {
    const healthUrl = new URL("/health", this.apiUrl);

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        credentials: "omit"
      });

      return {
        ok: response.ok,
        status: response.status
      };
    } catch {
      return {
        ok: false,
        status: 0
      };
    }
  }

  public async register(payload: RegisterRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: payload
    });
  }

  public async login(payload: LoginRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: payload
    });
  }

  public async getMe(sessionToken: string): Promise<AccountState> {
    return this.request<AccountState>("/me", {
      method: "GET",
      sessionToken
    });
  }

  private async request<TResponse>(path: string, options: RequestOptions): Promise<TResponse> {
    const requestUrl = new URL(path, this.apiUrl);

    let response: Response;

    const requestInit: RequestInit = {
      method: options.method,
      credentials: "omit",
      headers: this.createHeaders(options)
    };

    if (options.body !== undefined) {
      requestInit.body = JSON.stringify(options.body);
    }

    try {
      response = await fetch(requestUrl, requestInit);
    } catch {
      throw new ApiClientError("SERVER_UNAVAILABLE", "Server unavailable", 0);
    }

    if (!response.ok) {
      throw await this.createErrorFromResponse(response);
    }

    return (await response.json()) as TResponse;
  }

  private createHeaders(options: RequestOptions): HeadersInit {
    const headers: Record<string, string> = {
      Accept: "application/json"
    };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (options.sessionToken !== undefined) {
      headers.Authorization = `Bearer ${options.sessionToken}`;
    }

    return headers;
  }

  private async createErrorFromResponse(response: Response): Promise<ApiClientError> {
    const body = await this.readErrorBody(response);
    const code = this.normalizeErrorCode(body.code, response.status);
    const message = typeof body.error === "string" ? body.error : "Request failed";

    return new ApiClientError(code, message, response.status);
  }

  private async readErrorBody(response: Response): Promise<ErrorResponseBody> {
    try {
      const parsed = (await response.json()) as unknown;
      if (typeof parsed !== "object" || parsed === null) {
        return {};
      }

      return parsed as ErrorResponseBody;
    } catch {
      return {};
    }
  }

  private normalizeErrorCode(rawCode: unknown, status: number): ApiErrorCode {
    if (typeof rawCode === "string") {
      switch (rawCode) {
        case "VALIDATION_ERROR":
        case "INVALID_USERNAME":
        case "INVALID_PASSWORD":
        case "INVALID_DISPLAY_NAME":
        case "USERNAME_TAKEN":
        case "INVALID_CREDENTIALS":
        case "SESSION_INVALID":
        case "SESSION_EXPIRED":
        case "INTERNAL_ERROR":
          return rawCode;
        default:
          break;
      }
    }

    if (status === 401) {
      return "AUTH_ERROR";
    }

    if (status >= 500) {
      return "INTERNAL_ERROR";
    }

    return "UNKNOWN_ERROR";
  }
}

interface RequestOptions {
  readonly method: "GET" | "POST";
  readonly body?: unknown;
  readonly sessionToken?: string;
}