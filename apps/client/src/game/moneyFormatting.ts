import { t } from "@doomscrolls/localization";

export const COPPER_PER_SILVER = 100;
export const SILVER_PER_GOLD = 100;
export const COPPER_PER_GOLD = COPPER_PER_SILVER * SILVER_PER_GOLD;

export interface MoneyBreakdown {
  readonly gold: number;
  readonly silver: number;
  readonly copper: number;
}

export function splitMoneyCopper(moneyCopper: number): MoneyBreakdown {
  const safe = Math.max(0, Math.floor(Number.isFinite(moneyCopper) ? moneyCopper : 0));
  const gold = Math.floor(safe / COPPER_PER_GOLD);
  const silver = Math.floor((safe % COPPER_PER_GOLD) / COPPER_PER_SILVER);
  const copper = safe % COPPER_PER_SILVER;
  return { gold, silver, copper };
}

export function formatMoneyCompact(moneyCopper: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(moneyCopper) ? moneyCopper : 0));
  if (safe === 0) {
    return t("money.money_empty");
  }
  const { gold, silver, copper } = splitMoneyCopper(safe);
  const g = t("money.gold_short");
  const s = t("money.silver_short");
  const c = t("money.copper_short");
  const parts: string[] = [];
  if (gold > 0) {
    parts.push(`${gold}${g}`);
  }
  if (silver > 0) {
    parts.push(`${silver}${s}`);
  }
  if (copper > 0 || parts.length === 0) {
    parts.push(`${copper}${c}`);
  }
  return parts.join(" ");
}
