import type { FastifyBaseLogger, FastifyServerOptions } from "fastify";
import type { ServerEnv } from "./env";

export type ServerLogger = FastifyBaseLogger;

const redactedSecretPaths = [
  "SESSION_SECRET",
  "DATABASE_URL",
  "REDIS_URL",
  "*.SESSION_SECRET",
  "*.DATABASE_URL",
  "*.REDIS_URL"
] as const;

export function createLoggerOptions(env: Pick<ServerEnv, "NODE_ENV">): NonNullable<FastifyServerOptions["logger"]> {
  return {
    level: env.NODE_ENV === "production" ? "info" : "debug",
    redact: {
      paths: [...redactedSecretPaths],
      censor: "[redacted]"
    }
  } as const;
}