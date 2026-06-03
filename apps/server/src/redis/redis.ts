import Redis from "ioredis";
import type { ServerEnv } from "../config/env";
import type { ServerLogger } from "../config/logger";

export type RedisConnection = Redis;

export function createRedisConnection(env: Pick<ServerEnv, "REDIS_URL">): RedisConnection {
  return new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true
  });
}

export async function verifyRedisConnection(redis: RedisConnection, logger: ServerLogger): Promise<void> {
  try {
    await redis.connect();
    const response = await redis.ping();

    if (response !== "PONG") {
      throw new Error(`Unexpected Redis PING response: ${response}`);
    }

    logger.info("Redis connection check succeeded.");
  } catch (error) {
    logger.error({ err: error }, "Redis connection check failed.");
    throw error;
  }
}

export async function closeRedisConnection(redis: RedisConnection, logger: ServerLogger): Promise<void> {
  if (redis.status === "end") {
    return;
  }

  redis.disconnect(false);
  logger.info("Redis connection closed.");
}