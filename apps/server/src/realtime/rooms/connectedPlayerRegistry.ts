import type { Client } from "colyseus";

/**
 * Tracks which live Colyseus client (in which room) currently owns each
 * connected character, so server-side mutations that happen outside any
 * room's message loop (equip/unequip go through the HTTP `/equip` and
 * `/unequip` routes, not a room message) can still push a message to the
 * character's live session. A character can only be joined into one
 * room (Town or Combat) at a time, so a single map entry is enough.
 */
const connectedPlayersByCharacterId = new Map<string, Client>();

export function registerConnectedPlayer(characterId: string, client: Client): void {
  connectedPlayersByCharacterId.set(characterId, client);
}

export function unregisterConnectedPlayer(characterId: string, client: Client): void {
  const existing = connectedPlayersByCharacterId.get(characterId);
  if (existing !== undefined && existing.sessionId === client.sessionId) {
    connectedPlayersByCharacterId.delete(characterId);
  }
}

export function sendToConnectedPlayer(characterId: string, type: string, payload: unknown): void {
  const client = connectedPlayersByCharacterId.get(characterId);
  if (client === undefined) {
    return;
  }

  try {
    client.send(type, payload);
  } catch {
    // The client disconnected between lookup and send; nothing to do.
  }
}
