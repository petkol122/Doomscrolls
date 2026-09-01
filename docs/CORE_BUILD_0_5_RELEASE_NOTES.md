# docs/CORE_BUILD_0_5_RELEASE_NOTES.md — Core Build 0.5 Release Notes

---

## Core 0.5 Planning Opened

**Date:** 2026-09-01
**Build:** Core Build 0.5
**Status:** Planning open
**Previous Build State:** Core Build 0.4 is now treated as **RC / bugfix-only**

### Summary

Core Build 0.5 is now opened as the next scoped build after the Core Build 0.4 world/quest expansion checkpoint (Tasks 342-355). The Wave 5 hardening audit originally planned for 0.4 was explicitly skipped by product decision to move faster into gameplay-facing work.

The 0.5 theme is:

**Itemization and Loot Depth**

The goal of 0.5 is to turn the current placeholder-level item system (7 fixed items, 2 rarity tiers, 4 of 9 equipment slots actually fillable) into a real loot-driven progression loop, without opening crafting, affix-rolling, or full economy systems.

This is a scope-opening documentation milestone only. No runtime code, gameplay systems, schema changes, UI implementation, or new content implementation were added as part of this task.

### What changed in planning

- Added **`docs/CORE_BUILD_0_5_PLAN.md`** to define the build theme, goal, an audited baseline of the current itemization state, pillars, waves, risks, non-goals, and recommended first implementation task.
- Added **`docs/CORE_BUILD_0_5_CHECKLIST.md`** to track the opened 0.5 planning scope and future implementation waves.
- Added **`docs/CORE_BUILD_0_5_RELEASE_NOTES.md`** to record the 0.5 planning-open milestone.
- Updated **`docs/CORE_BUILD_0_4_CHECKLIST.md`** to explicitly mark Core Build 0.4 as RC / bugfix-only.

### Core 0.5 Pillars

1. **Equipment slot coverage** — fill the `head`, `hands`, `feet`, `amulet`, and `belt` slots, which are defined in the equipment schema but currently have no obtainable item.
2. **Rarity and stat variety** — consider a third rarity tier and widen the stat-modifier vocabulary beyond armor/maxHp/damage.
3. **Loot table depth** — differentiate drops per enemy archetype instead of sharing one near-duplicate table.
4. **Inventory/equipment UX** — add gear comparison to the existing equipment panel now that there's more than one item per slot to choose from.
5. **Vendor follow-through (secondary)** — give new items a modest vendor presence, no economy rework.

### Explicit non-goals

```text
crafting / enchanting / upgrading systems
procedural/random affix rolling unless explicitly re-scoped
legendary or unique items with special effects
new equipment slot types beyond the 9 already defined
full economy (auction house, trading, restock timers)
Vue / app-shell migration
class/skill overhaul
pets / mounts / familiars
professions, housing, guilds, PvP
large new zone
```

### Recommended first implementation task

**Wave 2 — Equipment Slot Coverage**: add items for the five currently-empty equipment slots. It's the lowest-risk, most concrete gap, reuses the existing item/loot-table schema unchanged, and makes the new build theme visible in play immediately.

### Build-state note

Core Build 0.5 should be understood as a **controlled depth pass**, not a system rewrite. It fills gaps that already exist in the schema (empty slots, flat rarity, shared loot tables) rather than introducing new item mechanics. The existing 0.3/0.4 playable loop remains the baseline that 0.5 must preserve while making loot feel like real progression.
