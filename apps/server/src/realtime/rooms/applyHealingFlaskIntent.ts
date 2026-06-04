import type { PlayerPresence } from "./PlayerPresence";
import {
  HEALING_FLASK_HEAL_AMOUNT,
  consumeFlaskCooldown,
  isFlaskReady,
} from "./healingFlaskConfig";

// ---------------------------------------------------------------------------
// Task 096 — Basic Healing Flask Foundation.
//
// Server-authoritative application of a `request_use_healing_flask`
// intent. The helper is intentionally small and isolated so the
// TownRoom file stays a thin Colyseus shell.
//
// Decision order (mirrors the Task 096 spec):
//   1. The player must be alive (lifeState === "alive").
//   2. The flask must have at least one charge.
//   3. The flask must not be on cooldown.
//   4. The player must not already be at full HP (rejected with
//      "already_full_hp" so the client can show safe "full HP"
//      feedback).
//
// On acceptance the helper:
//   - heals a fixed `HEALING_FLASK_HEAL_AMOUNT` HP,
//   - clamps the result to maxHp,
//   - decrements flaskCharges by 1,
//   - consumes the cooldown (sets nextFlaskAt to now + cooldown).
//
// The helper does NOT:
//   - validate the intent shape (caller must have run
//     validateHealingFlaskIntent first),
//   - decide what the resulting HP should be from client input,
//   - persist anything,
//   - send any message back to the client (the room handler does that).
// ---------------------------------------------------------------------------

export type ApplyHealingFlaskResult =
  | {
      readonly ok: true;
      readonly healedAmount: number;
      readonly remainingHp: number;
      readonly flaskCharges: number;
      readonly nextFlaskAt: number;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "player_downed"
        | "already_full_hp"
        | "no_charges"
        | "flask_on_cooldown";
    };

export interface ApplyHealingFlaskInput {
  readonly player: PlayerPresence;
  readonly now: number;
  /**
   * Optional override for the heal amount. Default is the
   * server-owned `HEALING_FLASK_HEAL_AMOUNT`. Kept for symmetry with
   * the dodge apply helper and to make tests trivial.
   */
  readonly healAmount?: number;
}

export function applyHealingFlaskIntent(
  input: ApplyHealingFlaskInput,
): ApplyHealingFlaskResult {
  const { player, now } = input;
  const healAmount = input.healAmount ?? HEALING_FLASK_HEAL_AMOUNT;

  if (player.lifeState !== "alive") {
    return { ok: false, reason: "player_downed" };
  }

  if (player.flaskCharges <= 0) {
    return { ok: false, reason: "no_charges" };
  }

  if (!isFlaskReady(player, now)) {
    return { ok: false, reason: "flask_on_cooldown" };
  }

  const maxHp = Number.isFinite(player.maxHp) ? Math.max(0, player.maxHp) : 0;
  if (player.hp >= maxHp) {
    return { ok: false, reason: "already_full_hp" };
  }

  const safeHealAmount = Number.isFinite(healAmount) && healAmount > 0 ? healAmount : 0;
  const proposed = player.hp + safeHealAmount;
  const remainingHp = Math.min(maxHp, proposed);
  const healedAmount = Math.max(0, remainingHp - player.hp);

  player.hp = remainingHp;
  player.flaskCharges = Math.max(0, player.flaskCharges - 1);
  const nextFlaskAt = consumeFlaskCooldown(player, now);

  return {
    ok: true,
    healedAmount,
    remainingHp,
    flaskCharges: player.flaskCharges,
    nextFlaskAt,
  };
}
