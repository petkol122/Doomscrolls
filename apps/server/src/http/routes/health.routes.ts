import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { ServerEnv } from "../../config/env";

interface HealthRouteOptions extends FastifyPluginOptions {
  readonly environment: ServerEnv["NODE_ENV"];
}

export async function registerHealthRoutes(app: FastifyInstance, options: HealthRouteOptions): Promise<void> {
  app.get("/health", async () => ({
    ok: true,
    service: "doomscrolls-server",
    environment: options.environment
  }));
}