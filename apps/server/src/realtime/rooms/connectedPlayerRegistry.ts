import type { Client, Room } from "colyseus";
import type { PlayerPresence } from "./PlayerPresence";

/**
 * Structural shape shared by TownRoomState and CombatRoomState -- both
 * declare `playerPresence` as a `MapSchema<PlayerPresence>` keyed by
 * sessionId. Kept structural (not imported from either concrete state
 * class) so this registry stays usable from either room without a
 * dependency on one or the other.
 */
interface RoomStateWithPlayerPresence {
  readonly playerPresence: {
    get(sessionId: string): PlayerPresence | undefined;
  };
}

interface ConnectedPlayerEntry {
  readonly client: Client;
  readonly room: Room;
}

/**
 * Tracks which live Colyseus client (in which room) currently owns each
 * connected character, so server-side mutations that happen outside any
 * room's message loop (equip/unequip go through the HTTP `/equip` and
 * `/unequip` routes, not a room message) can still reach the character's
 * live session -- both to push a message to the client, and to update its
 * live `PlayerPresence` fields directly. A character can only be joined
 * into one room (Town or Combat) at a time, so a single map entry is
 * enough.
 */
const connectedPlayersByCharacterId = new Map<string, ConnectedPlayerEntry>();

export function registerConnectedPlayer(characterId: string, client: Client, room: Room): void {
  connectedPlayersByCharacterId.set(characterId, { client, room });
}

export function unregisterConnectedPlayer(characterId: string, client: Client): void {
  const existing = connectedPlayersByCharacterId.get(characterId);
  if (existing !== undefined && existing.client.sessionId === client.sessionId) {
    connectedPlayersByCharacterId.delete(characterId);
  }
}

export function sendToConnectedPlayer(characterId: string, type: string, payload: unknown): void {
  const entry = connectedPlayersByCharacterId.get(characterId);
  if (entry === undefined) {
    return;
  }

  try {
    entry.client.send(type, payload);
  } catch {
    // The client disconnected between lookup and send; nothing to do.
  }
}

interface LivePlayerCombatStats {
  readonly damage: number;
  readonly armor: number;
}

/**
 * Push recalculated damage/armor into the character's live `PlayerPresence`,
 * if currently connected to a room. Basic attacks and skill casts read
 * `player.damage` directly off this synced schema instance (see
 * `TownRoom`/`CombatRoom`'s attack and skill-cast handlers), and incoming
 * damage mitigation reads `player.armor` the same way -- neither is
 * recomputed from the database per-action. Without this, an equip/unequip
 * mid-session updates the database and (via `sendToConnectedPlayer`
 * above) the client's equipment panel, but silently leaves the actual
 * damage dealt / mitigation applied unchanged until the player leaves and
 * rejoins the room.
 */
export function updateConnectedPlayerLiveCombatStats(characterId: string, stats: LivePlayerCombatStats): void {
  const entry = connectedPlayersByCharacterId.get(characterId);
  if (entry === undefined) {
    return;
  }

  const state = entry.room.state as unknown as RoomStateWithPlayerPresence;
  const player = state.playerPresence.get(entry.client.sessionId);
  if (player === undefined) {
    return;
  }

  player.damage = stats.damage;
  player.armor = stats.armor;
}
