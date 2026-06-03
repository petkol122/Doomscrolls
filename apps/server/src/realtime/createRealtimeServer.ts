import { Server, WebSocketTransport } from "colyseus";
import type { Server as HttpServer } from "node:http";
import type { ServerLogger } from "../config/logger";
import { TownRoom, TOWN_ROOM_NAME } from "./rooms";

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

  // Task 018.1: register the (currently empty) TownRoom.
  // The room is a placeholder only - no state schema, no player entity,
  // no gameplay, no client connection wiring. Future dedicated tasks are
  // expected to add the real state, validation, and client join flow.
  realtimeServer.define(TOWN_ROOM_NAME, TownRoom);

  logger.info(
    { rooms: [TOWN_ROOM_NAME] },
    "Colyseus realtime server initialized with empty TownRoom registered.",
  );

  return realtimeServer;
}
