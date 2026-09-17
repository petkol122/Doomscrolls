# docs/ai/AGENT_INSTRUCTIONS.md — Guidelines for Future AI Development

Operational rules for AI agents (and human contributors) extending Doomscrolls, distilled from Milestone 0.3's Multi-Currency Wallet Engine work. Read alongside `docs/CODING_RULES.md` (general conventions) and `docs/architecture/WORLD_VISION_AND_ECONOMY.md` (the setting/economy this code implements) — this file is the "how to build it" companion to that "what it is" document.

---

## 1. Currency and region tags

- **Never hardcode a currency.** Read/write balances through `CharacterWallet.balances[currencyId]` (`@doomscrolls/shared`), and resolve currency metadata (symbol, exchange rate, cosmetic-only flag) through `contentRegistry.currencies` (`@doomscrolls/content`) — never inline a `"Kč"` or a conversion constant at a call site.
- **Every new currency-aware feature must state which `CurrencyId`(s) it operates in.** A vendor, a price tag, a reward — each needs an explicit currency, not an implicit "the" currency. There is no single global currency post-0.3.
- **Tag new zones/content with their real economic region**, not just their `AreaContentId`. Today every reachable zone is Pilsen/CZK, so this hasn't mattered yet — the moment a second region ships, code that assumed CZK-everywhere (HUD primary-balance display included, see `worldSessionOverlayView.ts`'s `formatPrimaryRegionalBalance`) must switch to resolving the region's actual primary currency instead of a hardcoded `"czk"`.
- **Cosmetic currencies are never counted toward Net Worth.** `Street Cred` is excluded in `calculatePlayerNetWorth` by an explicit `isCosmeticOnly` check, not by omission. Any future cosmetic-only currency must set that flag and stay excluded — this is a non-negotiable non-pay-to-win boundary, not a style preference.
- **Exchange rates (`czkPerUnit`) are fixed content data**, not a live feed. Don't build a real-time exchange feature without an explicit design decision first (see the "Explicitly undecided" section of the economy vision doc).

## 2. Server tick budget

- Periodic per-tick server work (status effect ticks, movement, aggro/damage, regen — see `TownRoom`/`CombatRoom`'s `setSimulationInterval` callbacks) should be written to fit a **~50ms (20Hz) per-tick budget**, not the raw per-frame rate the underlying transport happens to call at. Treat 50ms as the actual cost ceiling to profile against when adding new tick-loop work (a new currency drop roll, a new regen effect, a new AoE resolution pass), even though the code does not force a literal 50ms interval today.
- Never add unbounded per-tick work that scales with something a player can grow without limit (e.g., don't iterate all seven currencies' full transaction histories every tick — read/write only the balances a specific action touches).
- Any new tick-loop mutation must go through the same "state is authoritative on the server, client only renders it" pattern already used everywhere else in `TownRoom`/`CombatRoom` — no client-authoritative currency or Net Worth mutation, ever.

## 3. Strict UI chrome usage

- Follow `worldSessionOverlayView.ts`'s existing conventions exactly — do not introduce a second visual language:
  - Plain `document.createElement` + inline `.style.*`, no CSS classes/stylesheet, no JSX.
  - Reuse the existing chip/card factories (`createCardSection`, `createCompactStatChip`, `createMiniHudStat`, `createSectionBlock`) instead of hand-rolling new bordered panels.
  - Reuse the established palette: background `rgba(12-18, 10-14, 8-10, 0.72-0.9)`, borders `#31271c`/`#3c3122`, muted label text `#a88d63`, warm highlight text `#d8c6a3`/`#f0ddbb`, accent green `#b9d49a`.
  - All user-facing strings go through `t("namespace.key", { vars })` from `@doomscrolls/localization` — never a hardcoded literal (an existing exception, the vendor view's hardcoded `"Money:"`, is a known inconsistency to fix opportunistically, not a precedent to extend).
  - Apply `makeInteractive`/`makeInteractiveAndStopWorldInput`/`makePassive` deliberately on every new HUD element — getting this wrong either blocks Phaser's world input or lets clicks leak through it.
  - Mutate existing DOM node refs in a `sync*View` function on each `update()` call; do not recreate/remount nodes every tick (see `StatusViewRefs`/`syncStatusView` for the canonical pattern the wallet/Net Worth HUD line follows).

## 4. General

- A currency/wallet/economy change touches three packages in lockstep: `@doomscrolls/shared` (types), `@doomscrolls/content` (registry data), `apps/server` (persistence + `calculatePlayerNetWorth`), plus the client HUD. Update all four together — a currency that exists in content but never reaches the wallet type, or a wallet balance the HUD never displays, is an incomplete change.
- Prefer additive schema changes (a new nullable/defaulted column, a new optional DTO field) over breaking existing persisted data — see how `walletBalancesJson` was added alongside the pre-existing `moneyCopper` column rather than replacing it outright.
