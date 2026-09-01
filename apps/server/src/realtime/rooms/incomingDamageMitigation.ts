/**
 * Core 0.11 -- shared mitigation formula for enemy attacks landing on a
 * player, so `CombatRoom.ts` and `TownRoom.ts` (the only two rooms with
 * an enemy-initiated damage path) apply the exact same rule.
 *
 * Floor-preserving and additive, mirroring `CharacterStatsService`'s own
 * `damage = 1 + power` floor philosophy (see `resolveSkillCastDamage` in
 * `skillSlotContent.ts`, which floors the other half of combat the same
 * way): armor reduces a hit point-for-point but can never grant total
 * immunity -- a landed attack always costs at least 1 HP.
 */
export function mitigateIncomingDamage(rawDamage: number, playerArmor: number): number {
  const normalizedRawDamage = Number.isFinite(rawDamage) ? Math.max(0, Math.floor(rawDamage)) : 0;
  const normalizedArmor = Number.isFinite(playerArmor) ? Math.max(0, playerArmor) : 0;
  return Math.max(1, normalizedRawDamage - normalizedArmor);
}
