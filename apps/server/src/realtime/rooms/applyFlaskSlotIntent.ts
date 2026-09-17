import type { FlaskBeltSlotNumber } from "@doomscrolls/shared";
import type { PlayerPresence } from "./PlayerPresence";
import {
  consumeFlaskSlotCooldown,
  getFlaskSlotCharges,
  getFlaskSlotEffectType,
  getFlaskSlotEffectValue,
  getFlaskSlotMaxCharges,
  isFlaskSlotReady,
  setFlaskSlotCharges,
} from "./flaskBeltConfig";

// ---------------------------------------------------------------------------
// Milestone 0.3 -- 4-Slot Flask Belt.
//
// Server-authoritative application of a `request_use_flask_slot` intent.
// Generalizes the old single healing-flask helper to 4 independently
// cooling-down slots, each resolving its effect from whatever item is
// currently equipped in it (cached on the presence at equip time -- see
// `flaskBeltConfig.ts`), instead of a hardcoded heal amount.
//
// Decision order:
//   1. The player must be alive.
//   2. The slot must have an equipped flask (maxCharges > 0, effect type set).
//   3. The slot must have at least one charge.
//   4. The slot must not be on cooldown.
//   5. The effect must actually do something (not already full HP/mana).
//
// On acceptance the helper applies the slot's effect, decrements its
// charge and starts its cooldown. It does NOT validate the intent
// shape, persist anything, or send any message -- the room handler
// does that.
// ---------------------------------------------------------------------------

export type ApplyFlaskSlotResult =
  | {
      readonly ok: true;
      readonly effectType: string;
      readonly healedAmount: number;
      readonly remainingHp: number;
      readonly remainingMana: number;
      readonly charges: number;
      readonly nextReadyAt: number;
    }
  | {
      readonly ok: false;
      readonly reason: "player_downed" | "slot_empty" | "no_charges" | "flask_on_cooldown" | "no_effect";
    };

export interface ApplyFlaskSlotInput {
  readonly player: PlayerPresence;
  readonly slot: FlaskBeltSlotNumber;
  readonly now: number;
}

export function applyFlaskSlotIntent(input: ApplyFlaskSlotInput): ApplyFlaskSlotResult {
  const { player, slot, now } = input;

  if (player.lifeState !== "alive") {
    return { ok: false, reason: "player_downed" };
  }

  const effectType = getFlaskSlotEffectType(player, slot);
  const maxCharges = getFlaskSlotMaxCharges(player, slot);
  if (effectType.length === 0 || maxCharges <= 0) {
    return { ok: false, reason: "slot_empty" };
  }

  if (getFlaskSlotCharges(player, slot) <= 0) {
    return { ok: false, reason: "no_charges" };
  }

  if (!isFlaskSlotReady(player, slot, now)) {
    return { ok: false, reason: "flask_on_cooldown" };
  }

  const value = getFlaskSlotEffectValue(player, slot);
  const effectResult = applyFlaskEffect(player, effectType, value);
  if (!effectResult.ok) {
    return { ok: false, reason: "no_effect" };
  }

  setFlaskSlotCharges(player, slot, getFlaskSlotCharges(player, slot) - 1);
  const nextReadyAt = consumeFlaskSlotCooldown(player, slot, now);

  return {
    ok: true,
    effectType,
    healedAmount: effectResult.healedAmount,
    remainingHp: player.hp,
    remainingMana: player.mana,
    charges: getFlaskSlotCharges(player, slot),
    nextReadyAt,
  };
}

function applyFlaskEffect(
  player: PlayerPresence,
  effectType: string,
  value: number,
): { readonly ok: true; readonly healedAmount: number } | { readonly ok: false } {
  const safeValue = Number.isFinite(value) && value > 0 ? value : 0;

  if (effectType === "restoreHpInstant") {
    const maxHp = Math.max(0, player.maxHp);
    if (player.hp >= maxHp) {
      return { ok: false };
    }
    const remainingHp = Math.min(maxHp, player.hp + safeValue);
    const healedAmount = Math.max(0, remainingHp - player.hp);
    player.hp = remainingHp;
    return { ok: true, healedAmount };
  }

  if (effectType === "restoreManaInstant") {
    const maxMana = Math.max(0, player.maxMana);
    if (player.mana >= maxMana) {
      return { ok: false };
    }
    const remainingMana = Math.min(maxMana, player.mana + safeValue);
    const restoredAmount = Math.max(0, remainingMana - player.mana);
    player.mana = remainingMana;
    return { ok: true, healedAmount: restoredAmount };
  }

  if (effectType === "restoreStaminaInstant") {
    // No stamina resource pool exists in this game; the stamina/utility
    // flask instead shaves `value` milliseconds off the dodge cooldown.
    if (player.nextDodgeAt <= 0) {
      return { ok: false };
    }
    player.nextDodgeAt = Math.max(0, player.nextDodgeAt - safeValue);
    return { ok: true, healedAmount: 0 };
  }

  return { ok: false };
}
