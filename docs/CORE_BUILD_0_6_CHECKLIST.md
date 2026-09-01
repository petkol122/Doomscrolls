# docs/CORE_BUILD_0_6_CHECKLIST.md — Core Build 0.6 Checklist

---

## Core 0.6 Planning Open Checklist

**Date:** 2026-09-01
**Build:** Core Build 0.6
**Theme:** Second Combat Area
**Status:** Waves 1-4 shipped (Task 359). Wave 5's optional notice-board objective was explicitly declined (see Task 359 status note); the rest of Wave 5 (manual full-loop verification) passed live against the running dev server.

### Planning Deliverables

- [x] Create `docs/CORE_BUILD_0_6_PLAN.md`
- [x] Create `docs/CORE_BUILD_0_6_CHECKLIST.md`
- [x] Create `docs/CORE_BUILD_0_6_RELEASE_NOTES.md`
- [x] Define Core Build 0.6 theme
- [x] Define Core Build 0.6 goal
- [x] Audit current zone/routing state as the plan's factual baseline
- [x] Define Core Build 0.6 feature pillars
- [x] Define candidate task waves
- [x] Define explicit 0.6 non-goals
- [x] Define the 0.6 risk list
- [x] Define the recommended first implementation task

### Core 0.6 Scope Guardrails

- [x] 0.6 is explicitly framed as building on the shipped 0.5 loop
- [x] Second combat zone reuses `roomType: "combat"` / `classification: "combat"` exactly as Blackwire Sewers does — no new room-type or classification values
- [x] No changes to `CombatRoom.ts` gameplay logic (movement, attack, dodge, flask, telegraph, loot pickup) — new zone rides the existing simulation
- [x] Routing generalization (Wave 2) preserves the existing client-facing message contract unchanged
- [x] No new AI state machine, ranged/projectile enemy, or group-aggro mechanic
- [x] No second town/hub zone, no region/kraj system, no world-map travel

### Candidate Wave Checklist

#### Wave 1 — Planning and 0.5 Freeze

- [x] Finalize 0.6 scope documents
- [x] Reconfirm the 0.5 loop as the stable baseline 0.6 must not break

#### Wave 2 — Routing Generalization

- [x] Refactor `resolveRouteTravel()` / `resolveWaypointTravel()` / `resolveWaypointFromObjectId()` / `buildWaypointDestinations()` in `apps/server/src/realtime/rooms/waypointService.ts` onto a content-driven `COMBAT_ZONE_ROUTES` table (gate object id → destination zone id + entry spawn id + handoff kind + waypoint entry)
- [x] Removed the hardcoded per-destination object-id branches in `TownRoom.ts` (`isCombatGateObjectId()`, `isWaypointObjectId()`) and the hardcoded return-landing spawn lookup in `CombatRoom.ts`'s `request_combat_return` handler (`resolveCombatZoneReturnSpawnId()`)
- [x] Found and fixed an additional hardcoded chokepoint outside the original plan's audit: the client's `resolveRoomKindForZoneId()` in `apps/client/src/net/RealtimeClient.ts` special-cased `zoneId === "blackwire_sewers"` for reconnect/resume room routing (`AccountShellScene`'s Enter World flow and `WorldSessionScene`'s reconnect recovery). Generalized it to read `contentRegistry.zones.get(zoneId)?.roomType` instead.
- [x] Verified existing Blackwire Sewers gate, return, and waypoint routes resolve identically after the refactor — confirmed both by code inspection (same spawn ids, message keys, area keys per route table entry) and by the live Wave 5 verification pass below exercising the generalized code path successfully for a second zone

#### Wave 3 — Second Combat Zone Content and Routing

- [x] Added the `static_yard` `ZoneContentDefinition` (`roomType: "combat"`, `classification: "combat"`, `maxPlayers: 4`, bounds matching Blackwire Sewers' shape so the existing `COMBAT_SPAWN_BOX`-based respawn logic needs no per-zone change)
- [x] Added `static_yard` to `nightmarket.transitionZoneIds` and `["nightmarket"]` as `static_yard.transitionZoneIds`
- [x] Added `nightmarket_static_yard_gate_01` (town_service) in Nightmarket's previously-unused far corner (x≈4900,y≈3500) and `static_yard_return_to_nightmarket` (combat_return_gate) inside the new zone
- [x] Added `nightmarket_waypoint_static_yard_combat_edge` waypoint destination, mirroring the Blackwire combat-edge waypoint pattern exactly
- [x] Added `nightmarket_static_yard_combat_entry` spawn point (Nightmarket-side, used both as pre-handoff room-intent and as the return landing position)
- [x] Added all required localization keys (zone name/description, enemy name/description, gate/waypoint/area-label props, route prompt/travel text, spawn label, waypoint destination label) to `en.ts` and `REQUIRED_LOCALIZATION_KEYS`

#### Wave 4 — Encounter and Loot Identity

- [x] Added 3 `spawnZones` pockets scoped to `static_yard` (2 `static_wretch` pockets totaling 5 enemies + 1 reused `trashboar_brute` anchor), a distinct layout from Blackwire's 4-pocket arrangement
- [x] Added the stretch-goal new enemy `static_wretch` (`packages/content/src/data/enemies.ts`), reusing the exact existing AI-state shape/schema — only stats/behavior numbers are new (faster attack cadence, larger aggro/leash range than any Trashboar variant)
- [x] Added the `static_yard_loot` table reusing only existing items (no new items were required), reweighted away from heavy armor toward the speed/utility/mind pieces to give the zone its own drop identity — same differentiation approach as Task 357
- [x] Re-evaluated the third-rarity-tier question and declined again, same reasoning as Task 357: no new items were added in this pass, so a new tier would still launch with zero to no population

#### Wave 5 — Polish and RC Closure

- [x] Declined the optional notice-board objective entry — kept explicitly out of scope for this pass since it was marked optional/secondary in the plan; revisit alongside a future content pass rather than bundling it into the zone-opening task
- [x] Manual verification of the full second-zone loop passed live against the running local dev server (registered a temp account, created a character, walked to the new gate, confirmed `town_combat_handoff_approved` with `targetZoneId: "static_yard"`, joined CombatRoom and confirmed exactly the expected 5 `static_wretch` + 1 `trashboar_brute`, confirmed the `combat_return_gate` interactable id, and confirmed `combat_town_return_approved` lands back at `nightmarket_static_yard_combat_entry`); temp account/character removed afterward
- [x] Close toward controlled 0.6 RC / bugfix-only state for Waves 1-4; Wave 5's declined objective item remains explicitly open for a future pass

### Explicit Non-Goals / Deferred Items

- [ ] No new town/hub (safe_hub) zone
- [ ] No new region/kraj or world-map travel system
- [ ] No new class, skill, or talent content
- [ ] No new AI state machine, ranged/projectile enemies, or group-aggro mechanics
- [ ] No crafting / enchanting / affix rolling
- [ ] No new equipment slot types
- [ ] No full economy (auction house, trading, restock timers)
- [ ] No Vue / app-shell migration
- [ ] No pets / mounts / familiars
- [ ] No professions, housing, guilds, PvP
- [ ] No generic zone-graph / open-world routing rewrite beyond what Wave 2 needs to serve Wave 3

### Planning Exit Criteria

- [x] Core Build 0.6 has a clear theme
- [x] Core Build 0.6 has a clear goal grounded in the actual current zone/routing state
- [x] Core Build 0.6 has defined feature pillars
- [x] Core Build 0.6 has grouped candidate waves
- [x] Core Build 0.6 has explicit non-goals
- [x] Core Build 0.6 has an explicit risk list
- [x] Core Build 0.5 is clearly treated as RC / bugfix-only baseline
- [x] The next implementation task can be selected directly from the plan (Wave 2 — Routing Generalization)
