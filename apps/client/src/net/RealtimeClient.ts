import { Client, Room } from "@colyseus/sdk";

import type { CharacterId, CharacterRuntimeRoomKind, SessionToken, ZoneId } from "@doomscrolls/shared";
import type { RoomJoinAuthPayload, RoomState } from "@doomscrolls/shared";
import { contentRegistry } from "@doomscrolls/content";
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

export async function joinCombatRoom(
  client: RealtimeClient,
  sessionToken: SessionToken,
  characterId: CharacterId,
  requestedZoneId?: ZoneId,
): Promise<Room<RoomState>> {
  const payload: RoomJoinAuthPayload = {
    sessionToken,
    characterId,
    requestedRoomKind: "combat",
    ...(requestedZoneId !== undefined ? { requestedZoneId } : {}),
  };

  return client.joinOrCreate("combat", payload);
}

/**
 * Core 0.6 Wave 2 — resolves a zone's room kind from the content registry
 * instead of a hardcoded `zoneId === "blackwire_sewers"` check, so a new
 * combat zone (e.g. Static Yard) is routed correctly on reconnect/resume
 * without a client code change per zone.
 */
export function resolveRoomKindForZoneId(zoneId?: ZoneId | null): CharacterRuntimeRoomKind | null {
  if (zoneId === undefined || zoneId === null || zoneId.length === 0) {
    return "town";
  }

  const zone = contentRegistry.zones.get(zoneId as never);
  if (zone === undefined) {
    return null;
  }

  return zone.roomType;
}

export async function joinResolvedCharacterRoom(
  client: RealtimeClient,
  sessionToken: SessionToken,
  characterId: CharacterId,
  requestedZoneId?: ZoneId,
): Promise<Room<RoomState>> {
  const roomKind = resolveRoomKindForZoneId(requestedZoneId);
  if (roomKind === "combat") {
    return joinCombatRoom(client, sessionToken, characterId, requestedZoneId);
  }

  return joinTownRoom(client, sessionToken, characterId, requestedZoneId);
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
    roomKind: roomState.roomKind ?? state.kind ?? "town",
    zoneId: typeof state.zoneId === "string" && state.zoneId.length > 0 ? state.zoneId : "unknown",
    playerCount: typeof state.connectedPlayerCount === "number" ? state.connectedPlayerCount : 0,
  };
}
