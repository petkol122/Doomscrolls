# docs/CORE_BUILD_0_4_CHECKLIST.md — Core Build 0.4 Checklist

---

## Core 0.4 Planning Open Checklist

**Date:** 2026-06-15
**Build:** Core Build 0.4
**Theme:** Realm, Quest, and World Expansion Foundation
**Status:** Planning opened. Core Build 0.3 is RC / bugfix-only.

### Planning Deliverables

- [x] Create `docs/CORE_BUILD_0_4_PLAN.md`
- [x] Create `docs/CORE_BUILD_0_4_CHECKLIST.md`
- [x] Create `docs/CORE_BUILD_0_4_RELEASE_NOTES.md`
- [x] Mark Core Build 0.3 as RC / bugfix-only in relevant 0.3 docs
- [x] Define Core Build 0.4 theme
- [x] Define Core Build 0.4 goal
- [x] Define Core Build 0.4 feature pillars
- [x] Define candidate task waves
- [x] Define explicit 0.4 non-goals
- [x] Define the 0.4 risk list
- [x] Define the recommended first implementation decision path

### Core 0.4 Scope Guardrails

- [x] 0.4 is explicitly framed as building on the shipped 0.3 playable loop
- [x] 0.4 is broader than 0.3 but still controlled
- [x] Travel/realm work requires real server-authoritative transitions
- [x] Objective/quest work preserves server-authoritative progress and rewards
- [x] World/waypoint work avoids committing to a full minimap/world map by default
- [x] Town-service polish remains simple and server-authoritative
- [x] Runtime hardening remains part of the build framing

### Candidate Wave Checklist

#### Wave 1 — Planning, 0.3 Freeze, Runtime Guardrails

- [ ] Finalize 0.4 implementation entry task
- [ ] Reconfirm 0.3 regression watchlist before 0.4 runtime work
- [ ] Reconfirm camera / projection / zoom / culling watchpoints
- [ ] Reconfirm objective persistence / reward duplication watchpoints
- [ ] Reconfirm waypoint discovery / travel persistence watchpoints

#### Wave 2 — Travel / Realm Investigation

- [ ] Investigate CombatRoom / cross-zone / cross-room handoff feasibility
- [ ] Define the first safe real transition path
- [ ] Define real loading/transition overlay expectations
- [ ] Preserve same-zone travel stability while broader travel work is explored

#### Wave 3 — Objective / Journal Expansion

- [ ] Define lightweight objective panel / quest journal scope
- [ ] Add at least one second real objective
- [ ] Preserve server-authoritative progress/reward handling
- [ ] Avoid branching/full quest-system expansion

#### Wave 4 — Content / World Expansion

- [ ] Add a small new combat pocket, sub-area, or connected destination candidate
- [ ] Expand waypoint/world progression presentation
- [ ] Add modest enemy / loot / objective content expansion
- [ ] Improve readability and spacing where needed

#### Wave 5 — Polish and RC Closure

- [ ] Audit broadened-loop regressions
- [ ] Audit travel/loading race conditions
- [ ] Audit objective persistence and reward safety
- [ ] Audit waypoint/world progression persistence
- [ ] Audit migration readiness if schema work occurs
- [ ] Close toward controlled 0.4 RC / bugfix-only state

### Explicit Non-Goals / Deferred Items

- [x] No Vue / app-shell migration
- [x] No full class / skill overhaul
- [x] No pets / mounts / familiars
- [x] No professions
- [x] No housing
- [x] No guilds
- [x] No PvP
- [x] No large new zone
- [x] No full art pipeline
- [x] No full minimap / world map unless explicitly selected later

### Planning Exit Criteria

- [x] Core Build 0.4 has a clear theme
- [x] Core Build 0.4 has a clear goal
- [x] Core Build 0.4 has defined feature pillars
- [x] Core Build 0.4 has grouped candidate waves
- [x] Core Build 0.4 has explicit non-goals
- [x] Core Build 0.4 has an explicit risk list
- [x] Core Build 0.3 is clearly treated as RC / bugfix-only
- [x] The next implementation task can be selected directly from the plan