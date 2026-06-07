import type {
  CharacterId,
  CurrencyPickedUpServerMessage,
  RequestPickupWorldLootAcceptedServerMessage,
  RequestPickupWorldLootRejectedServerMessage,
  WorldLoot as SharedWorldLoot,
} from "@doomscrolls/shared";
import { formatMoneyCompact } from "@doomscrolls/shared";

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
 *    pickup-accepted message and a dedicated currency feedback message.
 *    The currency path is mutually exclusive with the inventory path;
 *    a currency world-loot must NEVER also be persisted as an item.
 *  - item world-loot: add the item to the character's inventory and
 *    return the standard `request_pickup_world_loot_accepted` message.
 *    An item world-loot with no `currencyCopper` is required to have a
 *    real `itemId`; the inventory branch refuses empty/missing ids.
 *
 * The caller is responsible for removing the loot entry from the room
 * state after a successful pickup.
 */
export async function dispatchPickedUpWorldLoot(input: {
  readonly characterId: CharacterId;
  readonly worldLoot: SharedWorldLoot;
}): Promise<PickupWorldLootDispatcherResult> {
  // Currency is sanitised first: ignore non-finite, negative, zero or
  // NaN copper values. Only a strictly positive, finite copper amount
  // is treated as a real currency pickup. Anything else falls through
  // to the inventory branch (or is rejected as not pickable).
  const rawCurrencyCopper = input.worldLoot.currencyCopper;
  const currencyAmount =
    typeof rawCurrencyCopper === "number" && Number.isFinite(rawCurrencyCopper) && rawCurrencyCopper > 0
      ? Math.floor(rawCurrencyCopper)
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

    const formattedMoneyText = formatMoneyCompact(currencyResult.gainedCopper);
    const accepted: RequestPickupWorldLootAcceptedServerMessage = {
      type: "request_pickup_world_loot_accepted",
      worldLootId: input.worldLoot.id,
      message: `Picked up ${formattedMoneyText}`,
      formattedMoneyText,
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

  // Inventory branch — must be a real item world-loot. Refuse empty
  // or missing `itemId` safely so a malformed currency-only entry can
  // never be persisted as an item.
  const rawItemId = input.worldLoot.itemId;
  if (typeof rawItemId !== "string" || rawItemId.length === 0) {
    return {
      ok: false,
      rejected: {
        type: "request_pickup_world_loot_rejected",
        reason: "world_loot_not_found",
        worldLootId: input.worldLoot.id,
      },
    };
  }

  const pickupResult = await persistPickedUpWorldLootToInventory({
    characterId: input.characterId,
    itemDefinitionId: rawItemId,
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
