// Core 0.11 -- fallback matches CharacterStatsService's own derived-stat
// base (`armor: 0` with no equipped modifiers), so an unresolvable value
// behaves exactly like an unarmored character rather than introducing a
// different hardcoded number.
export const DEFAULT_PLAYER_ARMOR = 0;

export function resolvePlayerArmor(value: number | null | undefined): number {
  return Number.isFinite(value) && value !== undefined && value !== null && value >= 0
    ? value
    : DEFAULT_PLAYER_ARMOR;
}
