/**
 * Safe server runtime fallback for town-room movement when character-derived
 * stats are unavailable or invalid.
 * Milestone 0.3 scale/speed pass -- cut ~22% from 220 so crossing Namesti
 * Republiky on foot feels grounded instead of instant (paired with the
 * ~20% entity-scale reduction in worldSessionAreaView.ts/worldSessionEnemyPlaceholderView.ts).
 */
export const TOWN_MOVEMENT_SPEED_FALLBACK_UNITS_PER_SECOND = 172;

/**
 * Converts the character-derived moveSpeed stat into practical runtime
 * world-units-per-second for the real-world-scaled Namesti Republiky
 * town zone (see docs/CORE_BUILD_0_33_PLAN.md, docs/CORE_BUILD_0_35_*).
 * Shared by TownRoom and CombatRoom (both call this same function at
 * join) and by EquipmentService's live mid-session push (Core 0.31) --
 * there is only ever one player COMBAT movement-speed scale in this
 * codebase. Safe/town-zone movement is faster than this (see
 * `SAFE_ZONE_MOVEMENT_SPEED_MULTIPLIER` below), but that multiplier is
 * applied on top of this value at the call site, never by changing it.
 * Unrelated to `toWorldUnits`'s separate x24 tile-to-pixel conversion
 * used for enemy aggro/leash ranges -- mixing the two up is exactly the
 * bug Core 0.24 found and fixed for enemy moveSpeed (see
 * `docs/CORE_BUILD_0_31_RELEASE_NOTES.md`).
 * Milestone 0.3 scale/speed pass -- baseline cut ~22% (220 -> 172); this
 * only tunes the PLAYER scale, not `ENEMY_MOVEMENT_SPEED_UNITS_PER_SECOND_MULTIPLIER`
 * in TownRoom.ts, which stays at 220 so combat pacing against enemies is
 * unaffected.
 */
export const TOWN_MOVEMENT_SPEED_UNITS_PER_SECOND_MULTIPLIER = 172;

/**
 * Core 0.4x -- how much faster movement is in a safe_hub-classified zone
 * (walking around town) than the shared combat movement-speed scale
 * above. Applied only at the TownRoom simulation-interval call site
 * (`stepTownRoomMovement`'s optional `movementSpeedMultiplier`), never
 * to `PlayerPresence.movementSpeed` itself -- CombatRoom's call site
 * passes no multiplier (defaults to 1x) and is completely unaffected.
 *
 * First-pass math (updated after an initial live look at 7x felt too
 * fast): the cathedral building footprint (`bldg_svaty_bartolomej` in
 * worldProps.ts) has a real perimeter of ~7035 world units. At the base
 * town speed (moveSpeed ~1.0-1.02 x 220 = ~220-224 units/sec), walking
 * that loop takes ~31-32 real seconds. 4x brought that down to ~8s, which
 * a later live look (once the default camera zoom went up, see
 * `AREA_DEFAULT_CAMERA_ZOOM` in worldSessionAreaView.ts) read as too fast
 * again for the now-bigger-looking buildings -- the extra zoom makes the
 * same world-units-per-second cross more screen distance per second, so
 * the two changes compound. Dropped to 2x (~16s for the same loop) to
 * bring travel pacing back down while keeping some speed-up over combat.
 * Still a first pass, tunable from here. (Base multiplier above was later
 * cut 220 -> 172; this ratio wasn't re-tuned against it, so travel times
 * above are now proportionally slower too.)
 */
export const SAFE_ZONE_MOVEMENT_SPEED_MULTIPLIER = 2;

/**
 * Resolves the movement-speed multiplier to apply for a given zone
 * classification. Only `"safe_hub"` zones move faster than the shared
 * combat pacing -- this is a classification check, not a zoneId check,
 * so any future safe_hub zone gets the same treatment automatically
 * without this function (or its caller) needing to change.
 */
export function resolveSafeZoneMovementSpeedMultiplier(
  zoneClassification: string | undefined,
): number {
  return zoneClassification === "safe_hub" ? SAFE_ZONE_MOVEMENT_SPEED_MULTIPLIER : 1;
}

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