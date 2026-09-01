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

- [ ] Add at least one item for the `head` slot
- [ ] Add at least one item for the `hands` slot
- [ ] Add at least one item for the `feet` slot
- [ ] Add at least one item for the `amulet` slot
- [ ] Add at least one item for the `belt` slot
- [ ] Wire new items into loot tables and/or vendor stock so they're obtainable through play

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
