# docs/CORE_BUILD_0_5_PLAN.md — Core Build 0.5 Plan

## Status

**Planning phase.** Core Build 0.4 is now frozen at **Release Candidate / bugfix-only** status (Waves 1-4 shipped as Tasks 342-355; the Wave 5 hardening audit was explicitly skipped by product decision to move faster). Core Build 0.5 planning begins as the next scoped build.

Core Build 0.5 must **build on the shipped 0.4 loop** (town services, waypoint travel, TownRoom ↔ CombatRoom handoff, notice board objective catalog, completed-objective history, XP rewards, Blackwire Sewers enemy pocket) rather than replace it.

No runtime code changes, gameplay implementation, schema changes, or UI implementation are part of this planning task.

---

## Core 0.5 Theme

**Itemization and Loot Depth**

---

## Core 0.5 Goal

Turn the current placeholder-level item system into a real loot-driven progression loop: fill out the equipment slots that already exist but are empty, add meaningful stat/rarity variety to drops, and make gearing up feel like a consequence of playing rather than a fixed 7-item catalog.

0.5 is not a crafting/economy rewrite. It is the next controlled step from "a handful of fixed items" toward "loot is a real reason to fight."

---

## Build Framing — Current Itemization State (audited 2026-09-01)

This is what actually exists in the codebase today, not aspirational:

- **7 item definitions total** (`packages/content/src/data/items.ts`): `starter_pipe` (weapon), `sewer_jacket` (chest), `starter_blood_flask` (flask), `blackwire_scrap`/`scrap_cloth`/`tarnished_coin` (materials, no stats), `rustbound_ring` (accessory).
- **9 equipment slots are defined** (`equipmentSlots.ts`: weapon, head, chest, hands, feet, ring_1, amulet, belt, flask_1) but **only 4 have any item that can fill them** (weapon, chest, ring_1, flask_1). head/hands/feet/amulet/belt are dead slots today.
- **Only 2 rarity tiers exist**: `common`, `rare`. No uncommon/epic/legendary tier, no unique/named items.
- **No random affix rolling.** Every instance of a given `itemId` has identical, fixed `statModifiers` baked into the content definition. "Loot" currently means "which fixed item did the weighted table pick," not "what stats did this drop roll."
- **2 loot tables** (`sewer_starter_loot`, `sewer_brute_loot`) that are near-duplicates of the same 6-entry pool with slightly different weights, shared across all three enemy types (runt/skitter/brute) via `EnemyContentDefinition.lootTableId`.
- **Vendor buy/sell exists** (`VendorSellTypes.ts`, `request_sell_item` path) against a fixed 3-item stock (`vendorStocks.ts`) — server-authoritative, no restock/refresh timer.
- **Stash and inventory grid exist** (10x6 grid, server-side placement validation) from 0.1/0.2/0.3 work.
- Task 353 (0.4) added a small data-driven spawn-pocket pass in Blackwire Sewers reusing the existing enemy archetypes — that content is live and can be a testbed for new loot without touching zone/enemy systems.

Core 0.5 should answer:

> Now that a real world/quest loop exists (0.3-0.4), does killing things and looting feel like it's going anywhere?

---

## Major Feature Pillars

### 1. Equipment Slot Coverage

**Goal:** Every equipment slot that already exists in the schema should have at least one obtainable item.

Candidate scope:

- Add items for the currently-dead slots: `head`, `hands`, `feet`, `amulet`, `belt`.
- Reuse the existing `ItemContentDefinition` shape and `statModifiers` model — no new item schema needed for this pillar.
- Fold new items into the existing loot tables (or a new table) so they're actually obtainable through play, not just vendor-only.

Guardrails:

- No new equipment slot types (the 9 slots are already defined; fill them, don't add more).
- No new item categories beyond `weapon | armor | accessory | belt | flask | material` unless a real gap is found.

### 2. Rarity and Stat Variety

**Goal:** Make rarity mean something beyond a label, and give drops more than one or two stat lines.

Candidate scope:

- Consider a third rarity tier (e.g. `uncommon`) between `common` and `rare` if the two-tier spread feels too flat once more items exist.
- Expand the range of `statModifiers` targets actually used in item content (currently only `armor`, `maxHp`, `damage` appear) — e.g. move speed, attack cooldown — reusing the existing `StatModifier` type in `@doomscrolls/shared`, not inventing a new stat system.
- Keep items **fixed-roll** (same item ID = same stats) unless investigation shows real per-drop rolling is small enough to stay in scope; do not silently start a full affix-roll system without calling it out as its own task.

Guardrails:

- No legendary/unique-with-special-effect items in 0.5 unless explicitly re-scoped.
- No new derived-stat systems beyond what `PrimaryStats`/derived stats in `@doomscrolls/shared` already support.

### 3. Loot Table Depth

**Goal:** Make what an enemy drops feel tied to that enemy, not to "the shared sewer table."

Candidate scope:

- Differentiate loot tables per enemy archetype (runt/skitter/brute) now that there's more than one enemy pocket (Task 353's Blackwire Sewers pass).
- Route new equipment-slot items (Pillar 1) into loot tables at sensible weights.
- Keep the existing weighted-table model (`LootTableDefinition` / `LootTableEntryDefinition`) — it already works and is server-authoritative; extend data, don't redesign the mechanism.

Guardrails:

- No drop-rate/loot-table rework that risks destabilizing existing reward-duplication guards from 0.4 (Task 349's `rewardGranted` discipline stays as-is; loot drops are a separate code path already).

### 4. Inventory/Equipment UX for Real Gearing

**Goal:** Now that there's more than one item per slot to choose from, the client needs to support comparing and swapping gear, not just displaying a static loadout.

Candidate scope:

- Item comparison affordance (currently-equipped vs. hovered/selected item) in the existing equipment/inventory panel from 0.4's overlay work.
- Equip/unequip clarity for newly-filled slots.

Guardrails:

- No inventory grid redesign — the 10x6 grid and placement validation stay as they are.
- No drag-and-drop rework unless the current click-to-equip flow is found to be actually broken for the new slots.

### 5. Vendor/Economy Follow-Through (secondary, if time allows)

**Goal:** Give the new items *some* economic presence without opening a full economy build.

Candidate scope:

- Extend vendor stock with a subset of the new items, at prices consistent with `priceCopper` already in use.

Guardrails:

- No restock timers, no player-to-player trading, no auction house. This stays "flavor," not a build pillar.

---

## Core 0.5 Non-Goals

```text
crafting / enchanting / upgrading systems
procedural/random affix rolling (unless explicitly re-scoped as its own task)
legendary or unique items with special on-hit/on-equip effects
new equipment slot types beyond the 9 already defined
full economy (auction house, player trading, restock timers)
Vue / app-shell migration
class/skill overhaul
pets / mounts / familiars
professions, housing, guilds, PvP
large new zone
```

---

## 0.4 Freeze / Stability Baseline

Core Build 0.4 should now be treated as the stable shipped baseline. That means:

- 0.4 remains **RC / bugfix-only**.
- No new 0.4 feature pillar should be opened.
- New scope is planned under 0.5.
- Any 0.4 bug fix must be minimal and regression-focused.

The baseline loop being preserved is the full 0.3 loop plus 0.4's additions:

```text
Nightmarket hub
→ notice board objective catalog (select from available objectives)
→ route/waypoint travel to Blackwire Sewers combat pocket
→ enemy kill (runt/skitter/brute mix) / loot / XP / objective progress
→ return to town via physical return gate
→ turn-in / vendor / stash / completed-objective history / repeat
```

---

## Candidate Task Waves

### Wave 1 — Planning and 0.4 Freeze

- Finalize 0.5 scope documents
- Mark Core Build 0.4 as RC / bugfix-only in relevant docs (done as part of opening this plan)
- Reconfirm the 0.4 loop as the stable baseline 0.5 must not break

### Wave 2 — Equipment Slot Coverage

- Add items for `head`, `hands`, `feet`, `amulet`, `belt`
- Wire new items into loot tables and/or vendor stock

### Wave 3 — Rarity and Loot Table Depth

- Evaluate and, if warranted, add a third rarity tier
- Differentiate loot tables per enemy archetype
- Expand stat-modifier variety on new/existing items

### Wave 4 — Inventory/Equipment UX

- Add gear comparison affordance to the existing equipment panel
- Verify equip/unequip clarity across all 9 slots

### Wave 5 — Polish and RC Closure

- Audit loot/reward-duplication safety alongside existing 0.4 guards
- Audit inventory/equipment persistence across reconnect and TownRoom ↔ CombatRoom handoff
- Close toward controlled 0.5 RC / bugfix-only state

---

## Risks

1. **Reward-duplication interaction** — new loot paths must not reopen the reward-duplication discipline established in Task 349 (0.4).
2. **Content pipeline scaling** — this is the first time item content grows meaningfully past the original 0.1/0.2 slice; watch that `ContentValidation.ts` and the registry keep scaling cleanly.
3. **Scope creep toward crafting/affixes** — "itemization" invites feature creep into rolling/crafting systems; stay on fixed-item-plus-loot-table until that's explicitly re-scoped.
4. **Inventory/equipment persistence** — more equippable items increases the surface for equip-state bugs across reconnect/handoff; reuse the existing persistence path rather than adding a parallel one.

---

## Decision: Recommended First Path After Planning

Start with **Wave 2 — Equipment Slot Coverage**. It's the lowest-risk, most concrete gap (5 of 9 slots are literally empty), reuses the existing item/loot-table schema unchanged, and immediately makes "itemization" visible in play before any rarity/UX work builds on top of it.

---

## Validation Expectations for Future 0.5 Tasks

```bash
pnpm typecheck
```

(No `lint`/`test`/`build` scripts are currently exercised per-task in this repo's established workflow — see 0.4 task notes, which verify via `pnpm typecheck` only.)

Manual validation should emphasize:

- no regression in the shipped 0.4 loop,
- no duplicate loot/reward grants,
- new equipment items are actually equippable and their stat modifiers apply,
- persistence survives reconnect and TownRoom ↔ CombatRoom handoff.

---

## Summary

Core Build 0.5 is the **Itemization and Loot Depth** build.

Its job is to fill out the equipment system that already exists in schema but not in content, give drops real variety, and make the loot loop that 0.3/0.4 built a reason to keep fighting — without opening crafting, affix-rolling, or economy systems that haven't been explicitly scoped.
