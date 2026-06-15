# docs/POST_CORE_0_1_ROADMAP.md — Core Build 0.1 Post-Cut Roadmap

## Purpose

This document defines the development phases after Core Build 0.1 RC is cut. It does not reopen 0.1 scope, add gameplay, or change code.

---

## Phase 0 — 0.1 RC Bugfix Only (Complete)

- No new features.
- No scope expansion.
- Only regressions or broken flows discovered during 0.1 RC validation.
- Each fix must be scoped to the minimum change required.

---

## Phase 0.2 — Town Systems (Complete — RC)

Core Build 0.2 shipped 29 tasks (285–315) focused on reliability, interaction quality, and world readability. See [`docs/CORE_BUILD_0_2_RELEASE_NOTES.md`](./CORE_BUILD_0_2_RELEASE_NOTES.md) for full details.

**Status:** Release Candidate. Frozen for feature work; bugfix-only.

Key outcomes:

- Move-then-act interaction flow (movement intent, position stepping, deferred action queue, dodge)
- Content/data pipeline hardened (content registry validation, Nightmarket hardcoding removed, localization key support)
- World readability (boundary markers, safe-area ring, area name banner, y-sorted depth layering)
- Town/rest-area polish (join-time refill, physical rest area, enter/exit feedback)
- Combat readability (hit flash, floating damage numbers, player damage flash, enemy windup telegraph)
- World cursor target feedback (color-coded hover labels, highlight rings)
- Performance fix (WorldSession lag eliminated)
- Reconnect cleanup (phantom presence cleanup, scene teardown null-guards)

Vendors, stash, waypoints, and quests were explicitly deferred and remain for 0.3.

---

## Phase 0.3 — Playable Loop Build (In Planning)

Core Build 0.3 is the **Playable Loop Build**. Its goal is to connect existing systems into a real gameplay loop.

Planned feature pillars:

- Vendor foundation (buy/sell from town NPCs, currency system)
- Stash foundation (persistent shared account storage)
- Waypoint/travel foundation (activation, travel between zones)
- First quest/objective loop (notice board quests, server-authoritative tracking, rewards)
- Town-to-combat-area routing (physical zone transitions without relogging)

See [`docs/CORE_BUILD_0_3_PLAN.md`](./CORE_BUILD_0_3_PLAN.md) for the full plan, candidate task list, and proposed sequencing.

Vue/app-shell migration, large character customization, class/skill overhaul, procedural dungeons, and PvP remain deferred.

---

## Phase 0.4 — Character / Skill Progression (Deferred Beyond 0.3)

- Skill tree or ability unlock system.
- Talent / specialization passives.
- Higher level range and gear scaling.

---

## Later — App Shell / Visual Character Creation (Deferred Beyond 0.3)

- Vue or similar app-shell migration (see rule below).
- Visual character creation (avatar, appearance).
- Real isometric art and animation pipeline.

---

## Explicit Rule — Vue / App-Shell Migration

Do not start a Vue or app-shell migration until after Core Build 0.3 is stable and unless the migration is scoped as its own dedicated phase. No piecemeal framework mixing.
