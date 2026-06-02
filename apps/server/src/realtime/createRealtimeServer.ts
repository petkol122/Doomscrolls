import { Server, WebSocketTransport } from "colyseus";
import type { Server as HttpServer } from "node:http";
import type { ServerLogger } from "../config/logger";

interface CreateRealtimeServerOptions {
  readonly httpServer: HttpServer;
  readonly logger: ServerLogger;
}

export function createRealtimeServer({ httpServer, logger }: CreateRealtimeServerOptions): Server {
  const transport = new WebSocketTransport();
  transport.attachToServer(httpServer);

  const realtimeServer = new Server({
    transport,
    greet: false,
    logger
  });

  logger.info("Colyseus realtime server shell initialized with no rooms registered.");

  return realtimeServer;
}