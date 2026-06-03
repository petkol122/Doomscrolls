import { Server, WebSocketTransport, matchMaker } from "colyseus";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Server as HttpServer } from "node:http";
import type { ServerLogger } from "../config/logger";
import { TownRoom, TOWN_ROOM_NAME } from "./rooms";

interface CreateRealtimeServerOptions {
  readonly app: FastifyInstance;
  readonly httpServer: HttpServer;
  readonly logger: ServerLogger;
}

interface MatchmakingRouteParams {
  readonly method: string;
  readonly roomName: string;
}

function getHeaderValue(header: string | string[] | undefined): string | undefined {
  if (Array.isArray(header)) {
    return header[0];
  }

  return header;
}

function getBearerToken(authorizationHeader: string | string[] | undefined): string | undefined {
  const authorization = getHeaderValue(authorizationHeader);
  if (!authorization) {
    return undefined;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
}

function getRequestIp(request: FastifyRequest): string | string[] {
  return (
    request.headers["x-forwarded-for"] ??
    request.headers["x-client-ip"] ??
    request.headers["x-real-ip"] ??
    request.ip ??
    ""
  );
}

function createHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
      continue;
    }

    headers.set(key, String(value));
  }

  return headers;
}

async function registerMatchmakingRoute(app: FastifyInstance): Promise<void> {
  app.options("/matchmake/:method/:roomName", async (_request, reply) => {
    await reply.code(204).send();
  });

  app.post<{ Params: MatchmakingRouteParams }>(
    "/matchmake/:method/:roomName",
    async (request, reply: FastifyReply) => {
      const { method, roomName } = request.params;
      const token = getBearerToken(request.headers.authorization);
      const authContext = {
        headers: createHeaders(request),
        ip: getRequestIp(request),
        req: request,
        ...(token !== undefined ? { token } : {}),
      };

      try {
        const seatReservation = await matchMaker.controller.invokeMethod(
          method,
          roomName,
          request.body ?? {},
          authContext,
        );

        await reply.send(seatReservation);
      } catch (error) {
        const maybeError = error as { code?: number; message?: string };
        const statusCode = typeof maybeError.code === "number" ? maybeError.code : 500;
        await reply.code(statusCode).send({
          code: statusCode,
          error: maybeError.message ?? "matchmaking_failed",
        });
      }
    },
  );
}

export async function createRealtimeServer({ app, httpServer, logger }: CreateRealtimeServerOptions): Promise<Server> {
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
  await matchMaker.accept();
  await registerMatchmakingRoute(app);

  logger.info(
    { rooms: [TOWN_ROOM_NAME] },
    "Colyseus realtime server initialized with empty TownRoom registered.",
  );

  return realtimeServer;
}
