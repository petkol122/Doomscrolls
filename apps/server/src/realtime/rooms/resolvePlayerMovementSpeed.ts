import type { CharacterDetails } from "@doomscrolls/shared";

/**
 * Safe server runtime fallback for town-room movement when character-derived
 * stats are unavailable or invalid.
 */
export const TOWN_MOVEMENT_SPEED_FALLBACK_UNITS_PER_SECOND = 220;

/**
 * Converts the character-derived moveSpeed stat into practical runtime
 * world-units-per-second for the current small Nightmarket test arena.
 */
export const TOWN_MOVEMENT_SPEED_UNITS_PER_SECOND_MULTIPLIER = 220;

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
    return candidate * TOWN_MOVEMENT_SPEED_UNITS_PER_SECOND_MULTIPLIER;
  }

  return TOWN_MOVEMENT_SPEED_FALLBACK_UNITS_PER_SECOND;
}