# docs/CORE_BUILD_0_3_PLAN.md — Core Build 0.3 Plan

## Status

**Core Build 0.3 is now Release Candidate / bugfix-only.** This document remains the historical 0.3 planning record. The planned 0.3 playable-loop foundation shipped at checkpoint level, and new scope should move to Core Build 0.4 planning unless a confirmed 0.3 regression or broken shipped flow requires a minimal bug fix.

No new feature scope should be added under Core Build 0.3. Only regressions, broken shipped flows, or focused hardening fixes are allowed, and each such fix must stay within the existing 0.3 playable-loop surface.

---

## Source Roadmap

Core Build 0.3 is derived from the post-0.2 phases described in [`docs/POST_CORE_0_1_ROADMAP.md`](./POST_CORE_0_1_ROADMAP.md). That document remains the authoritative long-term roadmap.

---

## Core 0.3 Identity

Core Build 0.3 is the **Playable Loop Build**.

Its goal is to make Doomscrolls feel like a playable ARPG slice rather than a collection of individual systems. The 0.2 reliability and interaction-quality pass hardened the existing 0.1 surface. Now 0.3 connects the dots: vendors, stash, waypoints, quests, and proper town-to-combat-area routing so a player can experience a real gameplay loop from town → sewers → loot → vendor → stash → repeat.

---

## Major Feature Pillars

### 1. Vendor Foundation

**Goal:** Players can sell loot and buy basic supplies from town NPCs. Vendor stock comes from content definitions and may refresh or vary.

Candidate scope:

- Vendor interaction flow: click/interact on vendor NPC → vendor panel UI
- Buy behavior: server-authoritative purchase with currency deduction, inventory space check
- Sell behavior: server-authoritative sale with currency reward, item removal from inventory
- Vendor stock: data-driven from `vendorStocks.ts` content definitions
- Currency system: wire up `tarnished_coin` as spendable currency, add UI display
- Refresh / restock behavior: basic timer-based or zone-entry refresh
- Vendor panel UI: buyer-friendly list with prices, quantities, buy/sell confirmation

What is deferred from vendor foundation:

  - Haggling / barter / dynamic pricing
  - Repair service (durability system not yet in scope)
  - Gambling / unidentified item purchase
  - Vendor-specific quests or reputation

### 2. Stash Foundation

**Goal:** Players have persistent shared storage accessible from town stash keepers. Items placed in stash persist across sessions and are available to all characters on the same account.

Candidate scope:

- Stash storage schema: new `StashItem` or `StashSlot` model in Prisma
- Stash repository: CRUD operations for stash slots/items
- Stash interaction flow: click/interact on stash keeper → stash panel UI
- Grid-based stash UI: similar to inventory grid, shared across account characters
- Server-authoritative stash operations: deposit, withdraw, move within stash
- Stash persistence: items survive logout, refresh, server restart
- Stash access validation: only the owning account may interact with a given stash

What is deferred from stash foundation:

  - Stash tabs (premium or earned)
  - Stash search / filter
  - Stash affinity (currency tab, map tab, etc.)
  - Shared loot filter / auto-pickup rules

### 3. Waypoint / Travel Foundation

**Goal:** Players can activate waypoints in town and travel between discovered zones. Travel costs currency or is free; either way, it is server-authoritative and persists across sessions.

Candidate scope:

- Waypoint activation: interact with waypoint prop → mark as discovered in player state
- Waypoint travel UI: list of discovered waypoints, select destination, confirm travel
- Server-authoritative travel: validate discovery state, deduct cost if any, initiate zone/room transition
- Persistence: discovered waypoints survive logout/refresh
- Starting waypoints: Nightmarket waypoint discovered by default for new characters
- Travel cost: optional currency cost configurable per destination

What is deferred from waypoint/travel foundation:

  - Inter-zone waypoint networks (waypoints connecting to multiple zones)
  - Combat-zone internal waypoints
  - Party travel (all members travel together)
  - Fast-travel cooldown or interrupt mechanics

### 4. First Quest / Objective Loop

**Goal:** A simple first quest that guides the player from town into the sewers, asks them to kill enemies and/or collect loot, and rewards them on completion. This establishes the quest/objective data pipeline and objective-progression pattern for future quests.

Candidate scope:

- Quest content definitions: quest ID, name, description, objectives, rewards in `packages/content`
- Objective types: `kill_enemies`, `collect_items`, `reach_zone`, `talk_to_npc`
- Quest state persistence: per-character quest progress stored in DB
- Quest progression: server-authoritative objective tracking (kill count, item collection, zone entry)
- Quest completion: server validates all objectives met, awards XP/currency/items
- Notice Board integration: interact with notice board → shows available/active quests
- Quest log UI: minimal quest log showing active quests and progress
- First quest content: "Clear the Sewers" or similar — kill 8 Trashboar Runts in Blackwire Sewers, return to notice board for reward
- Reward structure: XP + tarnished_coin + first-equipment bundle

What is deferred from quest foundation:

  - Quest chains / multi-step quests
  - Quest branching or player choice
  - Timed quests / daily quests
  - Repeatable / farmable quests
  - Quest tracking on map
  - Quest-item special inventory handling
  - Cutscenes or dialogue trees beyond minimal notice-board text

### 5. Town-to-Combat-Area Routing

**Goal:** Players can physically walk from the Nightmarket hub to the Blackwire Sewers combat zone without relogging or manual room switching. Zone transitions are seamless and server-authoritative.

Candidate scope:

- Zone transition areas: physical areas in the town zone that trigger combat-zone entry when the player walks into them
- Combat-zone exit: physical area in the combat zone that returns player to town
- Server-authoritative transition: validate player is alive, in the correct position, not in combat — then move player to the target room
- Room handoff: leave TownRoom → join CombatRoom (or vice versa) with state preservation
- Client scene transition: WorldSession transitions between town and combat views without full scene restart
- Spawn point resolution: entering combat zone places player at the zone's entrance spawn point
- Return handling: leaving combat zone returns player to the town-side transition point

What is deferred from town-to-combat-area routing:

  - Multiple zone exits/entrances per zone
  - Dungeon-instance-per-party or private instance allocation
  - Zone-instance persistence (enemy respawn timers, instance ownership)
  - Visual transition effects (fade-to-black, doorway animation)

---

## Core 0.3 Non-Goals

The following are explicitly excluded from Core Build 0.3 scope:

```text
Vue or app-shell migration
large character customization (avatar, appearance, cosmetics overhaul)
class/skill overhaul (new classes, new skills, resource system)
procedural dungeon generation
boss encounters
guilds, friends list, trading, chat
PvP
crafting system
real art or animation pipeline
monetisation or cosmetic shop
admin panel
```

---

## 0.2 Freeze

Core Build 0.2 has reached Release Candidate status. All 29 committed tasks (285–315) are merged and validated. No new gameplay scope, no new content, no schema changes, no protocol additions will be made.

Core Build 0.2 is frozen for RC/bugfix-only. Only regressions or broken flows discovered during 0.2 RC validation may be patched. Each fix must be scoped to the minimum change required and must not expand 0.2 scope.

No 0.3 task may reopen or modify a 0.2 scope item unless that item is demonstrably broken.

---

## Scope Comparison

| Area | Core 0.1 | Core 0.2 | Core 0.3 (planned) |
|------|----------|----------|-------------------|
| Auth / character | ✅ Real | — | — |
| TownRoom / CombatRoom | ✅ Real | Polish pass | Zone routing |
| Click-to-move / combat | ✅ Real | Move-then-act, feel tuning | — |
| Loot / inventory / equipment | ✅ Real | Readability polish | — |
| Death / corpse / respawn | ✅ Real | Polish pass | — |
| Content / data pipeline | ✅ Foundation | Hardened + validated | Quest definitions |
| World readability | — | Markers, banner, labels | — |
| Performance / reconnect | — | Lag fix, phantom cleanup | — |
| Interaction feel | — | Move-then-act, cursor feedback | — |
| Rest area | — | Physical rest area + refill | — |
| Vendors | — | — | Buy/sell foundation |
| Stash | — | — | Shared storage |
| Waypoints | — | — | Travel network |
| Quests / objectives | — | — | First quest loop |
| Zone transitions | — | — | Town ↔ combat routing |

---

## Deferred Beyond 0.3

The following items are explicitly deferred beyond Core Build 0.3:

```text
Vue / app-shell migration
large character customization (avatar, appearance, cosmetics)
class/skill overhaul
procedural dungeon generation
boss encounters
guilds / friends / trading / PvP
crafting system
real art / animation pipeline
monetisation
admin panel
```

---

## Validation Expectations

Every 0.3 task must pass before merge:

```bash
pnpm lint          # 0 errors (existing non-blocking warnings only)
pnpm typecheck     # 0 errors
pnpm test          # all tests pass
pnpm build         # 0 errors
```

Manual validation expectations:

- All affected flows re-tested against `docs/CORE_BUILD_0_1_SMOKE_CHECKLIST.md` items
- No regression in existing 0.1/0.2 functionality
- Where applicable, new unit / integration tests for the changed area

---

## Task Scoping Rules

- Each 0.3 task must list which pillar(s) it serves
- Each 0.3 task must document the manual re-test steps used
- No 0.3 task may change the database schema without a corresponding Prisma migration
- No 0.3 task may add a new external npm dependency without explicit approval
- Schema changes for 0.3 pillars (stash, quest state, waypoint discovery) are expected and must follow Prisma migration rules
- Vue/app-shell migration, large character customization, class/skill overhaul remain explicitly out of scope

---

## Candidate Task List (Initial)

This list is a starting point for 0.3 task grooming. Not all items will necessarily ship; each must be validated against scope, effort, and risk before inclusion. Tasks are not ordered by priority.

### Pillar 1: Vendor Foundation

| # | Candidate Task | Description |
|---|----------------|-------------|
| 1 | Vendor panel UI | Click on vendor NPC → open vendor panel with buy/sell tabs, price display, quantity selection, confirm/cancel buttons |
| 2 | Server-authoritative buy flow | Validate stock availability, currency sufficiency, inventory space; deduct currency, add item to inventory, reduce stock count |
| 3 | Server-authoritative sell flow | Validate item ownership, sellable flag; remove item from inventory, add currency to player, optionally add to vendor stock |
| 4 | Currency system wiring | Track `tarnished_coin` balance on character or account; display balance in vendor UI and optionally in HUD |
| 5 | Vendor stock refresh | Data-driven restock behavior (on zone entry, timer, or manual refresh); wire existing `vendorStocks.ts` definitions |
| 6 | Vendor NPC interaction wiring | Ensure vendor NPCs in Nightmarket are interactable → trigger vendor panel; reuse existing interact pattern |

### Pillar 2: Stash Foundation

| # | Candidate Task | Description |
|---|----------------|-------------|
| 7 | Stash Prisma schema + migration | `StashSlot` or `StashItem` model with account/character binding, grid position, item data |
| 8 | Stash repository | CRUD for stash slots: create, read, update, delete; account-scoped queries |
| 9 | Stash panel UI | Grid-based stash view (similar to inventory), deposit/withdraw buttons, stash tab label |
| 10 | Server-authoritative stash operations | Deposit (remove from inventory → add to stash), withdraw (remove from stash → add to inventory), stash-internal move |
| 11 | Stash keeper interaction | Interact with stash keeper NPC → open stash panel; validate account ownership |
| 12 | Stash persistence verification | Stash items survive logout, refresh, server restart; verified across multiple characters on same account |

### Pillar 3: Waypoint/Travel Foundation

| # | Candidate Task | Description |
|---|----------------|-------------|
| 13 | Waypoint Prisma schema + migration | `DiscoveredWaypoint` model per character: zoneId, waypointId, discoveredAt |
| 14 | Waypoint activation flow | Interact with waypoint prop → mark as discovered → store in DB → client feedback |
| 15 | Waypoint travel UI | List of discovered waypoints, select destination, confirm travel; travel cost display |
| 16 | Server-authoritative travel | Validate discovery state, deduct cost if applicable, initiate room transition |
| 17 | Default waypoints | Nightmarket waypoint auto-discovered on character creation; others discovered by exploration |

### Pillar 4: First Quest/Objective Loop

| # | Candidate Task | Description |
|---|----------------|-------------|
| 18 | Quest content definitions | Quest data structures in `packages/content`: quest ID, name, description, objective list, reward definitions |
| 19 | Quest objective types | `kill_enemies` (count + enemy type filter), `collect_items` (item ID + count), `talk_to_npc`, `reach_zone` |
| 20 | Quest state Prisma schema + migration | Per-character quest state: quest ID, objectives with progress, completion status |
| 21 | Server-authoritative objective tracking | Kill tracking, item collection tracking, zone entry detection, NPC interaction detection |
| 22 | Quest completion + reward | Server validates all objectives met → award XP, currency, items; update quest state |
| 23 | Notice board integration | Interact with notice board → shows available/active quests; accept quest interaction |
| 24 | Quest log UI | Minimal quest log (toggle-able panel) showing active quest details and objective progress |
| 25 | First quest content: "Clear the Sewers" | Kill 8 Trashboar Runts in Blackwire Sewers → reward: XP + tarnished_coin + equipment bundle |

### Pillar 5: Town-to-Combat-Area Routing

| # | Candidate Task | Description |
|---|----------------|-------------|
| 26 | Zone transition area placement | Define physical transition areas in Nightmarket (sewer entrance) and Blackwire Sewers (exit to town) |
| 27 | Server-authoritative zone transition | Player walks into transition area → server validates (alive, position, not in combat) → initiates room migration |
| 28 | Room handoff | Leave TownRoom → join CombatRoom (or vice versa) with state preservation (HP, position, inventory intact) |
| 29 | Client scene transition | Visual transition between town and combat views without full scene restart; spawn point resolution |
| 30 | Spawn point resolution on entry | Entering combat zone places player at zone entrance spawn point; returning to town places at town-side exit point |

---

## Risk Areas

The following areas carry execution risk and should be approached with careful scoping:

1. **Room handoff for zone transitions** — Colyseus room migration is complex; the first implementation should be straightforward leave+join with server-side validation rather than a true cross-room handoff
2. **Quest objective tracking across rooms** — Kill counts and item collection span TownRoom and CombatRoom; objective tracking must be robust across room boundaries and survive disconnect/reconnect
3. **Stash concurrent access** — Multiple tabs/characters accessing the same stash concurrently; simple locking or last-write-wins may be sufficient for 0.3
4. **Currency economy** — No real economy balancing in 0.3; values should be generous to avoid grind friction during testing

---

## Initial Task Sequencing (Proposed Order)

The following sequence groups tasks into manageable waves. Wave 1 is the smallest viable step; later waves add depth.

```text
Wave 1 — Core Pipeline
  Vendor: buy/sell wiring + panel UI (tasks 1–4)
  Stash: schema + repository + panel UI (tasks 7–10)
  Waypoint: schema + activation (tasks 13–14)

Wave 2 — Travel + Transitions
  Waypoint: travel UI + server travel (tasks 15–17)
  Zone routing: transition areas + server migration (tasks 26–28)
  Zone routing: client scene transition (task 29)

Wave 3 — Quest Loop
  Quest: content definitions + objective types (tasks 18–19)
  Quest: schema + server tracking (tasks 20–21)
  Quest: completion + rewards (task 22)
  Quest: notice board + quest log UI (tasks 23–24)
  Quest: first quest content (task 25)

Wave 4 — Polish + Integration
  Vendor: stock refresh + NPC wiring (tasks 5–6)
  Stash: keeper interaction + persistence verification (tasks 11–12)
  Zone routing: spawn point resolution (task 30)
  Integration testing across all pillars
  Documentation updates