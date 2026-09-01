# docs/CORE_BUILD_0_5_CHECKLIST.md — Core Build 0.5 Checklist

---

## Core 0.5 Planning Open Checklist

**Date:** 2026-09-01
**Build:** Core Build 0.5
**Theme:** Itemization and Loot Depth
**Status:** Planning opened. Core Build 0.4 is RC / bugfix-only.

### Planning Deliverables

- [x] Create `docs/CORE_BUILD_0_5_PLAN.md`
- [x] Create `docs/CORE_BUILD_0_5_CHECKLIST.md`
- [x] Create `docs/CORE_BUILD_0_5_RELEASE_NOTES.md`
- [x] Mark Core Build 0.4 as RC / bugfix-only in `docs/CORE_BUILD_0_4_CHECKLIST.md`
- [x] Define Core Build 0.5 theme
- [x] Define Core Build 0.5 goal
- [x] Audit current itemization state as the plan's factual baseline
- [x] Define Core Build 0.5 feature pillars
- [x] Define candidate task waves
- [x] Define explicit 0.5 non-goals
- [x] Define the 0.5 risk list
- [x] Define the recommended first implementation task

### Core 0.5 Scope Guardrails

- [x] 0.5 is explicitly framed as building on the shipped 0.4 loop
- [x] No new equipment slot types — fill the 9 already defined, don't add more
- [x] Items stay fixed-roll (same item ID = same stats) unless per-drop rolling is explicitly re-scoped
- [x] No crafting / enchanting / upgrading systems
- [x] No full economy (auction house, trading, restock timers)
- [x] Loot table mechanism (weighted `LootTableDefinition`) is extended with data, not redesigned

### Candidate Wave Checklist

#### Wave 1 — Planning and 0.4 Freeze

- [x] Finalize 0.5 scope documents
- [x] Mark Core Build 0.4 as RC / bugfix-only in relevant docs
- [x] Reconfirm the 0.4 loop as the stable baseline 0.5 must not break

#### Wave 2 — Equipment Slot Coverage

- [x] Add at least one item for the `head` slot
- [x] Add at least one item for the `hands` slot
- [x] Add at least one item for the `feet` slot
- [x] Add at least one item for the `amulet` slot
- [x] Add at least one item for the `belt` slot
- [x] Wire new items into loot tables and/or vendor stock so they're obtainable through play

Task 356 status note:

- [x] Added 5 new items filling every previously-dead equipment slot: `scavenged_hood` (head), `wraptape_gloves` (hands), `sewer_treads` (feet), `scrapcord_belt` (belt), `signal_scarred_amulet` (amulet, rare).
- [x] All 9 equipment slots defined in `equipmentSlots.ts` now have at least one obtainable item.
- [x] Reused the existing `ItemContentDefinition` shape and `StatModifier` model — no new item schema, no new equipment slot types, no new item categories.
- [x] Used previously-unused-in-content stat modifier targets (`attackCooldownMs`, `moveSpeed`, `toughness`, `mind`) that were already supported by `SUPPORTED_STAT_MODIFIER_TARGETS` and clamped safely by `CharacterStatsService.applyDerivedModifiers` (min 1 for `attackCooldownMs`, min 0.01 for `moveSpeed`) — verified by reading the clamp logic, not just assumed.
- [x] Wired all 5 items into both `sewer_starter_loot` and `sewer_brute_loot` loot tables (common weight 6, rare `signal_scarred_amulet` weight 1/2) and added matching vendor stock entries so items are obtainable through both RNG drops and a guaranteed purchase path.
- [x] Added localization name/description keys for all 5 items to `en.ts` and `LocaleTypes.ts` `REQUIRED_LOCALIZATION_KEYS`, matching the existing item key convention.
- [x] Manually cross-checked every new item/loot-table/vendor-stock entry against `ContentValidation.ts` rules (unique IDs, known equipment slots, known stat modifier targets, loot-entry rarity must match the item's declared rarity, positive loot weights) — `validateContentRegistry` itself isn't wired into any build/test script in this repo (matches existing 0.3/0.4 task verification depth), so this was a manual rule-by-rule check rather than an automated run.
- [x] No crafting, affix rolling, new rarity tier, or economy changes — those remain Wave 3+/non-goals.
- [x] `pnpm typecheck` — 0 errors.

#### Wave 3 — Rarity and Loot Table Depth

- [ ] Evaluate whether a third rarity tier is warranted; add it if so
- [ ] Differentiate loot tables per enemy archetype (runt/skitter/brute) instead of the current shared pool
- [ ] Expand stat-modifier variety on new/existing items beyond armor/maxHp/damage

#### Wave 4 — Inventory/Equipment UX

- [ ] Add a gear comparison affordance (equipped vs. selected item) to the existing equipment panel
- [ ] Verify equip/unequip clarity across all 9 slots, including the newly-filled ones

#### Wave 5 — Polish and RC Closure

- [ ] Audit loot/reward-duplication safety alongside existing 0.4 guards
- [ ] Audit inventory/equipment persistence across reconnect and TownRoom ↔ CombatRoom handoff
- [ ] Close toward controlled 0.5 RC / bugfix-only state

### Explicit Non-Goals / Deferred Items

- [x] No crafting / enchanting / upgrading systems
- [x] No procedural/random affix rolling unless explicitly re-scoped later
- [x] No legendary/unique items with special effects
- [x] No new equipment slot types
- [x] No full economy (auction house, trading, restock timers)
- [x] No Vue / app-shell migration
- [x] No class/skill overhaul
- [x] No pets / mounts / familiars
- [x] No professions, housing, guilds, PvP
- [x] No large new zone

### Planning Exit Criteria

- [x] Core Build 0.5 has a clear theme
- [x] Core Build 0.5 has a clear goal grounded in the actual current itemization state
- [x] Core Build 0.5 has defined feature pillars
- [x] Core Build 0.5 has grouped candidate waves
- [x] Core Build 0.5 has explicit non-goals
- [x] Core Build 0.5 has an explicit risk list
- [x] Core Build 0.4 is clearly treated as RC / bugfix-only
- [x] The next implementation task can be selected directly from the plan (Wave 2 — Equipment Slot Coverage)
