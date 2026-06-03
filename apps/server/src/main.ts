import { loadEnv } from "./config/env";
import { validateContentOnStartup } from "./content/validateContentOnStartup";
import { createHttpServer } from "./http/createHttpServer";
import { registerShutdownHandlers, shutdown } from "./lifecycle/shutdown";
import { createRealtimeServer } from "./realtime/createRealtimeServer";
import { createRedisConnection, verifyRedisConnection } from "./redis/redis";

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await createHttpServer({ env });
  const logger = app.log;

  logger.info({ environment: env.NODE_ENV }, "Starting Doomscrolls server.");
  validateContentOnStartup(logger);

  const redis = createRedisConnection(env);
  const realtimeServer = await createRealtimeServer({ app, httpServer: app.server, logger });

  registerShutdownHandlers({ app, logger, realtimeServer, redis });

  try {
    await verifyRedisConnection(redis, logger);
    await app.listen({ port: env.SERVER_PORT, host: "0.0.0.0" });
    logger.info({ address: `http://localhost:${env.SERVER_PORT}` }, "Server is listening.");
  } catch (error) {
    logger.error({ err: error }, "Server startup failed.");
    await shutdown({ app, logger, realtimeServer, redis, exitCode: 1 });
  }
}

main().catch((error: unknown) => {
  console.error("Fatal server startup error.", error);
  process.exitCode = 1;
});
