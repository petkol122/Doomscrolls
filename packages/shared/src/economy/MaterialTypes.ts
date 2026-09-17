/**
 * Salvage-material currency. Iron Scrap and Arcane Dust are the two
 * fixed outputs of the Salvage & Tech Teardown vendor action
 * (`salvageItem.ts`) -- rather than landing in the inventory grid as an
 * `ItemInstance` needing a slot, they accumulate as a plain counter on
 * the character, mirroring how `walletBalancesJson`/`CurrencyBalances`
 * already model wallet currencies (see `CurrencyTypes.ts`). A player can
 * withdraw a chosen quantity back into a physical, tradeable inventory
 * stack via `request_withdraw_material` (see `WithdrawMaterialTypes.ts`).
 */
export type MaterialId = "iron_scrap" | "arcane_dust";

export const MATERIAL_IDS: readonly MaterialId[] = ["iron_scrap", "arcane_dust"];

export type MaterialBalances = Readonly<Record<MaterialId, number>>;

export const ZERO_MATERIAL_BALANCES: MaterialBalances = {
  iron_scrap: 0,
  arcane_dust: 0,
};

export function buildMaterialBalances(persisted: Partial<MaterialBalances> = {}): MaterialBalances {
  return { ...ZERO_MATERIAL_BALANCES, ...persisted };
}

export function buildMaterialBalancesJson(balances: MaterialBalances): string {
  return JSON.stringify(balances);
}

/** Parses the `Character.materialBalancesJson` persisted column (JSON-encoded partial balances). */
export function parseMaterialBalancesJson(raw: string | null | undefined): Partial<MaterialBalances> {
  if (raw === null || raw === undefined || raw.length === 0) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const result: Partial<Record<MaterialId, number>> = {};
    for (const materialId of MATERIAL_IDS) {
      const value = (parsed as Record<string, unknown>)[materialId];
      if (typeof value === "number" && Number.isFinite(value)) {
        result[materialId] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}
