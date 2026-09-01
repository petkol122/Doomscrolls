# docs/CORE_BUILD_0_6_RELEASE_NOTES.md — Core Build 0.6 Release Notes

---

## Core 0.6 Planning Opened

**Date:** 2026-09-01
**Build:** Core Build 0.6
**Status:** Planning open
**Previous Build State:** Core Build 0.5 is now treated as **RC / bugfix-only**

### Summary

Core Build 0.6 is now opened as the next scoped build after the Core Build 0.5 itemization/loot depth checkpoint (Tasks 356-358). Every build since 0.2 has explicitly carried "no large new zone" as a non-goal; that guardrail is lifted for 0.6 specifically, because a five-build audit shows combat and progression now share the same bottleneck — Blackwire Sewers has been the only combat space in the game the entire time.

The 0.6 theme is:

**Second Combat Area**

The goal of 0.6 is to give the game a second real combat zone, reusing the CombatRoom/spawn-zone/loot pipeline that already generalizes cleanly, while generalizing the one part of the routing layer (`waypointService.ts`) that currently hardcodes every destination as a named per-object branch. This is not a second town/hub, a new region system, or new combat mechanics — it is one more place to fight, reached the same way Blackwire Sewers already is.

This is a scope-opening documentation milestone only. No runtime code, gameplay systems, schema changes, UI implementation, or new content implementation were added as part of this task.

### What changed in planning

- Added **`docs/CORE_BUILD_0_6_PLAN.md`** to define the build theme, goal, an audited baseline of the current zone/routing state, pillars, waves, risks, non-goals, and recommended first implementation task.
- Added **`docs/CORE_BUILD_0_6_CHECKLIST.md`** to track the opened 0.6 planning scope and future implementation waves.
- Added **`docs/CORE_BUILD_0_6_RELEASE_NOTES.md`** to record the 0.6 planning-open milestone.

Core Build 0.5's checklist already records 0.5 as RC / bugfix-only as of its own RC closure entry, so no additional freeze edit was needed there.

### Core 0.6 Pillars

1. **Second combat zone — content and routing** — a new `roomType: "combat"` zone, reachable from Nightmarket's currently-unused Region 6 space through the same gate + waypoint pattern Blackwire Sewers uses.
2. **Routing generalization** — refactor `waypointService.ts`'s hardcoded per-destination object-id/zone-id branches onto a small content-driven routing table before a second (and future third) zone doubles that hardcoding.
3. **Encounter identity** — new zone gets its own spawn-zone pocket layout (reused Trashboar family at minimum, one new enemy as a stretch goal), reusing the existing AI-state shape unchanged.
4. **Loot identity** — a zone-scoped loot table so itemization (0.5) has somewhere to differentiate by place, not just by enemy archetype within one zone.
5. **Objective follow-through (secondary)** — an optional notice-board entry pointing players at the new zone.

### Explicit non-goals

```text
new town/hub (safe_hub) zone
new region/kraj or world-map travel system
new class, skill, or talent content
new AI state machine, ranged/projectile enemies, group-aggro mechanics
crafting / enchanting / affix rolling
new equipment slot types
full economy (auction house, trading, restock timers)
Vue / app-shell migration
pets / mounts / familiars
professions, housing, guilds, PvP
generic zone-graph / open-world routing rewrite beyond what serves the second zone
```

### Recommended first implementation task

**Wave 2 — Routing Generalization**: refactor `waypointService.ts` onto a content-driven routing table before any new zone content exists. It is a pure internal refactor with a clear regression check (Blackwire Sewers' existing gate/return/waypoint routes must resolve identically afterward), and it removes the real scaling bottleneck this build's audit surfaced — not the `CombatRoom` schema layer, which is already zone-agnostic, but the routing layer, which is not.

---

### Build-state note

Core Build 0.6 should be understood as **one new combat zone added through the existing pipeline**, not a region/world-map system. It reuses the CombatRoom simulation, spawn-zone shape, and loot-table mechanism unchanged, and only touches routing resolution to make the addition data-driven instead of another hardcoded branch. The existing 0.3-0.5 playable loop remains the baseline that 0.6 must preserve while adding a second place for it to happen.

---

## Task 359 — Static Yard: the second combat zone (Waves 2-4)

**Date:** 2026-09-01
**Status:** Implemented

### Summary

Implemented Waves 2-4 of the 0.6 plan in one pass: generalized the hardcoded Blackwire-only routing layer, then added Static Yard — a new `combat` zone reachable from Nightmarket, with its own enemy, spawn layout, and loot table.

### What changed

- **`apps/server/src/realtime/rooms/waypointService.ts`**: replaced the per-destination hardcoded object-id constants and inline `zoneId: "blackwire_sewers"` literals with a `COMBAT_ZONE_ROUTES` content-driven table (gate object id → combat zone id, Nightmarket-side entry/return spawn id, handoff message keys, optional waypoint entry). Added `isCombatGateObjectId()`, `isWaypointObjectId()`, and `resolveCombatZoneReturnSpawnId()` as the new lookup surface.
- **`apps/server/src/realtime/rooms/TownRoom.ts`**: replaced 5 separate `message.objectId === "nightmarket_blackwire_gate_01"` / `"nightmarket_waypoint_01" || "nightmarket_waypoint_blackwire_combat_edge"` checks with `isCombatGateObjectId()` / `isWaypointObjectId()` calls against the routing table.
- **`apps/server/src/realtime/rooms/CombatRoom.ts`**: `request_combat_return` no longer hardcodes `"nightmarket_blackwire_combat_entry"` as the landing spawn for every combat zone's return gate — it now resolves the correct zone-specific landing spot via `resolveCombatZoneReturnSpawnId(state.zoneId)`. Without this fix, leaving Static Yard would have silently teleported the player to Blackwire's gate location in Nightmarket.
- **`apps/client/src/net/RealtimeClient.ts`**: found and fixed a hardcoded chokepoint outside the plan's original audit — `resolveRoomKindForZoneId()` special-cased `zoneId === "blackwire_sewers"` for the Enter World / reconnect-resume room-routing path, so a character who disconnected inside Static Yard would have been routed back into TownRoom instead of CombatRoom on their next login. Generalized to read the zone's `roomType` from the content registry.
- **`packages/content/src/data/types.ts`**: extended the `ZoneContentId`, `EnemyId`, `LootTableId`, `SpawnPointContentId`, `CombatInteractableId` unions for the new zone/enemy/loot-table/spawn-point/interactable ids.
- **`packages/content/src/data/zones.ts`**: added the `static_yard` zone (`combat`, bounds matching Blackwire Sewers' shape, `maxPlayers: 4`) and added it to `nightmarket.transitionZoneIds`.
- **`packages/content/src/data/enemies.ts`**: added `static_wretch` — the stretch-goal new enemy, reusing the exact existing AI-state shape/schema with new stats (faster attack cadence, largest aggro/leash range of any current enemy).
- **`packages/content/src/data/spawnZones.ts`**: added 3 pockets scoped to `static_yard` (2 `static_wretch` pockets = 5 enemies, 1 reused `trashboar_brute` anchor), a distinct layout from Blackwire's 4-pocket arrangement.
- **`packages/content/src/data/lootTables.ts`**: added `static_yard_loot`, reusing only existing items reweighted away from heavy armor toward the speed/utility/mind pieces added in Task 356.
- **`packages/content/src/data/worldProps.ts`**: added the Nightmarket-side gate (`nightmarket_static_yard_gate_01`), waypoint (`nightmarket_waypoint_static_yard_combat_edge`), and area label, plus the in-zone `combat_return_gate` (`static_yard_return_to_nightmarket`), placed in Nightmarket's previously-unused far corner (Region 6).
- **`packages/content/src/data/spawnPoints.ts`**: added `nightmarket_static_yard_combat_entry`, used both directions (pre-handoff room-intent and return landing).
- **`packages/localization/src/locales/en.ts`** and **`LocaleTypes.ts`**: added all required keys for the new zone/enemy/props/routes.

### Decision: no third rarity tier yet (again)

Re-evaluated per the 0.6 plan and declined again, same reasoning as Task 357: this pass added zero new items (the new loot table reuses existing ones), so a new tier would still launch empty. Revisit once a future pass adds real new items.

### Decision: notice-board objective skipped

Wave 5's optional notice-board entry pointing at Static Yard was left out of this pass. It was explicitly marked optional/secondary in the plan, and bundling it in would have mixed a quest-content change into a zone-opening/routing task. Left for a future content pass.

### Verification

- `pnpm typecheck` — 0 errors across all 5 workspace packages (localization, shared, content, client, server).
- Live end-to-end verification against the running local dev server (temp account/character): walked from Nightmarket spawn to the new gate, received `town_combat_handoff_approved` with `targetZoneId: "static_yard"`, joined CombatRoom and confirmed the room state reported exactly the expected enemy roster (5× `static_wretch`, 1× `trashboar_brute`) and the correct `combat_return_gate` interactable id, then confirmed `combat_town_return_approved` with `targetZoneId: "nightmarket"` and `targetSpawnKey: "nightmarket_static_yard_combat_entry"`. Temp account and character removed from the database afterward.
- Confirmed via the same live pass that a fresh combat-zone join is immediately contested by the zone's enemies (existing aggro-range behavior, unchanged by this task) — not a regression, but confirms the new zone's enemies are live and aggressive, not inert placeholders.
