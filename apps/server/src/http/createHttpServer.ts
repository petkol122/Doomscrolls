import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { ServerEnv } from "../config/env";
import { createLoggerOptions } from "../config/logger";
import { registerHealthRoutes } from "./routes/health.routes";
import { registerAuthRoutes } from "./routes/auth.routes";
import { registerCharacterRoutes } from "./routes/character.routes";
import { registerEquipmentRoutes } from "./routes/equipment.routes";

interface CreateHttpServerOptions {
  readonly env: ServerEnv;
}

function buildAllowedCorsOrigins(env: ServerEnv): string[] {
  return [env.CLIENT_ORIGIN, env.CLIENT_ORIGIN_EXTRA]
    .filter((origin): origin is string => typeof origin === "string")
    .filter((origin, index, origins) => origins.indexOf(origin) === index);
}

export async function createHttpServer({ env }: CreateHttpServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: createLoggerOptions(env) });
  const allowedOrigins = buildAllowedCorsOrigins(env);

  await app.register(cors, {
    origin: (origin, callback) => {
      if (origin === undefined || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed"), false);
    },
    credentials: true
  });

  await app.register(registerHealthRoutes, { environment: env.NODE_ENV });
  await app.register(registerAuthRoutes);
  await app.register(registerCharacterRoutes);
  await app.register(registerEquipmentRoutes);

  return app;
}