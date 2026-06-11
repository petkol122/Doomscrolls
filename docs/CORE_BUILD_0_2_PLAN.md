# docs/CORE_BUILD_0_2_PLAN.md — Core Build 0.2 Plan

## Status

**Release Candidate — Frozen for bugfix-only.** Core Build 0.2 has reached RC status. All 29 committed tasks (285–315) are merged and validated. No new gameplay scope, no new content, no schema changes, no protocol additions will be made.

Only regressions or broken flows discovered during 0.2 RC validation may be patched. Each fix must be scoped to the minimum change required and must not expand 0.2 scope.

Core Build 0.3 planning is underway. See [`docs/CORE_BUILD_0_3_PLAN.md`](./CORE_BUILD_0_3_PLAN.md).

---

## Source Roadmap

Core Build 0.2 is derived from the post-0.1 phases described in [`docs/POST_CORE_0_1_ROADMAP.md`](./POST_CORE_0_1_ROADMAP.md). That document remains the authoritative long-term roadmap.

---

## Core 0.2 Identity

Core Build 0.2 is the **reliability & interaction quality** pass after 0.1's feature breadth.

Its goal is not to add new systems, but to harden, polish and de-risk the existing 0.1 gameplay surface so that the game feels **responsive, discoverable and reconnect-safe** before further content expansion (0.3+) begins.

---

## Candidate Pillars

The following pillars guide 0.2 task selection. Not all will necessarily ship; each must be validated against scope, effort and risk before inclusion.

### 1. UI / Input Reliability

- Fix pointer-event gaps, click-through, stuck-input states
- Mouse cursor feedback (clickable / non-clickable / attack / interact)
- Keyboard input no longer consumed silently by Phaser or browser
- Consistent focus management between layers
- Touch/mobile preliminary guard (prevent dead zones)

### 2. Reconnect / Session Persistence

- Verify full reconnect flow after browser refresh, tab close, network drop
- TownRoom rejoin restores player presence and camera state
- CombatRoom rejoin restores enemy state if still alive
- Corrupted / expired token handling clears state gracefully
- No phantom player presence after disconnect

### 3. Diablo-Like Interaction Flow

- Click-to-move, click-to-attack, click-to-interact feel crisp and consistent
- Hold-move responsiveness at various zoom levels
- Skill targeting feedback (Grave Spark range indicator or targeting rework)
- Move-to-cast behaviour feels natural
- No click input swallowed by invisible UI layers

### 4. Enemy / Loot Reliability

- Enemy population correctly initialises on room join
- Enemy state (HP, position, aggro) reconnects correctly after room transition
- Loot drops are visible, pickable, and never orphaned
- Full-inventory rejection is surfaced clearly
- No duplicate loot, phantom loot, or loot that disappears on pickup

### 5. Camera / World Readability

- Camera follow is smooth and maintains sensible framing
- Zoom range feels appropriate for combat and navigation
- Tiles, interactables and enemies are legible at all zoom levels
- Spawn points, zone boundaries and transition points are discoverable

### 6. Content / Data Pipeline

- Content registry validation runs in CI
- Spawn zone, enemy and loot table definitions are covered by unit tests
- Adding a new enemy / zone / loot row requires minimal friction
- Content data files follow consistent patterns and are linted

---

## 0.2 Non-Goals

The following are explicitly excluded from Core Build 0.2 scope:

```text
real vendors / buy / sell / pricing
stash (persistent shared storage)
waypoint activation / travel
pets / mounts / familiars
Vue or app-shell migration
class overhaul or new origin/class
large character customization (avatar, appearance, cosmetics)
real art or animation pipeline
bosses, friends, guilds, PvP
procedural dungeons
monetisation or cosmetic shop
admin panel
```

Vue / app-shell migration remains deferred to its own dedicated phase (see `docs/POST_CORE_0_1_ROADMAP.md` — "Explicit Rule — Vue / App-Shell Migration").

---

## Validation Expectations

Every 0.2 task must pass before merge:

```bash
pnpm lint          # 0 errors (existing non-blocking warnings only)
pnpm typecheck     # 0 errors
pnpm test          # all tests pass
pnpm build         # 0 errors
```

Manual validation expectations:

- All affected flows re-tested against `docs/CORE_BUILD_0_1_SMOKE_CHECKLIST.md` items
- No regression in existing 0.1 functionality
- Where applicable, new unit / integration tests for the changed area

---

## Task Scoping Rules

- Each 0.2 task must list which pillar(s) it serves
- Each 0.2 task must document the manual re-test steps used
- No 0.2 task may add a new gameplay system (combat, loot, inventory, XP, objectives, death, rooms, zone travel)
- No 0.2 task may change the database schema
- No 0.2 task may change the shared protocol contract shape unless the change is a bugfix (e.g. adding a missing field that was already implied but not serialised)
- No 0.2 task may introduce a new npm dependency without explicit approval

---

## 0.1 Freeze

Core Build 0.1 is frozen for feature work. Only regressions or broken flows discovered during 0.1 validation may be patched against the 0.1 branch. Each fix must be scoped to the minimum change required and must not expand 0.1 scope.

No 0.2 task may reopen or modify a 0.1 scope item unless that item is demonstrably broken in the 0.1 candidate.