import type { CharacterId } from "@doomscrolls/shared";
import { CharacterRepository } from "../../persistence/repositories/CharacterRepository";

export type PickupWorldLootCurrencyFailureReason =
  | "invalid_amount"
  | "character_not_found";

export type PickupWorldLootCurrencyResult =
  | {
      readonly ok: true;
      readonly gainedCopper: number;
      readonly totalCopper: number;
    }
  | {
      readonly ok: false;
      readonly reason: PickupWorldLootCurrencyFailureReason;
    };

/**
 * Server-side persistence helper for picking up a currency world-loot
 * drop. Adds `amount` copper to the character's `moneyCopper` total
 * via {@link CharacterRepository.incrementMoneyCopper}.
 *
 * The pickup room handler is responsible for removing the world-loot
 * entry from room state and for sending the safe
 * `currency_picked_up` message to the originating client.
 */
export async function persistPickedUpCurrencyToCharacter(input: {
  readonly characterId: CharacterId;
  readonly amount: number;
}): Promise<PickupWorldLootCurrencyResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, reason: "invalid_amount" };
  }

  const safeAmount = Math.max(0, Math.floor(input.amount));
  const characterRepository = new CharacterRepository();
  const total = await characterRepository.incrementMoneyCopper(
    input.characterId.toString(),
    safeAmount,
  );

  if (total === null) {
    return { ok: false, reason: "character_not_found" };
  }

  return {
    ok: true,
    gainedCopper: safeAmount,
    totalCopper: total,
  };
}
