import type { WorldLoot as SharedWorldLoot } from "@doomscrolls/shared";

import type { PlayerPresence } from "./PlayerPresence";
import type { TownRoomState } from "./TownRoomState";

export const WORLD_LOOT_PICKUP_RANGE = 48;

export type PickupWorldLootRejectedReason =
  | "player_not_ready"
  | "player_downed"
  | "world_loot_not_found"
  | "out_of_range";

export type PickupWorldLootValidationResult =
  | {
      readonly ok: true;
      readonly worldLoot: SharedWorldLoot;
      readonly distance: number;
    }
  | {
      readonly ok: false;
      readonly reason: PickupWorldLootRejectedReason;
    };

export function validatePickupWorldLootIntent(
  state: TownRoomState,
  player: PlayerPresence | undefined,
  worldLootId: string,
): PickupWorldLootValidationResult {
  if (player === undefined) {
    return { ok: false, reason: "player_not_ready" };
  }

  if (player.lifeState !== "alive" || player.hp <= 0) {
    return { ok: false, reason: "player_downed" };
  }

  if (typeof worldLootId !== "string" || worldLootId.length === 0) {
    return { ok: false, reason: "world_loot_not_found" };
  }

  const worldLoot = state.worldLoot.get(worldLootId);
  if (worldLoot === undefined) {
    return { ok: false, reason: "world_loot_not_found" };
  }

  const distance = Math.hypot(worldLoot.x - player.x, worldLoot.y - player.y);
  if (distance > WORLD_LOOT_PICKUP_RANGE) {
    return { ok: false, reason: "out_of_range" };
  }

  // Build a snapshot of the loot entry that the room handler can use
  // for both item-pickup and currency-pickup branches. The pickup
  // pipeline never trusts the client about the loot's actual kind;
  // it always reads the authoritative `currencyCopper` field.
  const currencyCopper = Number.isFinite(worldLoot.currencyCopper) && worldLoot.currencyCopper > 0
    ? worldLoot.currencyCopper
    : 0;

  const shared: SharedWorldLoot = {
    id: worldLoot.id,
    itemId: worldLoot.itemId,
    label: worldLoot.label,
    ...(typeof worldLoot.rarity === "string" && worldLoot.rarity.length > 0
      ? { rarity: worldLoot.rarity }
      : {}),
    ...(currencyCopper > 0 ? { currencyCopper } : {}),
    x: worldLoot.x,
    y: worldLoot.y,
  };

  return { ok: true, worldLoot: shared, distance };
}
