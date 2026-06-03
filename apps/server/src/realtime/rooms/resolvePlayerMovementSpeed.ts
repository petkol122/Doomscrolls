import type { CharacterDetails } from "@doomscrolls/shared";

/**
 * Safe server runtime fallback for town-room movement when character-derived
 * stats are unavailable or invalid.
 */
export const TOWN_MOVEMENT_SPEED_FALLBACK_UNITS_PER_SECOND = 180;

/**
 * Resolve the authoritative runtime movement speed for a joined character.
 *
 * Prefers the persisted/derived character stat when it is a finite positive
 * number. Falls back to a safe room default otherwise.
 */
export function resolvePlayerMovementSpeed(
  character: Pick<CharacterDetails, "stats">,
): number {
  const candidate = character.stats.derived.moveSpeed;

  if (Number.isFinite(candidate) && candidate > 0) {
    return candidate;
  }

  return TOWN_MOVEMENT_SPEED_FALLBACK_UNITS_PER_SECOND;
}