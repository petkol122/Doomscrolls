import { contentRegistry } from "@doomscrolls/content";
import type { ZoneContentId, ZoneContentRestAreaBounds } from "@doomscrolls/content";
import { applyTownRestRefill } from "./townRestRefill";
import type { PlayerPresence } from "./PlayerPresence";

// ---------------------------------------------------------------------------
// Task 303 — Physical Town Rest Area Trigger.
//
// Server-authoritative helper that checks whether a player is standing
// inside the zone's defined rest area (if any) and, if so, applies the
// town rest refill (HP + healing flask charges). This runs on each
// movement tick so the refill triggers when the player walks into or
// stands in the area.
//
// BEHAVIOR:
//   - Reads `restAreaBounds` from the zone content definition.
//   - If the zone has no rest area bounds, the check is a no-op.
//   - If the player's current x,y falls inside those bounds, calls
//     `applyTownRestRefill()` and reports whether values changed.
//   - Avoids message spam: the caller (simulation tick) receives a
//     per-player "changed" flag and should send the localized notice
//     only on first entry or when values actually change (e.g. after
//     taking damage while still in the area).
//   - The refill runs every tick while the player is inside, but
//     `applyTownRestRefill` internally detects "already full" and
//     returns `changed: false`, which the caller can use to suppress
//     repeated notification messages.
//
// OUT OF SCOPE:
//   - Cooldown/throttle (not needed since applyTownRestRefill returns
//     changed:false for already-full players, so the caller can skip
//     repeat messages without a separate throttle).
//   - Safe-zone combat enforcement.
//   - Rest shrine UI panel.
//   - Mana / class resource restoration (no resource system yet).
// ---------------------------------------------------------------------------

export interface TownRestAreaTriggerResult {
  /** Whether the refill actually changed player values. */
  readonly changed: boolean;
}

/**
 * Resolve the rest area bounds for the given zone id. Returns undefined
 * if the zone has no rest area defined.
 */
function resolveZoneRestAreaBounds(zoneId: string): ZoneContentRestAreaBounds | undefined {
  const zoneDefinition = contentRegistry.zones.get(zoneId as ZoneContentId);
  if (zoneDefinition === undefined) {
    return undefined;
  }
  return zoneDefinition.restAreaBounds;
}

/**
 * Check whether a point (px, py) is inside the given rectangular bounds.
 */
function isInsideBounds(
  px: number,
  py: number,
  bounds: ZoneContentRestAreaBounds,
): boolean {
  return (
    px >= bounds.minX &&
    px <= bounds.maxX &&
    py >= bounds.minY &&
    py <= bounds.maxY
  );
}

/**
 * Apply the town rest area refill for one player.
 *
 * Returns a result indicating whether any values actually changed, so the
 * caller can decide whether to send a notification message.
 *
 * This function is side-effect-free beyond mutating the supplied `player`
 * presence entry; it does not persist, does not broadcast, and does not
 * send messages.
 */
export function applyTownRestAreaRefill(
  zoneId: string,
  player: PlayerPresence,
): TownRestAreaTriggerResult {
  const bounds = resolveZoneRestAreaBounds(zoneId);
  if (bounds === undefined) {
    return { changed: false };
  }

  // Only refill if the player is inside the rest area bounds.
  if (!isInsideBounds(player.x, player.y, bounds)) {
    return { changed: false };
  }

  // Player must be alive to benefit from rest area refill.
  if (player.lifeState !== "alive") {
    return { changed: false };
  }

  const refillResult = applyTownRestRefill(player);
  return { changed: refillResult.changed };
}

/**
 * Run the town rest area check for all players in the room.
 *
 * Intended to be called from the room simulation tick. Returns a map of
 * sessionId -> changed boolean so the caller can send individual notification
 * messages only when values actually changed.
 *
 * @param zoneId - The current zone id (from room state).
 * @param playerPresence - A Map-like iterable of PlayerPresence keyed by sessionId.
 * @returns A map of sessionIds whose refill actually changed values.
 */
export function applyTownRestAreaRefillForAll(
  zoneId: string,
  playerPresence: ReadonlyMap<string, PlayerPresence> | { forEach(fn: (player: PlayerPresence, sessionId: string) => void): void },
): Map<string, boolean> {
  const changedPlayers = new Map<string, boolean>();

  if (typeof (playerPresence as Map<string, PlayerPresence>).forEach === "function") {
    (playerPresence as Map<string, PlayerPresence>).forEach((player, sessionId) => {
      const result = applyTownRestAreaRefill(zoneId, player);
      if (result.changed) {
        changedPlayers.set(sessionId, true);
      }
    });
  }

  return changedPlayers;
}