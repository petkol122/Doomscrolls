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
 * Task 025   — Client Position Read/Display Helper Only.
 */

import type {
  CharacterId,
  PlayerPosition,
  SpawnPointId,
} from "@doomscrolls/shared";

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
  /**
   * Server-synced world position.
   * Optional because older / partial state objects may not carry the field
   * yet; callers must treat absence as "unknown", not as "no position".
   * This is still not full gameplay movement — no animation, pathing,
   * collision, or interpolation is implied by this display helper.
   */
  readonly position?: PlayerPosition;
  /**
   * Server-synced runtime movement speed for this player, when present.
   * Optional because older / partial state objects may not carry the field
   * yet; callers must treat absence as "unknown", not as zero speed.
   */
  readonly movementSpeed?: number;
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
    forEach: (fn: (value: Record<string, unknown>, key: string) => void) => void;
  };

  const players: PlayerPresenceEntry[] = [];
  presenceMap.forEach((value) => {
    const baseEntry: PlayerPresenceEntry = {
      sessionId: String(value.sessionId ?? ""),
      characterId: (value.characterId ?? "") as CharacterId,
      displayName: String(value.displayName ?? ""),
    };

    const withSpawn = applyOptionalSpawnPoint(baseEntry, value);
    const withPosition = applyOptionalPosition(withSpawn, value);
    const withMovementSpeed = applyOptionalMovementSpeed(withPosition, value);
    players.push(withMovementSpeed);
  });

  return {
    connectedPlayerCount: presenceMap.size,
    players,
  };
}

function applyOptionalSpawnPoint(
  entry: PlayerPresenceEntry,
  value: Record<string, unknown>,
): PlayerPresenceEntry {
  const rawSpawnPointId = value.spawnPointId;
  if (typeof rawSpawnPointId !== "string" || rawSpawnPointId.length === 0) {
    return entry;
  }
  return {
    ...entry,
    spawnPointId: rawSpawnPointId as SpawnPointId,
  };
}

function applyOptionalPosition(
  entry: PlayerPresenceEntry,
  value: Record<string, unknown>,
): PlayerPresenceEntry {
  const rawX = value.x;
  const rawY = value.y;
  if (typeof rawX !== "number" || typeof rawY !== "number") {
    return entry;
  }
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
    return entry;
  }
  const position: PlayerPosition = { x: rawX, y: rawY };
  return { ...entry, position };
}

function applyOptionalMovementSpeed(
  entry: PlayerPresenceEntry,
  value: Record<string, unknown>,
): PlayerPresenceEntry {
  const rawMovementSpeed = value.movementSpeed;
  if (typeof rawMovementSpeed !== "number") {
    return entry;
  }
  if (!Number.isFinite(rawMovementSpeed) || rawMovementSpeed <= 0) {
    return entry;
  }
  return { ...entry, movementSpeed: rawMovementSpeed };
}
