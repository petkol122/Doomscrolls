import type { CurrencyContentDefinition } from "./types";

/**
 * Milestone 0.3 -- Multi-Currency Wallet Engine. `czkPerUnit` rates are
 * flavor-accurate approximations (2026), fixed content data rather than
 * a live feed -- there is no exchange/trading feature yet. `street_cred`
 * carries `czkPerUnit: 0` and `isCosmeticOnly: true`: it buys Transmog
 * cosmetics only and is deliberately excluded from Net Worth.
 */
export const currencies = [
  {
    id: "czk",
    nameKey: "currency.czk.name",
    descriptionKey: "currency.czk.description",
    symbol: "Kč",
    czkPerUnit: 1,
    isRegionalPrimary: true,
    isCosmeticOnly: false,
    iconKey: "currency_czk"
  },
  {
    id: "eur",
    nameKey: "currency.eur.name",
    descriptionKey: "currency.eur.description",
    symbol: "€",
    czkPerUnit: 25,
    isRegionalPrimary: true,
    isCosmeticOnly: false,
    iconKey: "currency_eur"
  },
  {
    id: "usd",
    nameKey: "currency.usd.name",
    descriptionKey: "currency.usd.description",
    symbol: "$",
    czkPerUnit: 23,
    isRegionalPrimary: false,
    isCosmeticOnly: false,
    iconKey: "currency_usd"
  },
  {
    id: "rmb",
    nameKey: "currency.rmb.name",
    descriptionKey: "currency.rmb.description",
    symbol: "¥",
    czkPerUnit: 3.2,
    isRegionalPrimary: true,
    isCosmeticOnly: false,
    iconKey: "currency_rmb"
  },
  {
    id: "jpy",
    nameKey: "currency.jpy.name",
    descriptionKey: "currency.jpy.description",
    symbol: "¥",
    czkPerUnit: 0.16,
    isRegionalPrimary: true,
    isCosmeticOnly: false,
    iconKey: "currency_jpy"
  },
  {
    id: "gold_bullion",
    nameKey: "currency.gold_bullion.name",
    descriptionKey: "currency.gold_bullion.description",
    symbol: "oz",
    czkPerUnit: 55000,
    isRegionalPrimary: false,
    isCosmeticOnly: false,
    iconKey: "currency_gold_bullion"
  },
  {
    id: "street_cred",
    nameKey: "currency.street_cred.name",
    descriptionKey: "currency.street_cred.description",
    symbol: "SC",
    czkPerUnit: 0,
    isRegionalPrimary: false,
    isCosmeticOnly: true,
    iconKey: "currency_street_cred"
  }
] as const satisfies readonly CurrencyContentDefinition[];
