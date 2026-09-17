import type { RequestUseFlaskSlotClientMessage, RequestUseFlaskSlotRejectedReason } from "@doomscrolls/shared";

// ---------------------------------------------------------------------------
// Milestone 0.3 -- 4-Slot Flask Belt.
//
// Tiny shape validator for `request_use_flask_slot` intents. Only
// checks the message shape (type + slot 1-4) -- life-state / cooldown /
// charge count / equipped-item checks are gated by
// `applyFlaskSlotIntent` against the player presence, so this helper
// stays pure and side-effect free.
// ---------------------------------------------------------------------------

export interface FlaskSlotIntentValidationInput {
  readonly message: unknown;
}

export type FlaskSlotIntentValidationResult =
  | { readonly ok: true; readonly message: RequestUseFlaskSlotClientMessage }
  | { readonly ok: false; readonly reason: RequestUseFlaskSlotRejectedReason };

export function validateFlaskSlotIntent(
  input: FlaskSlotIntentValidationInput,
): FlaskSlotIntentValidationResult {
  const value = input.message;
  if (!isRequestUseFlaskSlotShaped(value)) {
    return { ok: false, reason: "slot_empty" };
  }
  return { ok: true, message: value };
}

function isRequestUseFlaskSlotShaped(value: unknown): value is RequestUseFlaskSlotClientMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "request_use_flask_slot"
    && (candidate.slot === 1 || candidate.slot === 2 || candidate.slot === 3 || candidate.slot === 4)
  );
}
