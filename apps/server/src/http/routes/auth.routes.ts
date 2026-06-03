import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { AuthService } from "../../auth/AuthService";
import { isAuthError } from "../../auth/AuthErrors";
import { mapAuthErrorToHttpResponse, getHttpStatusFromAuthError } from "../errors/httpErrorMapper";
import { authenticateRequest } from "../middleware/authenticate";

/**
 * Zod schemas for request validation.
 * Rejects missing/invalid fields server-side. Never relies on client validation.
 */
const registerBodySchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  displayName: z.string().min(1, "Display name is required"),
});

const loginBodySchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

/**
 * Register auth HTTP routes.
 *
 * POST /auth/register  - Create a new account
 * POST /auth/login     - Login with existing credentials
 * GET  /me             - Get authenticated account state
 */
export async function registerAuthRoutes(app: FastifyInstance, _options: FastifyPluginOptions): Promise<void> {
  const authService = new AuthService();

  /**
   * POST /auth/register
   *
   * Creates a new user account with username/password.
   * Returns safe auth response DTO with token, user, profile, settings, characters.
   * Never exposes passwordHash or tokenHash.
   */
  app.post("/auth/register", async (request, reply) => {
    // 1. Validate request body shape
    const parsed = registerBodySchema.safeParse(request.body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request body";
      void reply.code(400).send({
        error: message,
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const { username, password, displayName } = parsed.data;

    try {
      // 2. Call AuthService.register
      const result = await authService.register({ username, password, displayName });

      // 3. Return safe auth response DTO (201 Created)
      void reply.code(201).send(result);
    } catch (error: unknown) {
      if (isAuthError(error)) {
        void reply.code(getHttpStatusFromAuthError(error)).send(mapAuthErrorToHttpResponse(error));
        return;
      }

      // Unknown error -- generic response, never leak details
      void reply.code(500).send({
        error: "An internal error occurred",
        code: "INTERNAL_ERROR",
      });
    }
  });

  /**
   * POST /auth/login
   *
   * Authenticates an existing user with username/password.
   * Returns safe auth response DTO with token, user, profile, settings, characters.
   * Never exposes passwordHash or tokenHash.
   * Uses generic INVALID_CREDENTIALS error to prevent username enumeration.
   */
  app.post("/auth/login", async (request, reply) => {
    // 1. Validate request body shape
    const parsed = loginBodySchema.safeParse(request.body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request body";
      void reply.code(400).send({
        error: message,
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const { username, password } = parsed.data;

    try {
      // 2. Call AuthService.login
      const result = await authService.login({ username, password });

      // 3. Return safe auth response DTO (200 OK)
      void reply.code(200).send(result);
    } catch (error: unknown) {
      if (isAuthError(error)) {
        void reply.code(getHttpStatusFromAuthError(error)).send(mapAuthErrorToHttpResponse(error));
        return;
      }

      // Unknown error -- generic response, never leak details
      void reply.code(500).send({
        error: "An internal error occurred",
        code: "INTERNAL_ERROR",
      });
    }
  });

  /**
   * GET /me
   *
   * Returns the authenticated user's account state.
   * Requires Bearer token in Authorization header.
   * Returns user, profile, settings, characters (no token in response).
   * Rejects invalid/expired/revoked sessions.
   */
  app.get("/me", async (request, reply) => {
    const account = await authenticateRequest(request, reply, authService);

    if (account === null) {
      // authenticateRequest already sent the error response
      return;
    }

    // Return safe account state DTO (no token, no passwordHash, no tokenHash)
    void reply.code(200).send(account);
  });
}
