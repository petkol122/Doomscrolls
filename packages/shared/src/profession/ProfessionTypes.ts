/**
 * Milestone 0.3 -- Profession Training System. Every Life Skill
 * profession a character can train (see
 * `packages/content/src/data/professions.ts`).
 */
export type ProfessionId = "salvaging" | "fishing" | "cooking" | "gunsmithing";

export const PROFESSION_IDS: readonly ProfessionId[] = ["salvaging", "fishing", "cooking", "gunsmithing"];

/** Tier reached per profession id; absent/0 = not unlocked. */
export type ProfessionTiers = Readonly<Record<ProfessionId, number>>;

export const ZERO_PROFESSION_TIERS: ProfessionTiers = {
  salvaging: 0,
  fishing: 0,
  cooking: 0,
  gunsmithing: 0,
};

/**
 * Parses the `Character.professionsJson` persisted column (JSON-encoded
 * map of profession id -> tier reached), matching the defensive parsing
 * convention `parseWalletBalancesJson` uses for `walletBalancesJson`.
 */
export function parseProfessionsJson(raw: string | null | undefined): ProfessionTiers {
  if (raw === null || raw === undefined || raw.length === 0) {
    return ZERO_PROFESSION_TIERS;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return ZERO_PROFESSION_TIERS;
    }
    const result: Record<ProfessionId, number> = { ...ZERO_PROFESSION_TIERS };
    for (const professionId of PROFESSION_IDS) {
      const value = (parsed as Record<string, unknown>)[professionId];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        result[professionId] = Math.floor(value);
      }
    }
    return result;
  } catch {
    return ZERO_PROFESSION_TIERS;
  }
}

/** Serializes a `ProfessionTiers` map back to the persisted column format. */
export function buildProfessionsJson(tiers: ProfessionTiers): string {
  return JSON.stringify(tiers);
}
