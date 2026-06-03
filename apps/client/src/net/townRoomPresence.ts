/**
 * Client-side helper to extract player presence from a TownRoom Colyseus state.
 *
 * The shared `RoomState` interface does not include `playerPresence` because
 * that property is specific to the Colyseus `TownRoomState` schema.  At
 * runtime the room's `.state` *is* the schema object, so we can safely reach
 * `playerPresence` when it exists.
 *
 * This module isolates the schema‑aware access so callers don't need to
 * import Colyseus schema types directly.
 *
 * Task 022.2 — Client Presence Display Types Only.
 * Task 023.3 — Client Spawn Point Display Helper Only.
 */

import type { CharacterId, SpawnPointId } from "@doomscrolls/shared";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PlayerPresenceEntry {
  readonly sessionId: string;
  readonly characterId: CharacterId;
  readonly displayName: string;
  /**
   * Spawn point id assigned to the player by the server, when present.
   * Optional because older / partial state objects may not carry the field
   * yet; callers must treat absence as "unknown", not as "no spawn".
   */
  readonly spawnPointId?: SpawnPointId;
}

export interface TownRoomPresence {
  readonly connectedPlayerCount: number;
  readonly players: readonly PlayerPresenceEntry[];
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Extract player presence from a TownRoom Colyseus schema state.
 *
 * Returns `null` when the state has no `playerPresence` property (i.e. it is
 * not a TownRoom state or the field has not been synchronised yet).
 */
export function getTownRoomPresence(
  state: Record<string, unknown>,
): TownRoomPresence | null {
  const pp = state.playerPresence;

  if (pp === undefined || pp === null) {
    return null;
  }

  // Colyseus MapSchema objects expose a `forEach` method and forward `.size`.
  const presenceMap = pp as {
    readonly size: number;
    forEach: (fn: (value: Record<string, string>, key: string) => void) => void;
  };

  const players: PlayerPresenceEntry[] = [];
  presenceMap.forEach((value) => {
    const rawSpawnPointId = value.spawnPointId;
    const baseEntry: PlayerPresenceEntry = {
      sessionId: String(value.sessionId ?? ""),
      characterId: (value.characterId ?? "") as CharacterId,
      displayName: String(value.displayName ?? ""),
    };
    if (typeof rawSpawnPointId === "string" && rawSpawnPointId.length > 0) {
      const entryWithSpawn: PlayerPresenceEntry = {
        ...baseEntry,
        spawnPointId: rawSpawnPointId as SpawnPointId,
      };
      players.push(entryWithSpawn);
    } else {
      players.push(baseEntry);
    }
  });

  return {
    connectedPlayerCount: presenceMap.size,
    players,
  };
}
