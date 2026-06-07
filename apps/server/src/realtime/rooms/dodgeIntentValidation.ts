import type { RequestDodgeRejectedReason } from "@doomscrolls/shared";

// ---------------------------------------------------------------------------
// Task 095 — Player Dodge Intent Foundation.
//
// Server-side validator for `request_dodge` client intents. Mirrors
// the shape of `validateMovementIntent` (Task 026):
//
//   - validates intent SHAPE (must look like RequestDodgeClientMessage)
//   - validates the direction components are finite numbers
//   - validates the direction is not the zero vector
//
// Out of scope (deferred to later tasks):
//   - stamina / resource cost
//   - invulnerability frames beyond range escape
//   - animation system
//   - skill system
//   - roll collision / pathfinding
//   - client prediction
//
// This helper is intentionally generic across future combat, dungeon
// and boss rooms. It does not know about TownRoom, CombatRoom or any
// specific zone. It does NOT check cooldown or life state — those
// are gated by the room handler using the player presence so the
// helper stays pure and side-effect free.
// ---------------------------------------------------------------------------

export interface DodgeIntentValidationInput {
  /**
   * Raw, untrusted message payload as received from the client. The
   * validator only reads `type`, `dirX` and `dirY`; any other fields
   * are ignored.
   */
  readonly message: unknown;
}

export type DodgeIntentValidationResult =
  | {
      readonly ok: true;
      readonly dirX: number;
      readonly dirY: number;
    }
  | {
      readonly ok: false;
      readonly reason: RequestDodgeRejectedReason;
    };

interface RequestDodgeShape {
  readonly type: "request_dodge";
  readonly dirX: number;
  readonly dirY: number;
}

export function validateDodgeIntent(
  input: DodgeIntentValidationInput,
): DodgeIntentValidationResult {
  const message = input.message;

  if (!isRequestDodgeShaped(message)) {
    return { ok: false, reason: "invalid_shape" };
  }

  if (!Number.isFinite(message.dirX) || !Number.isFinite(message.dirY)) {
    return { ok: false, reason: "non_finite_direction" };
  }

  if (message.dirX === 0 && message.dirY === 0) {
    return { ok: false, reason: "zero_direction" };
  }

  return { ok: true, dirX: message.dirX, dirY: message.dirY };
}

function isRequestDodgeShaped(value: unknown): value is RequestDodgeShape {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== "request_dodge") {
    return false;
  }
  if (typeof candidate.dirX !== "number") {
    return false;
  }
  if (typeof candidate.dirY !== "number") {
    return false;
  }
  return true;
}
