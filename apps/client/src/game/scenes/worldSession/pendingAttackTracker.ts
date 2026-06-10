/**
 * Task 286 — Pending Enemy Attack Tracker
 *
 * Manages client-side pending attack state when the player clicks an
 * enemy out of attack range. The tracker:
 *
 * - Stores the target enemy ID and world position while the player moves
 * - Checks each tick whether the player is within BASIC_ATTACK_RANGE
 * - Fires the attack intent once in range
 * - Clears on: enemy death/despawn, new click target, manual movement,
 *   or UI blocking
 *
 * The server remains authoritative — the client never fakes a hit.
 * The tracker only sends the network message; the server decides
 * whether the attack lands.
 */

import type { Room } from "@colyseus/sdk";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import { sendAttackIntent } from "../../../net/attackIntentClient";
import { getTownRoomEnemies } from "../../../net/townRoomEnemies";

/**
 * Client-side estimate of basic attack range.
 * Matches BASIC_ATTACK_RANGE (64) in apps/server/src/realtime/rooms/attackIntentValidation.ts.
 * Used to decide when to send the attack intent while moving toward an enemy.
 * The server performs the authoritative range check.
 */
export const BASIC_ATTACK_RANGE = 64;

export interface PendingAttackState {
  readonly enemyId: string;
  readonly targetWorldX: number;
  readonly targetWorldY: number;
}

export interface PendingAttackCheckResult {
  /** True if an attack was sent this tick. */
  readonly attackSent: boolean;
}

/**
 * Check whether a pending attack should be fired now.
 *
 * If the player is within range of the target enemy position, sends the
 * attack intent and returns `attackSent: true`. Otherwise returns
 * `attackSent: false` — the caller should continue tracking.
 *
 * The enemy is looked up from room state; if the enemy no longer exists
 * (defeated/despawned) the pending attack is silently dropped.
 */
export function checkPendingAttack(
  room: Room<DoomscrollsRoomState>,
  state: PendingAttackState | null,
  playerWorldX: number,
  playerWorldY: number,
): PendingAttackCheckResult {
  if (state === null) {
    return { attackSent: false };
  }

  // Verify the enemy still exists and is alive (not defeated)
  const enemies = getTownRoomEnemies(room.state);
  const enemy = enemies.find((e) => e.id === state.enemyId);
  if (enemy === undefined || enemy.defeated) {
    return { attackSent: false };
  }

  // Use the enemy's current server position for the range check
  const dx = enemy.x - playerWorldX;
  const dy = enemy.y - playerWorldY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= BASIC_ATTACK_RANGE) {
    // In range — fire the attack
    const result = sendAttackIntent(room, state.enemyId);
    if (result.dispatched) {
      return { attackSent: true };
    }
  }

  return { attackSent: false };
}