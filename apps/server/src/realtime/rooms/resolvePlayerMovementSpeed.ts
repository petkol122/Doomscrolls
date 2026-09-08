/**
 * Safe server runtime fallback for town-room movement when character-derived
 * stats are unavailable or invalid.
 */
export const TOWN_MOVEMENT_SPEED_FALLBACK_UNITS_PER_SECOND = 220;

/**
 * Converts the character-derived moveSpeed stat into practical runtime
 * world-units-per-second for the current small town test arena.
 * Shared by TownRoom and CombatRoom (both call this same function at
 * join) and by EquipmentService's live mid-session push (Core 0.31) --
 * there is only ever one player movement-speed scale in this codebase.
 * Unrelated to `toWorldUnits`'s separate x24 tile-to-pixel conversion
 * used for enemy aggro/leash ranges -- mixing the two up is exactly the
 * bug Core 0.24 found and fixed for enemy moveSpeed (see
 * `docs/CORE_BUILD_0_31_RELEASE_NOTES.md`).
 */
export const TOWN_MOVEMENT_SPEED_UNITS_PER_SECOND_MULTIPLIER = 220;

/**
 * Resolve the authoritative runtime movement speed from a raw
 * character-derived `moveSpeed` stat.
 *
 * Takes the raw stat value directly (not a full `CharacterDetails`)
 * so it can be reused from anywhere a recalculated `moveSpeed` number
 * is available, not only at room join -- see
 * `EquipmentService.recalculateEquippedCharacterStats`, which has no
 * `CharacterDetails` object to read from, only the freshly computed
 * derived stats themselves.
 *
 * Prefers the given stat when it is a finite positive number. Falls
 * back to a safe room default otherwise.
 */
export function resolvePlayerMovementSpeed(
  moveSpeedStat: number | null | undefined,
): number {
  if (Number.isFinite(moveSpeedStat) && (moveSpeedStat as number) > 0) {
    return (moveSpeedStat as number) * TOWN_MOVEMENT_SPEED_UNITS_PER_SECOND_MULTIPLIER;
  }

  return TOWN_MOVEMENT_SPEED_FALLBACK_UNITS_PER_SECOND;
}