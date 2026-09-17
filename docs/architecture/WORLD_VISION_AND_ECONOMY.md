# docs/architecture/WORLD_VISION_AND_ECONOMY.md — Setting & Economy Vision

## What this document is

A companion to `docs/WORLD_VISION.md` (which covers geography/zone structure). This document covers **setting tone** and **economy design** instead: what kind of world Doomscrolls is set in, how money and wealth work across it, and the non-combat progression (Life Skills, cosmetics) that sits alongside combat leveling.

Like `WORLD_VISION.md`, this is direction, not inventory. As of Milestone 0.3, the only realized pieces are: the Multi-Currency Wallet Engine (`CharacterWallet`, the `currencies` content registry, `calculatePlayerNetWorth`) and the HUD's primary-balance/Net Worth display. Everything else below — the Life Skills professions, Transmog, and every region past Pilsen — is unbuilt intent.

---

## 1. Setting: 2026 Modern World Urban Magic

Doomscrolls is set in a near-future (2026), recognizably real world where magic surfaces as an urban subculture rather than a separate high-fantasy plane. Real cities, real currencies, real geography (see `WORLD_VISION.md` §1–4) — magic and its practitioners are layered onto that real world, not a replacement for it.

Four archetypes anchor the tone. They are flavor/vision references, not a class system — the game's actual class list (`gravewalker`, `ironclad`) is unrelated and unconstrained by this list:

- **Street Alchemist** — back-alley chemistry and hedge-magic; hoards physical Gold Bullion as a hedge against regional currency swings (see §2).
- **Netrunner** — the hacker/data-runner: cross-border, cross-currency operator, equally at home trading USD in a Metro market as RMB in an Asian hub.
- **Cyber-Pop** — the neon, consumer-culture face of the setting: fashion, Transmog cosmetics (§3), street reputation.
- **Martial/Monastic** — traditional physical and spiritual discipline, most associated with the Asian Monastic Hubs (§4).

A player is never locked into one archetype; they describe the setting's texture, not a character build.

---

## 2. Economy: multi-currency wallet & Net Worth

### Why multi-currency

A single flat `moneyCopper` gold field (Core 0.1–0.32) matched a single-region, single-fantasy-currency game. A real-world-grounded, multi-region setting needs one currency per real economic region instead — a player's wealth should mean something different, and be denominated differently, in Pilsen versus a future Chinese Metro hub.

### The currencies

Defined in the `@doomscrolls/content` currency registry (`packages/content/src/data/currencies.ts`), backed by `CharacterWallet`/`CurrencyId` in `@doomscrolls/shared` (`packages/shared/src/economy/CurrencyTypes.ts`):

| Currency | Role |
| --- | --- |
| **CZK** (Kč) | Primary regional currency for Pilsen; the Net Worth base unit everything else converts into. |
| **EUR** | Common currency across European Metro hubs. |
| **USD** | Cross-region trade / Netrunner markets. |
| **RMB** | Chinese Metro currency; dominant in the Asian Monastic Hubs' trade districts. |
| **JPY** | Japan's Cyber-Pop districts. |
| **Gold Bullion** | Physical, region-agnostic hedge asset (Street Alchemist flavor). |
| **Street Cred** | Reputation currency. Cosmetic-only — see §3. |

Each currency (except Street Cred) carries a `czkPerUnit` exchange rate: fixed content data today, not a live feed — there is no trading/exchange feature yet, only the conversion math Net Worth needs.

### Net Worth

`calculatePlayerNetWorth(wallet, equippedItems, portfolio?)` (`apps/server/src/character/calculatePlayerNetWorth.ts`) is the single server-side source of truth for a character's total wealth, expressed as one CZK-equivalent integer:

```
netWorth = Σ(wallet balances × czkPerUnit, excluding cosmetic currencies)
         + Σ(equipped item baseValueCzk, or a rarity fallback)
         + Σ(portfolio.valueCzk)   // extension point; no portfolio system exists yet
```

**Street Cred is deliberately excluded.** Net Worth measures tradeable wealth; cosmetic/reputation progress must never count toward it, or Transmog/Street Cred stops being non-P2W in substance even if it is in name.

### Regional display

The HUD (`worldSessionOverlayView.ts`) shows the character's **primary regional balance** (today: always CZK, since Pilsen is the only reachable region) alongside their **Net Worth**. Once a second currency region becomes reachable, the "primary" balance should be resolved from the character's current `AreaContentDefinition` rather than hardcoded to CZK.

---

## 3. Non-pay-to-win cosmetic & Life Skill progression

Two progression tracks are explicitly **not** gated behind real-money or Net-Worth-counted spending:

- **Street Cred / Transmog** — Street Cred (earned through play, not purchase) buys Transmog: cosmetic appearance overrides with zero stat effect. It is excluded from Net Worth (§2) by design, not omission — the goal is a reputation/fashion economy that never becomes a second pay-to-win axis.
- **Life Skill professions** — non-combat crafting/gathering loops (Salvaging, Fishing, Cooking are the three named so far) that produce their own goods and their own sense of progress, orthogonal to combat leveling and to wealth. None of the three exist as systems yet; this section records intent, not a build.

---

## 4. Regional progression roadmap

The intended order regions become reachable, mirrored by which currency "unlocks" alongside each:

1. **Pilsen** (current) — CZK. The only realized region; see `WORLD_VISION.md` §3–4 for its own city/district roadmap.
2. **European Metros** — EUR-denominated hubs (Prague and České Budějovice, per `WORLD_VISION.md` §3, are Czech and would likely stay CZK-denominated rather than EUR; which specific cities open the EUR tier is undecided).
3. **Asian Monastic Hubs** — RMB/JPY-denominated hubs, paired with the Martial/Monastic archetype (§1).

No relative sequencing beyond "Pilsen first, then European Metros, then Asian Monastic Hubs" is decided — exact cities, order within each tier, and level-gating are all open questions, same as `WORLD_VISION.md` §6 already flags for geography generally.

---

## 5. Explicitly undecided

- Whether/how currencies are ever exchanged between each other (a trading feature, vendor conversion, or purely fixed content rates forever).
- Whether Gold Bullion has any use beyond a hedge/flavor asset (crafting material, vendor currency of its own).
- The concrete mechanics of Salvaging, Fishing, and Cooking.
- Which specific cities anchor the European Metro and Asian Monastic Hub tiers.
