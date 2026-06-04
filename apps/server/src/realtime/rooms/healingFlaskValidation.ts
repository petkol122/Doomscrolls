import type {
  RequestUseHealingFlaskClientMessage,
  RequestUseHealingFlaskRejectedReason,
} from "@doomscrolls/shared";

// ---------------------------------------------------------------------------
// Task 096 — Basic Healing Flask Foundation.
//
// Tiny shape validator for `request_use_healing_flask` intents. The
// payload is intentionally a unit message (no client-controlled
// direction, target or amount), so the only failure mode is a
// malformed message. Life-state / cooldown / charge count are not
// validated here -- those are gated by the room handler against the
// player presence so this helper stays pure and side-effect free.
// ---------------------------------------------------------------------------

export interface HealingFlaskIntentValidationInput {
  readonly message: unknown;
}

export type HealingFlaskIntentValidationResult =
  | { readonly ok: true; readonly message: RequestUseHealingFlaskClientMessage }
  | { readonly ok: false; readonly reason: RequestUseHealingFlaskRejectedReason };

export function validateHealingFlaskIntent(
  input: HealingFlaskIntentValidationInput,
): HealingFlaskIntentValidationResult {
  const value = input.message;
  if (!isRequestUseHealingFlaskShaped(value)) {
    return { ok: false, reason: "player_downed" };
  }
  return { ok: true, message: value };
}

function isRequestUseHealingFlaskShaped(
  value: unknown,
): value is RequestUseHealingFlaskClientMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.type === "request_use_healing_flask";
}
