import type { EnemyPresence } from "@doomscrolls/shared";
import type { PlayerPresence } from "./PlayerPresence";
import { applyEnemyDamage } from "./applyEnemyDamage";
import { clearPendingAction } from "./pendingActionState";
import { spawnWorldLootOnEnemyDefeat } from "./spawnWorldLootOnEnemyDefeat";
import { tickStatusEffectDamage } from "./statusEffects";

interface StatusEffectTickState {
  readonly playerPresence: { forEach: (fn: (player: PlayerPresence) => void) => void };
  readonly enemies: { forEach: (fn: (enemy: EnemyPresence) => void) => void };
}

export interface ApplyStatusEffectTicksOptions {
  /**
   * Called after a player's hp is dropped to 0 by a bleed/burn tick and
   * `lifeState`/`hasMovementTarget`/pending action are already cleared.
   * TownRoom uses this to stamp corpse fields and persist a corpse
   * (mirroring its enemy-attack death handling); CombatRoom has no
   * corpse system and omits it.
   */
  readonly onPlayerDowned?: (player: PlayerPresence) => void;
}

/**
 * Core 0.2 -- Server-Authoritative Status Effects & Debuff System.
 * Runs once per room simulation tick: decays every active effect on
 * every player/enemy and applies any bleed/burn DoT tick(s) that came
 * due. Movement prevention (stun) and speed reduction (slow) are read
 * directly off `statusEffects` at their own point of use (movement
 * stepping / enemy AI); this only owns decay + damage-over-time, shared
 * by both `TownRoom` and `CombatRoom` so the logic isn't duplicated
 * across rooms (see docs/CODING_RULES.md's Realtime Room File-Size
 * Guard).
 */
export function applyStatusEffectTicks(
  state: StatusEffectTickState,
  now: number,
  options?: ApplyStatusEffectTicksOptions,
): void {
  state.playerPresence.forEach((player) => {
    const dotDamage = tickStatusEffectDamage(player, now);
    if (dotDamage <= 0 || player.lifeState !== "alive" || player.hp <= 0) {
      return;
    }

    // DoT damage bypasses armor -- it represents an already-applied
    // wound/burn ticking down, not a fresh incoming hit to mitigate.
    const nextHp = Math.max(0, player.hp - dotDamage);
    player.hp = nextHp;
    if (nextHp <= 0) {
      player.lifeState = "downed";
      player.hasMovementTarget = false;
      clearPendingAction(player);
      options?.onPlayerDowned?.(player);
    }
  });

  state.enemies.forEach((enemy) => {
    if (enemy.defeated) {
      return;
    }
    const dotDamage = tickStatusEffectDamage(enemy, now);
    if (dotDamage <= 0) {
      return;
    }
    const damageResult = applyEnemyDamage(enemy, dotDamage);
    if (damageResult.defeated) {
      // No attacking player is tracked for a DoT tick, so this awards
      // loot (same as any other defeat) but not kill XP/objective
      // credit -- unlike a direct skill/basic-attack hit, which always
      // has one.
      spawnWorldLootOnEnemyDefeat(state as never, enemy, now);
    }
  });
}
