// Core 0.10 -- fallback matches CharacterStatsService's own derived-stat
// floor (`damage = 1 + power`, minimum power 0), so an unresolvable value
// behaves exactly like a zero-power, unequipped character rather than
// reintroducing a different hardcoded number.
export const DEFAULT_PLAYER_DAMAGE = 1;

export function resolvePlayerDamage(value: number | null | undefined): number {
  return Number.isFinite(value) && value !== undefined && value !== null && value >= 1
    ? value
    : DEFAULT_PLAYER_DAMAGE;
}
