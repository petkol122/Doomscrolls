import type { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "../../auth/AuthService";
import { isAuthError } from "../../auth/AuthErrors";

/**
 * Bearer token prefix constant.
 */
const BEARER_PREFIX = "Bearer ";

/**
 * Extract the raw session token from the Authorization header.
 * Returns null if the header is missing or malformed.
 *
 * Accepts: Authorization: Bearer <token>
 * Rejects: cookies, query params, malformed headers
 */
export function extractBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;

  if (typeof authHeader !== "string") {
    return null;
  }

  if (!authHeader.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = authHeader.slice(BEARER_PREFIX.length).trim();

  if (token.length === 0) {
    return null;
  }

  return token;
}

/**
 * Authenticated request context returned after successful token validation.
 */
export interface AuthenticatedAccount {
  readonly user: Awaited<ReturnType<AuthService["getAccountStateFromToken"]>>["user"];
  readonly profile: Awaited<ReturnType<AuthService["getAccountStateFromToken"]>>["profile"];
  readonly settings: Awaited<ReturnType<AuthService["getAccountStateFromToken"]>>["settings"];
  readonly characters: Awaited<ReturnType<AuthService["getAccountStateFromToken"]>>["characters"];
}

/**
 * Authenticate a request using the Bearer token from the Authorization header.
 *
 * Returns the account state on success.
 * Sends an appropriate HTTP error response and returns null on failure.
 *
 * Never exposes passwordHash, tokenHash, or internal stack traces.
 */
export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  authService: AuthService,
): Promise<AuthenticatedAccount | null> {
  const token = extractBearerToken(request);

  if (token === null) {
    void reply.code(401).send({
      error: "Missing or malformed Authorization header",
      code: "SESSION_INVALID",
    });
    return null;
  }

  try {
    const accountState = await authService.getAccountStateFromToken(token);
    return accountState;
  } catch (error: unknown) {
    if (isAuthError(error)) {
      const { mapAuthErrorToHttpResponse, getHttpStatusFromAuthError } = await import(
        "../errors/httpErrorMapper"
      );
      void reply.code(getHttpStatusFromAuthError(error)).send(mapAuthErrorToHttpResponse(error));
      return null;
    }

    // Unknown error -- return generic internal error, never leak details
    void reply.code(500).send({
      error: "An internal error occurred",
      code: "INTERNAL_ERROR",
    });
    return null;
  }
}
