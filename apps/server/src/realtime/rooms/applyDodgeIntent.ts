import type { TownRoomState } from "./TownRoomState";
import type { PlayerPresence } from "./PlayerPresence";
import { resolveZoneBounds } from "./resolveZoneBounds";
import { DEFAULT_DODGE_DISTANCE } from "./dodgeCooldown";

// ---------------------------------------------------------------------------
// Task 095 — Player Dodge Intent Foundation.
//
// Server-authoritative application of a validated `request_dodge`
// intent. The helper is intentionally small and isolated so the
// TownRoom file stays a thin Colyseus shell.
//
// Rules (per the Task 095 spec):
//   - if the player is alive, move the player a short fixed distance
//     in the requested direction
//   - clamp the resulting position to the current zone bounds
//   - overwrite the player's authoritative movement target so the
//     room simulation tick can finish carrying them to the dodge end
//     point at the player's movement speed
//   - do not implement stamina, resource cost, animation, skill
//     system, roll collision, pathfinding or client prediction
//
// Dodge relevance side-effect:
//   - the player position changes immediately and remains server-owned
//   - existing telegraphed attacks are NOT force-cancelled here;
//     instead the later landing check must re-evaluate range against
//     the dodged position so leaving range before impact produces a
//     server-authoritative miss.
// ---------------------------------------------------------------------------

export interface ApplyDodgeIntentInput {
  readonly state: TownRoomState;
  readonly player: PlayerPresence;
  readonly dirX: number;
  readonly dirY: number;
  readonly now: number;
  readonly distance?: number;
  readonly dodgeEpsilon?: number;
}

export interface ApplyDodgeIntentResult {
  readonly newX: number;
  readonly newY: number;
  readonly targetX: number;
  readonly targetY: number;
}

/**
 * Small distance used to decide whether a player has "left range"
 * after the dodge. The default 0.5 world units avoids float-noise
 * false-positives around the original position. The intent is
 * "the player clearly moved", not "the player crossed the
 * ENEMY_ATTACK_RANGE boundary" -- that final range check is
 * still performed by the per-enemy windup landing code on the
 * next room tick.
 */
const DEFAULT_DODGE_EPSILON = 0.5;

export function applyDodgeIntent(input: ApplyDodgeIntentInput): ApplyDodgeIntentResult {
  const { state, player, dirX, dirY, now } = input;
  const distance = input.distance ?? DEFAULT_DODGE_DISTANCE;
  const epsilon = input.dodgeEpsilon ?? DEFAULT_DODGE_EPSILON;

  const startX = player.x;
  const startY = player.y;

  // dirX / dirY were already validated to be finite numbers and
  // not both zero by validateDodgeIntent(); we still re-normalize
  // defensively here in case the helper is called directly.
  const length = Math.hypot(dirX, dirY);
  const unitX = length > 0 ? dirX / length : 0;
  const unitY = length > 0 ? dirY / length : 0;

  const rawTargetX = startX + unitX * distance;
  const rawTargetY = startY + unitY * distance;

  const bounds = resolveZoneBounds(state.zoneId);
  const clampedTargetX = Math.min(Math.max(rawTargetX, bounds.minX), bounds.maxX);
  const clampedTargetY = Math.min(Math.max(rawTargetY, bounds.minY), bounds.maxY);

  // Move the player to the dodge end point immediately. This is a
  // short fixed roll, not a click-to-move path. Setting x/y directly
  // is intentional: a dodge is an instantaneous, deterministic
  // displacement, not a tick-stepped move.
  player.x = clampedTargetX;
  player.y = clampedTargetY;
  player.targetX = clampedTargetX;
  player.targetY = clampedTargetY;
  player.hasMovementTarget = false;
  // Keep the dodge-aware nextDodgeAt untouched here; the room
  // handler is responsible for consuming the cooldown so the
  // application helper stays side-effect free w.r.t. cooldowns.

  void state;
  void now;
  void epsilon;

  return {
    newX: player.x,
    newY: player.y,
    targetX: clampedTargetX,
    targetY: clampedTargetY,
  };
}
