/**
 * Task 288 — Pending Interact Tracker
 *
 * Manages client-side pending interact state when the player clicks an
 * interactable object out of interaction range. The tracker:
 *
 * - Stores the target object ID and world position while the player moves
 * - Checks each tick whether the player is within INTERACT_RANGE
 * - Fires the interact intent once in range
 * - Clears on: new click target (move, enemy, loot, another interactable),
 *   UI blocking, or interactable becoming invalid
 *
 * The server remains authoritative — the client never fakes an interaction.
 * The tracker only sends the network message; the server decides whether
 * the interaction is valid.
 */

import type { Room } from "@colyseus/sdk";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import { sendInteractIntent } from "../../../net/interactIntentClient";
import { sendCombatReturnIntent } from "../../../net/combatReturnIntentClient";

/**
 * Server-side interact range used by the validator.
 * Matches INTERACT_DISTANCE (50) in
 * apps/server/src/realtime/rooms/interactValidation.ts.
 * Used to decide when to send the interact intent while moving toward an object.
 * The server performs the authoritative range check.
 */
export const INTERACT_RANGE = 50;

export interface PendingInteractState {
  readonly objectId: string;
  readonly targetWorldX: number;
  readonly targetWorldY: number;
  /**
   * Which network message to fire once in range. Defaults to the
   * generic `request_interact` when omitted. `combat_return_gate`
   * clicks must fire `request_combat_return` instead -- `CombatRoom`
   * has no `request_interact` handler, so sending the generic message
   * here would silently do nothing once the player arrives.
   */
  readonly kind?: "interact" | "combat_return";
}

export interface PendingInteractCheckResult {
  /** True if an interact was sent this tick. */
  readonly interactSent: boolean;
}

/**
 * Check whether a pending interact should be fired now.
 *
 * If the player is within range of the target object position, sends the
 * interact intent and returns `interactSent: true`. Otherwise returns
 * `interactSent: false` — the caller should continue tracking.
 *
 * No lookup against room state is needed for validity; the server will
 * reject invalid/out-of-range interactions. The tracker fires once the
 * client-side estimate of range is met; the server remains authoritative.
 */
export function checkPendingInteract(
  room: Room<DoomscrollsRoomState>,
  state: PendingInteractState | null,
  playerWorldX: number,
  playerWorldY: number,
): PendingInteractCheckResult {
  if (state === null) {
    return { interactSent: false };
  }

  // Use the stored target position for the range check
  const dx = state.targetWorldX - playerWorldX;
  const dy = state.targetWorldY - playerWorldY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= INTERACT_RANGE) {
    // In range — fire the interact
    if (state.kind === "combat_return") {
      sendCombatReturnIntent(room, state.objectId);
    } else {
      sendInteractIntent(room, state.objectId);
    }
    return { interactSent: true };
  }

  return { interactSent: false };
}