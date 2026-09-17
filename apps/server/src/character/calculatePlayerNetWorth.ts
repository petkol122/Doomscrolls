import type { CharacterWallet, EquippedItemSummary } from "@doomscrolls/shared";
import { contentRegistry } from "@doomscrolls/content";

/**
 * Milestone 0.3 -- Multi-Currency Wallet Engine. A non-wallet, non-item
 * asset contributing to Net Worth (e.g. a future stocks/crypto holding).
 * No portfolio system exists yet -- this is the extension point for one.
 */
export interface PortfolioHolding {
  readonly label: string;
  readonly valueCzk: number;
}

/** Fallback CZK value for an item whose definition has no `baseValueCzk`, keyed by its content `rarity`. */
export const NET_WORTH_RARITY_FALLBACK_CZK: Record<string, number> = {
  common: 50,
  rare: 250,
  epic: 1000
};

/**
 * Resolves an item definition's base CZK value: its own `baseValueCzk` if
 * set, otherwise the per-`rarity` fallback above. Shared with vendor sell
 * pricing (`vendorSellItem.ts`) so an item's worth is consistent whether
 * it's equipped (Net Worth) or sold to a vendor.
 */
export function resolveItemDefinitionValueCzk(definition: { readonly baseValueCzk?: number; readonly rarity?: string }): number {
  if (definition.baseValueCzk !== undefined) {
    return definition.baseValueCzk;
  }
  return NET_WORTH_RARITY_FALLBACK_CZK[definition.rarity ?? ""] ?? 0;
}

function resolveItemValueCzk(item: EquippedItemSummary): number {
  const definition = contentRegistry.items.get(item.definitionId as never);
  if (definition !== undefined) {
    return resolveItemDefinitionValueCzk(definition);
  }
  return NET_WORTH_RARITY_FALLBACK_CZK[item.rarity ?? ""] ?? 0;
}

function sumWalletCzk(wallet: CharacterWallet): number {
  let total = 0;
  for (const currency of contentRegistry.currencies.all) {
    if (currency.isCosmeticOnly) {
      continue;
    }
    const balance = wallet.balances[currency.id] ?? 0;
    total += balance * currency.czkPerUnit;
  }
  return total;
}

/**
 * Sums a character's liquid cash (all non-cosmetic wallet balances,
 * converted to CZK), equipped item values, and any portfolio holdings
 * into one CZK-equivalent Net Worth integer. `street_cred` (cosmetic
 * currency) is intentionally excluded -- Net Worth stays a measure of
 * tradeable wealth, never of cosmetic/reputation progress.
 */
export function calculatePlayerNetWorth(
  wallet: CharacterWallet,
  equippedItems: readonly EquippedItemSummary[],
  portfolio: readonly PortfolioHolding[] = []
): number {
  const cashCzk = sumWalletCzk(wallet);
  const itemsCzk = equippedItems.reduce((sum, item) => sum + resolveItemValueCzk(item), 0);
  const portfolioCzk = portfolio.reduce((sum, holding) => sum + holding.valueCzk, 0);
  return Math.round(cashCzk + itemsCzk + portfolioCzk);
}
