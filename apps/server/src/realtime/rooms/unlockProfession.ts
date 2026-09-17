/**
 * Milestone 0.3 -- Profession Training System.
 *
 * Server-side profession unlock/rank-up handler. Validates vendor
 * existence, profession id, next-tier availability and player currency,
 * then atomically deducts copper and persists the raised tier. The
 * client never decides the tier cost.
 */
import { contentRegistry } from "@doomscrolls/content";
import { buildProfessionsJson, parseProfessionsJson, type ProfessionId, type RequestUnlockProfessionRejectedReason } from "@doomscrolls/shared";
import { Prisma, type PrismaClient } from "@prisma/client";

import { CharacterRepository } from "../../persistence/repositories/CharacterRepository";
import { getSharedPrismaClient } from "../../persistence/prisma";

const KNOWN_PROFESSION_IDS: readonly ProfessionId[] = ["salvaging", "fishing", "cooking", "gunsmithing"];

export type UnlockProfessionResult =
  | {
      readonly ok: true;
      readonly professionId: ProfessionId;
      readonly newTier: number;
      readonly costCopper: number;
      readonly remainingCopper: number;
    }
  | {
      readonly ok: false;
      readonly reason: RequestUnlockProfessionRejectedReason;
    };

export async function executeUnlockProfession(input: {
  readonly characterId: string;
  readonly vendorId: string;
  readonly professionId: string;
  readonly db?: PrismaClient;
}): Promise<UnlockProfessionResult> {
  const { characterId, vendorId, professionId: rawProfessionId } = input;
  const db = input.db ?? getSharedPrismaClient();

  // 1. Validate vendor exists in town-service content
  const vendorService = contentRegistry.townServices.get(vendorId as never);
  if (vendorService === undefined || vendorService.serviceKind !== "vendor") {
    return { ok: false, reason: "vendor_unavailable" };
  }

  // 2. Validate profession id and content definition
  if (!(KNOWN_PROFESSION_IDS as readonly string[]).includes(rawProfessionId)) {
    return { ok: false, reason: "profession_unavailable" };
  }
  const professionId = rawProfessionId as ProfessionId;
  const professionDef = contentRegistry.professions.get(professionId);
  if (professionDef === undefined) {
    return { ok: false, reason: "profession_unavailable" };
  }

  // 3. Read the character's current tier and resolve the next tier's cost.
  // `professionsJson` is declared on the Prisma schema but read via an index
  // signature here for the same reason `walletBalancesJson` is in
  // characterMapper.ts (compiles even before the generated Prisma client is
  // refreshed for the new column).
  const character = await db.character.findUnique({ where: { id: characterId } });
  if (character === null) {
    return { ok: false, reason: "vendor_unavailable" };
  }

  const currentTiers = parseProfessionsJson((character as unknown as { professionsJson?: string }).professionsJson);
  const currentTier = currentTiers[professionId];
  const nextTierDef = professionDef.tiers.find((tierDef) => tierDef.tier === currentTier + 1);
  if (nextTierDef === undefined) {
    return { ok: false, reason: "already_max_tier" };
  }

  if (character.moneyCopper < nextTierDef.costCopper) {
    return { ok: false, reason: "not_enough_currency" };
  }

  // 4. Atomically: deduct copper + persist the raised tier
  try {
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const txCharacterRepo = new CharacterRepository(tx);

      const newCopper = await txCharacterRepo.decrementMoneyCopper(characterId, nextTierDef.costCopper);
      if (newCopper === null) {
        return { ok: false as const, reason: "not_enough_currency" as const };
      }

      const newTiers = { ...currentTiers, [professionId]: nextTierDef.tier };
      await txCharacterRepo.updateProfessionsJson(characterId, buildProfessionsJson(newTiers));

      return {
        ok: true as const,
        professionId,
        newTier: nextTierDef.tier,
        costCopper: nextTierDef.costCopper,
        remainingCopper: newCopper,
      };
    });

    return result;
  } catch {
    return { ok: false, reason: "vendor_unavailable" };
  }
}
