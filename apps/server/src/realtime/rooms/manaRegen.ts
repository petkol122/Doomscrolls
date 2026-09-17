import type { PlayerPresence } from "./PlayerPresence";

/**
 * Core 0.1 Foundation -- Mana/Resource System.
 *
 * Passive mana regeneration applied on every simulation tick: 5% of
 * the player's max mana per second, scaled by the tick's own
 * `deltaMs` so the rate is frame/tick-rate independent. Clamped at
 * `maxMana`; a no-op for a downed player or a pool already full.
 */
const MANA_REGEN_PER_SECOND_RATIO = 0.05;

export function regenerateMana(player: PlayerPresence, deltaMs: number): void {
  if (player.lifeState !== "alive") {
    return;
  }
  if (!Number.isFinite(player.maxMana) || player.maxMana <= 0) {
    return;
  }
  if (!Number.isFinite(player.mana) || player.mana >= player.maxMana) {
    return;
  }
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return;
  }

  const regenAmount = player.maxMana * MANA_REGEN_PER_SECOND_RATIO * (deltaMs / 1000);
  player.mana = Math.min(player.maxMana, player.mana + regenAmount);
}

/**
 * Derives max mana from the character's `mind` stat. Deliberately not a
 * DB-persisted derived stat (unlike `maxHp`/`damage`/`armor`): mana
 * always resets to full on join/respawn, so no persistence is needed,
 * only a resolvable ceiling from the player's own stats.
 */
export function resolveMaxMana(mind: number | undefined): number {
  const safeMind = Number.isFinite(mind) ? Math.max(0, mind ?? 0) : 0;
  return 50 + safeMind * 10;
}
