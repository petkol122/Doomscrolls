import type {
  CharacterId,
  CurrencyPickedUpServerMessage,
  RequestPickupWorldLootAcceptedServerMessage,
  RequestPickupWorldLootRejectedServerMessage,
  WorldLoot as SharedWorldLoot,
} from "@doomscrolls/shared";

import { persistPickedUpWorldLootToInventory } from "./pickupWorldLootInventory";
import { persistPickedUpCurrencyToCharacter } from "./pickupWorldLootCurrency";

export type PickupWorldLootDispatcherResult =
  | {
      readonly ok: true;
      readonly isCurrency: boolean;
      readonly accepted: RequestPickupWorldLootAcceptedServerMessage;
      readonly currencyMessage: CurrencyPickedUpServerMessage | null;
    }
  | {
      readonly ok: false;
      readonly rejected: RequestPickupWorldLootRejectedServerMessage;
    };

/**
 * Apply a validated world-loot pickup to the database.
 *
 * Two flavours:
 *  - currency world-loot (currencyCopper > 0): add the copper to the
 *    character's moneyCopper total and return both a standard
 *    pickup-accepted message and a dedicated currency feedback message
 *  - item world-loot: add the item to the character's inventory and
 *    return the standard `request_pickup_world_loot_accepted` message
 *
 * The caller is responsible for removing the loot entry from the room
 * state after a successful pickup.
 */
export async function dispatchPickedUpWorldLoot(input: {
  readonly characterId: CharacterId;
  readonly worldLoot: SharedWorldLoot;
}): Promise<PickupWorldLootDispatcherResult> {
  const currencyAmount = Number.isFinite(input.worldLoot.currencyCopper)
    ? Math.max(0, Math.floor(input.worldLoot.currencyCopper ?? 0))
    : 0;

  if (currencyAmount > 0) {
    const currencyResult = await persistPickedUpCurrencyToCharacter({
      characterId: input.characterId,
      amount: currencyAmount,
    });

    if (!currencyResult.ok) {
      return {
        ok: false,
        rejected: {
          type: "request_pickup_world_loot_rejected",
          reason: "world_loot_not_found",
          worldLootId: input.worldLoot.id,
        },
      };
    }

    const accepted: RequestPickupWorldLootAcceptedServerMessage = {
      type: "request_pickup_world_loot_accepted",
      worldLootId: input.worldLoot.id,
      message: `Picked up ${currencyResult.gainedCopper} copper`,
      currencyCopper: currencyResult.gainedCopper,
      totalMoneyCopper: currencyResult.totalCopper,
    };

    const currencyMessage: CurrencyPickedUpServerMessage = {
      type: "currency_picked_up",
      characterId: input.characterId,
      gainedCopper: currencyResult.gainedCopper,
      totalMoneyCopper: currencyResult.totalCopper,
    };

    return { ok: true, isCurrency: true, accepted, currencyMessage };
  }

  const pickupResult = await persistPickedUpWorldLootToInventory({
    characterId: input.characterId,
    itemDefinitionId: input.worldLoot.itemId,
    itemLabel: input.worldLoot.label,
  });

  if (!pickupResult.ok) {
    return {
      ok: false,
      rejected: {
        type: "request_pickup_world_loot_rejected",
        reason: pickupResult.reason === "inventory_full" ? "inventory_full" : "world_loot_not_found",
        worldLootId: input.worldLoot.id,
      },
    };
  }

  const accepted: RequestPickupWorldLootAcceptedServerMessage = {
    type: "request_pickup_world_loot_accepted",
    worldLootId: input.worldLoot.id,
    message: pickupResult.message,
    itemLabel: input.worldLoot.label,
    ...(input.worldLoot.rarity === undefined ? {} : { rarity: input.worldLoot.rarity }),
  };

  return { ok: true, isCurrency: false, accepted, currencyMessage: null };
}
