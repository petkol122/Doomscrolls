import type { RequestMoveRejectedReason } from "@doomscrolls/shared";

// ---------------------------------------------------------------------------
// Movement intent validation (Task 026)
//
// Server-side validator for `request_move` client intents.
//
// Scope (intentionally narrow — this is a foundation batch):
//   - validates intent SHAPE (must look like a RequestMoveClientMessage)
//   - validates the target coordinates are finite numbers
//   - validates the target coordinates fall inside a conservative,
//     temporary numeric range
//
// Out of scope (deferred to later tasks):
//   - movement simulation
//   - position updates after join
//   - pathfinding
//   - collision detection
//   - map-aware bounds
//   - player-sprite / scene-based entity placement
//   - combat
//   - persistence
//
// This helper is intentionally generic across future combat, dungeon
// and boss rooms. It does not know about TownRoom, CombatRoom or any
// specific zone; rooms call it with a freshly received message and a
// caller-supplied `roomBounds`. Bounds are temporary until real map
// data exists; they are NOT gameplay tuning.
// ---------------------------------------------------------------------------

/**
 * Conservative, temporary numeric range for movement intent
 * coordinates. Generous enough to cover any Core 0.1 world position
 * (town, Blackwire Sewers, future combat rooms) without being wide
 * open to abuse. Bounds are NOT a map size — they are a temporary
 * guard against malformed/hostile inputs and may shrink once real
 * map data exists.
 */
export const DEFAULT_MOVEMENT_INTENT_BOUNDS: MovementIntentBounds = {
  minX: -1_000_000,
  maxX: 1_000_000,
  minY: -1_000_000,
  maxY: 1_000_000,
};

export interface MovementIntentBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface MovementIntentValidationInput {
  /**
   * Raw, untrusted message payload as received from the client. The
   * validator only reads `type`, `targetX`, `targetY` and `clientTime`;
   * any other fields are ignored.
   */
  readonly message: unknown;
  /**
   * Optional caller-supplied bounds. Defaults to
   * {@link DEFAULT_MOVEMENT_INTENT_BOUNDS} when omitted.
   */
  readonly bounds?: MovementIntentBounds;
}

export type MovementIntentValidationResult =
  | {
      readonly ok: true;
      readonly targetX: number;
      readonly targetY: number;
      readonly clientTime?: number;
    }
  | {
      readonly ok: false;
      readonly reason: RequestMoveRejectedReason;
    };

interface RequestMoveShape {
  readonly type: "request_move";
  readonly targetX: number;
  readonly targetY: number;
  readonly clientTime?: number;
}

/**
 * Validate the shape and range of a `request_move` client intent.
 *
 * Returns a discriminated result:
 *   - `{ ok: true, targetX, targetY, clientTime? }` when the intent is
 *     well-formed, has finite numeric targets, and the targets are
 *     inside the supplied bounds.
 *   - `{ ok: false, reason }` otherwise. The reason is one of the
 *     safe {@link RequestMoveRejectedReason} codes defined in
 *     `@doomscrolls/shared`.
 *
 * The function never throws and never mutates the input. It does not
 * log; callers are expected to log the rejection reason.
 */
export function validateMovementIntent(
  input: MovementIntentValidationInput,
): MovementIntentValidationResult {
  const message = input.message;

  if (!isRequestMoveShaped(message)) {
    return { ok: false, reason: "invalid_shape" };
  }

  const bounds = input.bounds ?? DEFAULT_MOVEMENT_INTENT_BOUNDS;

  return checkRange(message, bounds);
}

function checkRange(
  message: RequestMoveShape,
  bounds: MovementIntentBounds,
): MovementIntentValidationResult {
  if (
    !Number.isFinite(message.targetX) ||
    !Number.isFinite(message.targetY)
  ) {
    return { ok: false, reason: "non_finite_target" };
  }

  if (
    message.targetX < bounds.minX ||
    message.targetX > bounds.maxX ||
    message.targetY < bounds.minY ||
    message.targetY > bounds.maxY
  ) {
    return { ok: false, reason: "out_of_range" };
  }

  if (message.clientTime !== undefined && !Number.isFinite(message.clientTime)) {
    return { ok: false, reason: "invalid_shape" };
  }

  if (message.clientTime !== undefined) {
    return {
      ok: true,
      targetX: message.targetX,
      targetY: message.targetY,
      clientTime: message.clientTime,
    };
  }

  return {
    ok: true,
    targetX: message.targetX,
    targetY: message.targetY,
  };
}

function isRequestMoveShaped(value: unknown): value is RequestMoveShape {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== "request_move") {
    return false;
  }
  if (typeof candidate.targetX !== "number") {
    return false;
  }
  if (typeof candidate.targetY !== "number") {
    return false;
  }
  if (
    candidate.clientTime !== undefined &&
    typeof candidate.clientTime !== "number"
  ) {
    return false;
  }
  return true;
}
