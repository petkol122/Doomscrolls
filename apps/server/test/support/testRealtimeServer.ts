import { Server, WebSocketTransport } from "colyseus";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { TownRoom, TOWN_ROOM_NAME, CombatRoom, COMBAT_ROOM_NAME } from "../../src/realtime/rooms";

/**
 * Boots a real, in-process Colyseus server for regression tests -- no
 * Fastify layer, no throwaway DB accounts, no separate server process.
 *
 * Room registration mirrors apps/server/src/realtime/createRealtimeServer.ts
 * exactly, including `.filterBy(["requestedZoneId"])` on CombatRoom (the
 * Core 0.7 Task 361 hotfix). Keep these two in sync: if the real
 * registration changes, this harness should change with it, or a
 * regression here would test something production doesn't actually run.
 */
export async function createTestRealtimeServer(port: number): Promise<ColyseusTestServer> {
  const server = new Server({
    transport: new WebSocketTransport(),
    greet: false,
  });

  server.define(TOWN_ROOM_NAME, TownRoom);
  server.define(COMBAT_ROOM_NAME, CombatRoom).filterBy(["requestedZoneId"]);

  return boot(server, port);
}
