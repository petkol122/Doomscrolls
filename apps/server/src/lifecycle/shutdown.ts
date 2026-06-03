import type { Server } from "colyseus";
import type { FastifyInstance } from "fastify";
import type { ServerLogger } from "../config/logger";
import { closeRedisConnection, type RedisConnection } from "../redis/redis";

interface ShutdownResources {
  readonly app: FastifyInstance;
  readonly logger: ServerLogger;
  readonly realtimeServer: Server;
  readonly redis: RedisConnection;
  readonly exitCode?: number;
}

let isShuttingDown = false;

export function registerShutdownHandlers(resources: ShutdownResources): void {
  const handleSignal = (signal: NodeJS.Signals) => {
    resources.logger.info({ signal }, "Shutdown signal received.");
    void shutdown(resources);
  };

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);
}

export async function shutdown({ app, logger, realtimeServer, redis, exitCode = 0 }: ShutdownResources): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  try {
    await realtimeServer.gracefullyShutdown(false);
    await app.close();
    await closeRedisConnection(redis, logger);
    logger.info("Server shutdown completed.");
  } catch (error) {
    logger.error({ err: error }, "Server shutdown failed.");
    process.exitCode = 1;
    return;
  }

  process.exitCode = exitCode;
}