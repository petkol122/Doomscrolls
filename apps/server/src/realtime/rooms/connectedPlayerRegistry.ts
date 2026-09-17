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

/**
 * Global Chat -- pushes to every currently connected client process-wide,
 * regardless of which room (Town zone or Combat zone) it is joined to.
 * This is the only place in the codebase that reaches "everyone", since
 * Colyseus's own `room.broadcast()` only reaches clients on one room
 * instance and CombatRoom is genuinely sharded per zone.
 */
export function broadcastToAllConnectedPlayers(type: string, payload: unknown): void {
  for (const entry of connectedPlayersByCharacterId.values()) {
    try {
      entry.client.send(type, payload);
    } catch {
      // The client disconnected mid-iteration; nothing to do.
    }
  }
}

interface LivePlayerCombatStats {
  readonly damage: number;
  readonly armor: number;
  /**
   * Core 0.31 -- runtime world-units-per-second, already converted via
   * `resolvePlayerMovementSpeed` (the same conversion TownRoom/
   * CombatRoom apply at join). Not the raw `moveSpeed` stat.
   */
  readonly movementSpeed: number;
  readonly attackCooldownMs: number;
}

/**
 * Push recalculated damage/armor/movementSpeed/attackCooldownMs into the
 * character's live `PlayerPresence`, if currently connected to a room.
 * Basic attacks and skill casts read `player.damage` directly off this
 * synced schema instance (see `TownRoom`/`CombatRoom`'s attack and
 * skill-cast handlers), incoming damage mitigation reads `player.armor`
 * the same way, the movement tick reads `player.movementSpeed`
 * (`stepTownRoomMovement`), and attack cadence reads
 * `player.attackCooldownMs` (`consumeAttackCooldown`) -- none of the
 * four is recomputed from the database per-action. Without this, an
 * equip/unequip mid-session updates the database and (via
 * `sendToConnectedPlayer` above) the client's equipment panel, but
 * silently leaves the player's actual damage dealt, mitigation applied,
 * movement rate, and attack cadence unchanged until the player leaves
 * and rejoins the room (or levels up, which happens to overwrite all
 * four as a side effect of its own unrelated recalculation).
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
  player.movementSpeed = stats.movementSpeed;
  player.attackCooldownMs = stats.attackCooldownMs;
}

/**
 * Milestone 0.3 -- 4-Slot Flask Belt. Reaches the character's live
 * `PlayerPresence` (if currently connected) for callers that need to
 * mutate more than the fixed combat-stat set above -- specifically
 * `EquipmentService`, which re-derives a flask belt slot's max
 * charges/effect straight from the just-equipped item on every
 * equip/unequip touching `flask_1`..`flask_4`.
 */
export function getConnectedPlayerPresence(characterId: string): PlayerPresence | undefined {
  const entry = connectedPlayersByCharacterId.get(characterId);
  if (entry === undefined) {
    return undefined;
  }
  const state = entry.room.state as unknown as RoomStateWithPlayerPresence;
  return state.playerPresence.get(entry.client.sessionId);
}
