import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { ServerEnv } from "../config/env";
import { createLoggerOptions } from "../config/logger";
import { registerHealthRoutes } from "./routes/health.routes";
import { registerAuthRoutes } from "./routes/auth.routes";
import { registerCharacterRoutes } from "./routes/character.routes";

interface CreateHttpServerOptions {
  readonly env: ServerEnv;
}

export async function createHttpServer({ env }: CreateHttpServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: createLoggerOptions(env) });

  await app.register(cors, {
    origin: env.CLIENT_ORIGIN,
    credentials: true
  });

  await app.register(registerHealthRoutes, { environment: env.NODE_ENV });
  await app.register(registerAuthRoutes);
  await app.register(registerCharacterRoutes);

  return app;
}