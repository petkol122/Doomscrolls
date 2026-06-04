import { Client, Room } from "@colyseus/sdk";

import type { CharacterId, SessionToken, ZoneId } from "@doomscrolls/shared";
import type { RoomJoinAuthPayload, RoomState } from "@doomscrolls/shared";
import { clientEnv } from "../config/env";

export type RealtimeClient = Client;

export function createRealtimeClient(wsUrl: URL = requireRealtimeWsUrl()): RealtimeClient {
  return new Client(wsUrl.toString());
}

function requireRealtimeWsUrl(): URL {
  if (clientEnv.wsUrl === undefined) {
    throw new Error("VITE_WS_URL is required to create a realtime client.");
  }

  return clientEnv.wsUrl;
}

export async function joinTownRoom(
  client: RealtimeClient,
  sessionToken: SessionToken,
  characterId: CharacterId,
  requestedZoneId?: ZoneId,
): Promise<Room<RoomState>> {
  const payload: RoomJoinAuthPayload = {
    sessionToken,
    characterId,
    requestedRoomKind: "town",
    ...(requestedZoneId !== undefined ? { requestedZoneId } : {}),
  };

  return client.joinOrCreate("town", payload);
}

/**
 * Formats town room state for display/logging purposes.
 * Extracts and formats key town room information.
 */
export function formatTownRoomState(state: RoomState): {
  roomKind: string;
  zoneId: string;
  playerCount: number;
} {
  const roomState = state as RoomState & { readonly roomKind?: string };

  return {
    roomKind: roomState.roomKind ?? state.kind,
    zoneId: state.zoneId,
    playerCount: state.connectedPlayerCount,
  };
}
