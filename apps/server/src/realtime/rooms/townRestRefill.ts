import type { PlayerPresence } from "./PlayerPresence";
import { restoreFlaskToFull } from "./healingFlaskConfig";

// ---------------------------------------------------------------------------
// Task 299 — Town Rest Refill Foundation.
//
// Server-authoritative helper that restores a player's core survival
// state (HP, healing flask charges) when they enter a valid town zone.
// This is the Diablo-style "rest in town" refill: stepping into a safe
// zone fully heals and refills the flask without any player input.
//
// CURRENT (0.2) BEHAVIOR:
//   applyTownRestRefill() is called once from TownRoom.onJoin(), so the
//   refill triggers only when the player enters the room (initial join
//   after login, or reconnect/refresh). It does NOT trigger on re-entry
//   from a combat zone — you must leave and re-join TownRoom for the
//   refill to fire again.
//
// FUTURE BEHAVIOR (not implemented):
//   - A physical "rest area" or "replenish aura" boundary inside the
//     town zone could re-trigger the refill whenever the player walks
//     into it, or on a periodic tick while standing in it.
//   - A dedicated "rest shrine" interactable could apply a one-shot
//     refill when activated.
//   - Fully "safe zone" rules could also suppress enemy aggro, but
//     that is a separate system (no safe-zone combat enforcement in 0.2).
//
// The function mutates the PlayerPresence in place (Colyseus schema
// syncs the changes to the client automatically) and returns the
// restored values so the caller can send a feedback message.
//
// Out of scope:
//   - mana / class-resource restoration (no resource system yet)
//   - debuff / poison / bleed cleansing
//   - equipment durability
//   - cooldown reset beyond flask
//   - rest UI panel or animation
//   - physical replenish boundary / aura
//   - rest shrine interactable
// ---------------------------------------------------------------------------

export interface TownRestRefillResult {
  /** HP after restoration (equal to maxHp). */
  readonly restoredHp: number;
  /** Flask charges after restoration (equal to maxFlaskCharges). */
  readonly restoredFlaskCharges: number;
  /** Whether any value actually changed (false if already full). */
  readonly changed: boolean;
}

/**
 * Restore the player's core survival state to full on entering a
 * valid town zone. This is intentionally limited to HP and healing
 * flask charges — mana / class resources will be added here once
 * those systems exist.
 *
 * The function is side-effect-free beyond mutating the supplied
 * `player` presence entry; it does not persist, does not broadcast
 * and does not send messages.
 */
export function applyTownRestRefill(player: PlayerPresence): TownRestRefillResult {
  const previousHp = player.hp;
  const previousFlask = Math.floor(player.flaskCharges);

  // Restore HP to max. The server owns maxHp from character stats
  // resolved at join time; we just clamp and assign.
  player.hp = Math.max(0, Math.floor(player.maxHp));

  // Restore flask charges to full via the existing helper which
  // resets charges, maxCharges and cooldown.
  restoreFlaskToFull(player);

  const restoredFlaskCharges = Math.floor(player.flaskCharges);

  const changed =
    player.hp !== previousHp ||
    restoredFlaskCharges !== previousFlask;

  return {
    restoredHp: player.hp,
    restoredFlaskCharges,
    changed,
  };
}