/**
 * Task 287 — Pending Loot Pickup Tracker
 *
 * Manages client-side pending loot pickup state when the player clicks a
 * loot drop out of pickup range. The tracker:
 *
 * - Stores the target loot ID and world position while the player moves
 * - Checks each tick whether the player is within WORLD_LOOT_PICKUP_RANGE
 * - Fires the pickup intent once in range
 * - Clears on: loot despawn/pickup, new click target, manual movement,
 *   or UI blocking
 *
 * The server remains authoritative — the client never fakes a pickup.
 * The tracker only sends the network message; the server decides
 * whether the pickup succeeds.
 */

import type { Room } from "@colyseus/sdk";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import { sendPickupWorldLootIntent } from "../../../net/pickupWorldLootClient";

/**
 * Server-side pickup range used by the validator.
 * Matches WORLD_LOOT_PICKUP_RANGE (48) in
 * apps/server/src/realtime/rooms/pickupWorldLootValidation.ts.
 * Used to decide when to send the pickup intent while moving toward loot.
 * The server performs the authoritative range check.
 */
export const WORLD_LOOT_PICKUP_RANGE = 48;

export interface PendingLootPickupState {
  readonly worldLootId: string;
  readonly targetWorldX: number;
  readonly targetWorldY: number;
}

export interface PendingLootPickupCheckResult {
  /** True if a pickup was sent this tick. */
  readonly pickupSent: boolean;
}

/**
 * Check whether a pending loot pickup should be fired now.
 *
 * If the player is within range of the target loot position, sends the
 * pickup intent and returns `pickupSent: true`. Otherwise returns
 * `pickupSent: false` — the caller should continue tracking.
 *
 * The loot is looked up from room state; if the loot no longer exists
 * (already picked up/despawned) the pending pickup is silently dropped
 * so no stuck pending state remains.
 */
export function checkPendingLootPickup(
  room: Room<DoomscrollsRoomState>,
  state: PendingLootPickupState | null,
  playerWorldX: number,
  playerWorldY: number,
): PendingLootPickupCheckResult {
  if (state === null) {
    return { pickupSent: false };
  }

  // Verify the loot still exists in room state
  const lootList = getTownRoomWorldLootFromState(room.state);
  const loot = lootList.find((l) => l.id === state.worldLootId);
  if (loot === undefined) {
    // Loot was already picked up or despawned — clear pending state
    return { pickupSent: false };
  }

  // Use the loot's current server position for the range check
  const dx = loot.x - playerWorldX;
  const dy = loot.y - playerWorldY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= WORLD_LOOT_PICKUP_RANGE) {
    // In range — fire the pickup
    const result = sendPickupWorldLootIntent(room, state.worldLootId);
    if (result.dispatched) {
      return { pickupSent: true };
    }
  }

  return { pickupSent: false };
}

/**
 * Minimal loot snapshot shape used by the tracker.
 * Extracted from room state without importing the full Snapshot type
 * to keep the tracker dependency-light.
 */
interface WorldLootSnapshot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/**
 * Pull world loot entries from room state.
 * The room state structure comes from @doomscrolls/shared Colyseus schema.
 */
function getTownRoomWorldLootFromState(
  state: DoomscrollsRoomState,
): WorldLootSnapshot[] {
  const rawState = state as unknown as Record<string, unknown>;
  const rawLoot = rawState.worldLoot;
  if (rawLoot === undefined || rawLoot === null) {
    return [];
  }

  if (typeof (rawLoot as { toArray?: () => unknown[] }).toArray === "function") {
    const arr = (rawLoot as { toArray: () => unknown[] }).toArray();
    return arr.map((entry: unknown) => {
      const e = entry as Record<string, unknown>;
      return {
        id: String(e.id ?? ""),
        x: Number(e.x ?? 0),
        y: Number(e.y ?? 0),
      };
    });
  }

  return [];
}