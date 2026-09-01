# docs/CORE_BUILD_0_6_PLAN.md — Core Build 0.6 Plan

## Status

**Planning phase.** Core Build 0.5 is now frozen at **Release Candidate / bugfix-only** status (Waves 1-4 shipped as Tasks 356-358; the Wave 5 hardening audit was explicitly skipped by product decision, mirroring the same call made to close 0.4). Core Build 0.6 planning begins as the next scoped build.

Core Build 0.6 must **build on the shipped 0.5 loop** (9/9 equipment slots obtainable, per-archetype loot tables, gear comparison affordance) rather than replace it.

No runtime code changes, gameplay implementation, schema changes, or UI implementation are part of this planning task.

---

## Core 0.6 Theme

**Second Combat Area**

---

## Core 0.6 Goal

Give the game a second place to fight things. Every build since 0.2 has explicitly carried "no large new zone" as a non-goal, which means combat and progression have shared exactly one combat space — Blackwire Sewers — for five builds straight. That single-zone ceiling is now the shared bottleneck for both systems, not a symptom of either being incomplete:

- **Combat** cannot introduce a new enemy silhouette, AI wrinkle, or pressure pattern without it reading as a reskin of the existing Trashboar-family pocket.
- **Progression** cannot seed a third rarity tier or a genuinely distinct loot identity — Task 357 (0.5) explicitly declined a third tier because there was nowhere for it to live without launching "dead."

0.6 is not a full new-region system (no new kraj/city, no new hub, no new class/skill content). It is the next controlled step from "one combat pocket" toward "combat has a second place to go," reusing the CombatRoom/spawn-zone/loot pipeline that already exists.

---

## Build Framing — Current Zone/Routing State (audited 2026-09-01)

This is what actually exists in the codebase today, not aspirational:

- **Exactly 2 zones are defined** (`packages/content/src/data/zones.ts`): `nightmarket` (`roomType: "town"`, `classification: "test_hybrid"`) and `blackwire_sewers` (`roomType: "combat"`, `classification: "combat"`, 800x600 bounds, 4-player cap). `blackwire_sewers.transitionZoneIds` only lists `nightmarket` and vice versa — there is no third zone in either direction.
- **`CombatRoom` is already zone-agnostic where it matters.** `initializeCombatEnemies()` and `initializeCombatInteractables()` both take a `zoneId` parameter and filter `contentRegistry.spawnZones` / `contentRegistry.worldProps` by it — they do not hardcode Blackwire. `CombatRoomJoinOptions.requestedZoneId` is read at join time; only the *fallback* (`options.requestedZoneId ?? "blackwire_sewers"`, `CombatRoom.ts:274`) assumes Blackwire, and only when the caller omits a zone. This means the room/schema layer needs no rework to host a second combat zone — it needs content.
- **`waypointService.ts` is where the real hardcoding lives**, not the room layer. Every routable destination is a named constant, not data: `NIGHTMARKET_WAYPOINT_OBJECT_ID`, `BLACKWIRE_COMBAT_EDGE_WAYPOINT_OBJECT_ID`, `BLACKWIRE_GATE_OBJECT_ID`, `BLACKWIRE_RETURN_OBJECT_ID`. `resolveRouteTravel()` and `resolveWaypointTravel()` both branch on `objectId === <constant>` and return a literal `zoneId: "blackwire_sewers" as ZoneId"` inline. Adding a second combat zone by copy-pasting this pattern a second time would double the hardcoded branch count; this file is the actual design decision point for 0.6, not a copy-paste target.
- **`ZoneId` is a branded string** (`packages/shared/src/ids.ts:12`, `Brand<string, "ZoneId">"`), not a closed union — a new zone id is a data addition, not a type-system change.
- **The Nightmarket world map is already built as a corridor toward Blackwire**, staged in six labeled "regions" in `worldProps.ts` (service cluster → skitter pocket → runt/sewer-edge → brute deep edge → **"Region 6: Far filler beyond combat areas"**, x ≈ 4480-4780, currently just ambient junk/lamp/chicken props with no gate). That unused far region is the most natural physical location for a second gate without redesigning the existing route.
- **Client-side combat handoff is already data-driven.** `WorldSessionScene.ts` reads `targetZoneId` off the `town_combat_handoff_approved` server message (`WorldSessionScene.ts:489-497`) and only falls back to the literal `"blackwire_sewers"` string when the server omits the field. No client zone-name hardcoding blocks a second zone.
- **Blackwire Sewers itself has 4 spawn zones today** (`spawnZones.ts`): 2 runt pockets, 1 skitter pocket, 1 brute anchor — all reusing the same 3 Trashboar variants. There is no second enemy family anywhere in content.
- **Combat player cap is zone-scoped** (`maxPlayers: 4` on `blackwire_sewers`), so a second combat zone's cap is a per-zone content value, not a shared constant.

Core 0.6 should answer:

> Now that itemization has real depth (0.5), does the game have anywhere else to actually use it?

---

## Major Feature Pillars

### 1. Second Combat Zone — Content and Routing

**Goal:** A second `roomType: "combat"` zone exists, is reachable from Nightmarket through the existing gate/waypoint pattern, and is a real, distinct destination — not a copy of Blackwire Sewers with different coordinates.

Candidate scope:

- Add a new `ZoneContentDefinition` (new `zoneId`, `classification: "combat"`, its own `bounds`, `transitionZoneIds: ["nightmarket"]`; add its id to `nightmarket.transitionZoneIds`).
- Add a physical gate prop in Nightmarket's unused Region 6 space (`combat_return_gate`-style prop pair: an outbound gate in Nightmarket and a `combat_return_gate` inside the new zone, mirroring `combat_return_to_nightmarket`).
- Add a waypoint destination entry so the new zone follows the same activate-once/travel pattern as `BLACKWIRE_COMBAT_EDGE_WAYPOINT_ID`.
- Add `spawnPoints` entries for zone entry and the Nightmarket-side return landing, mirroring `nightmarket_blackwire_combat_entry` / `nightmarket_services_return`.

Guardrails:

- No new `roomType` or `classification` values — reuse `"combat"` exactly as Blackwire Sewers uses it.
- No change to `CombatRoom.ts` gameplay logic (movement, attack, dodge, flask, telegraph, loot pickup) — the new zone rides the same server-authoritative simulation Blackwire already uses.
- Keep the new zone's `maxPlayers` and `bounds` independent, sized-for-content values, not copy-pasted from Blackwire.

### 2. Routing Generalization (waypointService.ts)

**Goal:** Stop hardcoding per-destination object-id/zone-id branches in `waypointService.ts` before a third zone makes the pattern worse.

Candidate scope:

- Generalize `resolveRouteTravel()` / `resolveWaypointTravel()` / `resolveWaypointFromObjectId()` / `buildWaypointDestinations()` to resolve from a small content-driven routing table (object id → destination zone id + spawn id + handoff kind) instead of a growing set of named `const` object ids and inline `zoneId` literals.
- Keep the existing `RouteTravelSuccess` / `WaypointTravelSuccess` message shapes unchanged — this is an internal resolution refactor, not a protocol change.

Guardrails:

- No change to the client-facing message contract (`RequestRouteTravel`, `waypoint_opened`, `town_combat_handoff_approved`, etc.) — `WorldSessionScene.ts` already consumes these generically.
- This pillar exists to serve Pillar 1, not as an open-ended routing-system rewrite; scope it to "make the second zone additive instead of another hardcoded branch," not "build a generic zone graph."

### 3. Enemy/Encounter Identity for the New Zone

**Goal:** The new zone should feel like a different fight, not Blackwire Sewers with a re-tinted floor.

Candidate scope:

- Minimum viable: reuse the existing Trashboar-family enemies in new `spawnZones` entries scoped to the new zone id, with a different pocket layout/density than Blackwire's 4-pocket arrangement.
- Stretch (if time allows): one new `EnemyContentDefinition` reusing the existing enemy schema/AI states (idle/aggro/chase/attack/leash/defeat/respawn) — no new AI states, no new combat mechanics, just new stat/behavior numbers on the existing shape, matching how `trashboar_skitter`/`trashboar_brute` were added as variants in 0.1/0.4.

Guardrails:

- No new AI state machine, no projectile/ranged enemy type, no pack/group-aggro mechanic — reuse `enemyAiHelpers.ts` exactly as-is.
- If a new enemy is added, it must go through the same `EnemyContentDefinition` shape and `ContentValidation.ts` rules as existing enemies.

### 4. Loot Identity for the New Zone

**Goal:** Now that there's a second combat zone, itemization (0.5) has somewhere to differentiate by *place*, not just by enemy archetype within one zone.

Candidate scope:

- A new `lootTableId` (or set of them) scoped to the new zone's enemies, reusing the existing weighted `LootTableDefinition` mechanism unchanged.
- Revisit the "no third rarity tier yet" decision from Task 357 only if the new zone's item count gives a mid tier real population — this is an explicit re-evaluation, not an automatic yes.

Guardrails:

- No new items are required by this plan itself; if new items are added for the new zone's table, they follow the exact `ItemContentDefinition` pattern from Task 356 (existing categories/slots only, no new item schema).
- Do not touch Blackwire Sewers' existing loot tables as part of this pillar — this is additive, not a rebalance pass.

### 5. Objective/Quest Follow-Through (secondary, if time allows)

**Goal:** Give the notice-board objective sequence a reason to send players to the new zone, without redesigning the quest system.

Candidate scope:

- One additional objective entry in the existing `NOTICE_BOARD_OBJECTIVE_SEQUENCE` content pointing at the new zone's enemies, reusing the exact objective-definition shape from 0.3/0.4.

Guardrails:

- No new objective type, no branching quest logic, no dialogue system — this stays "one more entry in an existing content-driven sequence."

---

## Core 0.6 Non-Goals

```text
new town/hub zone (safe_hub) — this is a second combat zone, not a second Nightmarket
new region/kraj, world-map travel between cities
new class, skill, or talent content
new AI state machine, ranged/projectile enemies, group-aggro mechanics
crafting / enchanting / affix rolling
new equipment slot types
full economy (auction house, trading, restock timers)
Vue / app-shell migration
pets / mounts / familiars
professions, housing, guilds, PvP
generic zone-graph / open-world routing rewrite (Pillar 2 stays scoped to serving Pillar 1)
```

---

## 0.5 Freeze / Stability Baseline

Core Build 0.5 should now be treated as the stable shipped baseline. That means:

- 0.5 remains **RC / bugfix-only**.
- No new 0.5 feature pillar should be opened.
- New scope is planned under 0.6.
- Any 0.5 bug fix must be minimal and regression-focused.

The baseline loop being preserved is the full 0.4 loop plus 0.5's additions:

```text
Nightmarket hub
→ notice board objective catalog (select from available objectives)
→ route/waypoint travel to Blackwire Sewers combat pocket
→ enemy kill (runt/skitter/brute mix, per-archetype loot tables) / loot / XP / objective progress
→ gear comparison against currently-equipped item, 9/9 equipment slots fillable
→ return to town via physical return gate
→ turn-in / vendor / stash / completed-objective history / repeat
```

---

## Candidate Task Waves

### Wave 1 — Planning and 0.5 Freeze

- Finalize 0.6 scope documents
- Reconfirm the 0.5 loop as the stable baseline 0.6 must not break

### Wave 2 — Routing Generalization

- Refactor `waypointService.ts` resolution functions onto a small content-driven routing table
- Verify existing Blackwire Sewers routes (gate, return, waypoint) still resolve identically through the generalized path — this wave must be a pure internal refactor with no player-visible behavior change

### Wave 3 — Second Combat Zone Content and Routing

- Add the new `ZoneContentDefinition`, gate/return props, waypoint destination entry, and spawn points
- Wire the new zone into Nightmarket's Region 6 space and into `transitionZoneIds` both directions

### Wave 4 — Encounter and Loot Identity

- Add spawn-zone pockets for the new zone (reused Trashboar family at minimum; new enemy if time allows)
- Add a zone-scoped loot table (or tables); re-evaluate the third-rarity-tier decision only if population genuinely supports it

### Wave 5 — Polish and RC Closure

- Optional notice-board objective entry pointing at the new zone
- Manual verification of the full second-zone loop (travel in, fight, loot, return)
- Close toward controlled 0.6 RC / bugfix-only state

---

## Risks

1. **Routing refactor regressing Blackwire Sewers.** Wave 2 touches the only code path that currently routes players into combat at all — a bug here breaks the existing 0.3-0.5 loop, not just new content. Wave 2 must ship and be verified as behavior-identical before Wave 3 content is added on top of it.
2. **New zone reading as a reskin.** The stated goal is "a second place to fight things," not "the same fight with new wallpaper" — Pillar 3/4 guardrails exist specifically so the zone earns its own identity through spawn layout and loot, even if no new enemy ships.
3. **Scope creep toward a second hub or region system.** "Second combat area" invites feature creep toward a second town, a world map, or a region-selection UI; the non-goals list exists to keep this to one combat zone reachable the same way Blackwire is.
4. **Content pipeline scaling (second time).** 0.5 already exercised `ContentValidation.ts` at a larger item count; 0.6 exercises it at a larger zone/spawn-zone/loot-table count. Same watch-item as 0.5's plan, now applied to zones instead of items.

---

## Decision: Recommended First Path After Planning

Start with **Wave 2 — Routing Generalization**, before any new zone content exists. It's a pure refactor with a clear regression check (Blackwire's existing routes must resolve identically), it removes the actual scaling bottleneck (`waypointService.ts`'s hardcoded per-destination branches) before a second zone doubles that hardcoding, and it de-risks every later wave by giving Wave 3 a real content-driven slot to add the new zone into instead of a third copy-pasted branch.

---

## Validation Expectations for Future 0.6 Tasks

```bash
pnpm typecheck
```

(No `lint`/`test`/`build` scripts are currently exercised per-task in this repo's established workflow — see 0.4/0.5 task notes, which verify via `pnpm typecheck` only.)

Manual validation should emphasize:

- no regression in the shipped 0.5 loop, especially existing Blackwire Sewers routing after Wave 2,
- the new zone is reachable and returns to Nightmarket cleanly (gate and waypoint both, matching Blackwire's dual-path pattern),
- enemy AI, loot drop, XP, and persistence behave identically to Blackwire's proven pipeline in the new zone (no parallel/divergent implementation),
- new zone content passes the same manual `ContentValidation.ts` rule-by-rule check used in 0.5 (`validateContentRegistry` is still not wired into any build/test script).

---

## Summary

Core Build 0.6 is the **Second Combat Area** build.

Its job is to give combat and progression a second place to exist — reusing the CombatRoom/spawn-zone/loot pipeline that already generalizes cleanly, generalizing the one part that doesn't (`waypointService.ts`'s hardcoded routing) before building on top of it, and adding one real new combat zone without opening a second hub, a new region system, or new combat mechanics that haven't been explicitly scoped.
