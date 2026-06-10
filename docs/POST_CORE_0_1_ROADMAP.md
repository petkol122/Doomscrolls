# docs/POST_CORE_0_1_ROADMAP.md — Core Build 0.1 Post-Cut Roadmap

## Purpose

This document defines the development phases after Core Build 0.1 RC is cut. It does not reopen 0.1 scope, add gameplay, or change code.

---

## Phase 0 — 0.1 RC Bugfix Only

- No new features.
- No scope expansion.
- Only regressions or broken flows discovered during 0.1 RC validation.
- Each fix must be scoped to the minimum change required.

---

## Phase 0.2 — Town Systems

Likely candidates (not ordered):

- real vendor buy/sell
- stash foundation (persistent shared storage)
- waypoint activation/travel
- content authoring foundation (tooling or editor-friendly data pipeline)
- UI copy / localization cleanup (resolve any deferred or placeholder i18n keys)

---

## Phase 0.3 — Quest / Content Expansion

- Notice Board persistence and objective state.
- Multi-objective support and quest log foundation.
- Additional zones, enemies, loot tables driven by content registry.

---

## Phase 0.4 — Character / Skill Progression

- Skill tree or ability unlock system.
- Talent / specialization passives.
- Higher level range and gear scaling.

---

## Later — App Shell / Visual Character Creation

- Vue or similar app-shell migration (see rule below).
- Visual character creation (avatar, appearance).
- Real isometric art and animation pipeline.

---

## Explicit Rule — Vue / App-Shell Migration

Do not start a Vue or app-shell migration until after Core Build 0.1 is stable and unless the migration is scoped as its own dedicated phase. No piecemeal framework mixing.