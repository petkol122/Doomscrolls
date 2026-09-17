/**
 * Milestone 0.3 -- Multi-Currency Wallet Engine. Every currency a
 * character can hold. `czk` is the primary regional currency (Pilsen) and
 * the base unit `calculatePlayerNetWorth` converts everything else into.
 * `street_cred` is the non-P2W cosmetic/reputation currency -- it is
 * never counted toward Net Worth (see `packages/content/src/data/currencies.ts`
 * `isCosmeticOnly` flag).
 */
export type CurrencyId = "czk" | "eur" | "usd" | "rmb" | "jpy" | "gold_bullion" | "street_cred";

export const CURRENCY_IDS: readonly CurrencyId[] = ["czk", "eur", "usd", "rmb", "jpy", "gold_bullion", "street_cred"];

export type CurrencyBalances = Readonly<Record<CurrencyId, number>>;

/**
 * Replaces a single flat `moneyCopper` gold field with a per-currency
 * balance map. `moneyCopper` remains on `CharacterSummary` for backward
 * compatibility with existing display code (it mirrors `balances.czk`);
 * new code should read `wallet.balances` instead.
 */
export interface CharacterWallet {
  readonly balances: CurrencyBalances;
}

export const ZERO_WALLET_BALANCES: CurrencyBalances = {
  czk: 0,
  eur: 0,
  usd: 0,
  rmb: 0,
  jpy: 0,
  gold_bullion: 0,
  street_cred: 0,
};

/**
 * Builds a wallet from the legacy `moneyCopper` column plus any
 * additional persisted non-CZK balances. `moneyCopper` copper is treated
 * 1:1 as CZK "haléře" (i.e. already the smallest CZK unit) so existing
 * characters keep their exact current balance under the new model.
 */
export function buildCharacterWallet(
  moneyCopper: number,
  otherBalances: Partial<CurrencyBalances> = {},
): CharacterWallet {
  return {
    balances: {
      ...ZERO_WALLET_BALANCES,
      ...otherBalances,
      czk: moneyCopper,
    },
  };
}

/** Parses the `Character.walletBalancesJson` persisted column (JSON-encoded partial balances, non-CZK only). */
export function parseWalletBalancesJson(raw: string | null | undefined): Partial<CurrencyBalances> {
  if (raw === null || raw === undefined || raw.length === 0) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const result: Partial<Record<CurrencyId, number>> = {};
    for (const currencyId of CURRENCY_IDS) {
      const value = (parsed as Record<string, unknown>)[currencyId];
      if (typeof value === "number" && Number.isFinite(value)) {
        result[currencyId] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}
