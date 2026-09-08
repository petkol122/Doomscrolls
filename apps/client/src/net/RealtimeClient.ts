import { Client, Room } from "@colyseus/sdk";

import type { CharacterId, CharacterRuntimeRoomKind, CharacterSummary, SessionToken, ZoneId } from "@doomscrolls/shared";
import type { RoomJoinAuthPayload, RoomState } from "@doomscrolls/shared";
import { contentRegistry } from "@doomscrolls/content";
import { clientEnv } from "../config/env";
import { bufferEquipmentUpdatesFor } from "./equipmentUpdateBuffer";

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

  const room = await client.joinOrCreate("town", payload);
  bufferEquipmentUpdatesFor(room);
  return room;
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

  const room = await client.joinOrCreate("combat", payload);
  bufferEquipmentUpdatesFor(room);
  return room;
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
 * Core 0.32 — the join-flow body shared by every entry point into the
 * game world (today: `AccountShellScene`'s "Enter World" button).
 * Creates a fresh realtime client, resolves the selected character's
 * current zone, and joins the exact room `joinResolvedCharacterRoom`
 * already resolves to -- unchanged for a fresh character (lands in
 * Namesti Republiky) or a returning one (resumes wherever they were).
 * Extracted so both entry points call one real implementation, not two
 * copies of it.
 */
export async function enterWorldForCharacter(
  characters: readonly CharacterSummary[],
  characterId: CharacterId,
  sessionToken: SessionToken,
): Promise<Room<RoomState>> {
  const client = createRealtimeClient();
  const selectedCharacter = characters.find((character) => character.id === characterId) ?? null;
  return joinResolvedCharacterRoom(client, sessionToken, characterId, selectedCharacter?.currentZoneId);
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
