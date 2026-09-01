# docs/CORE_BUILD_0_4_PLAN.md — Core Build 0.4 Plan

## Status

**Planning phase.** Core Build 0.3 is now frozen at **Release Candidate / bugfix-only** status. Core Build 0.4 planning begins as the next scoped build.

Core Build 0.4 must **build on the shipped 0.3 playable loop** rather than replace it. The Nightmarket → combat pocket → loot/objective → town-service loop remains the stable baseline. 0.4 expands that loop into a broader world/realm/objective foundation without destabilizing the shipped 0.3 surface.

No runtime code changes, gameplay implementation, schema changes, or UI implementation are part of this planning task.

---

## Core 0.4 Theme

**Realm, Quest, and World Expansion Foundation**

---

## Core 0.4 Goal

Expand the 0.3 playable loop into a more scalable foundation for **multiple areas, richer objectives, and better travel/world progression** while preserving the existing 0.3 loop as the stable live baseline.

0.4 is not a rewrite. It is the first controlled step from a single-loop slice toward a broader realm/travel/objective structure.

---

## Build Framing

Core Build 0.3 proved the first real playable loop:

- town services,
- same-zone route travel,
- waypoint activation and travel,
- single-objective notice board progression,
- vendor/stash foundation,
- reconnect/persistence hardening.

Core Build 0.4 should now answer the next product question:

> How does Doomscrolls grow from one stable local loop into a small but real world progression foundation?

That means 0.4 should prioritize:

- broader travel structure,
- more than one meaningful objective,
- better world progression framing,
- modest content expansion,
- preserving server authority and persistence discipline.

---

## Major Feature Pillars

### 1. Travel and Realm Foundation

**Goal:** Start the path from same-zone teleport travel toward real room/realm progression without destabilizing the shipped 0.3 travel loop.

Candidate scope:

- Investigate `CombatRoom` / cross-zone / cross-room handoff feasibility
- Keep same-zone travel stable while broader travel work is explored
- Prepare a loading overlay flow for real room/realm transitions
- Define safe server-authoritative transition rules and failure handling
- Clarify what state must survive room/zone handoff (character, HP, inventory, objective state, waypoint state)

Guardrails:

- No fake client-only teleport success
- No client-declared join success
- No unstable room migration merge just for the sake of “bigger scope”

### 2. Objective and Quest Foundation

**Goal:** Evolve the single-objective notice board foundation toward a lightweight objective panel or quest journal without jumping to a full branching quest framework.

Candidate scope:

- Expand the current single-objective flow into a lightweight objective panel / quest journal foundation
- Add at least one second real objective
- Preserve server-authoritative progress and reward handling
- Improve objective readability and state clarity across travel/world progression
- Prepare minimal data flow for broader quest progression while avoiding excessive system complexity

Guardrails:

- No fake local quest progress
- No client-side reward grants
- Avoid a full branching quest/dialogue system in 0.4

### 3. World and Waypoint Progression

**Goal:** Grow the current waypoint foundation into a clearer world progression model.

Candidate scope:

- Expand the discovered waypoint model
- Add lightweight world/waypoint panel improvements
- Consider a second real destination or a small connected combat-area destination
- Improve progression clarity around what is discovered, reachable, or still locked

Guardrails:

- No fake unlocked travel
- No full minimap unless explicitly scoped later
- No full world map unless later chosen as a focused 0.4 task

### 4. Content Expansion

**Goal:** Use the existing data-driven content pipeline to make the world feel broader while staying tightly scoped.

Candidate scope:

- Add a small new combat pocket, sub-area, or connected zone candidate
- Add more enemy / loot / objective content using existing data-driven systems
- Improve readability and spacing where needed
- Validate that the current content pipeline scales beyond the initial 0.3 slice

Guardrails:

- No large new zone
- No fake content-only dressing with no systems behind it
- No full art pipeline scope

### 5. Town Service Polish

**Goal:** Make the shipped 0.3 town-service surface easier to use while keeping its systems simple and authoritative.

Candidate scope:

- Improve vendor readability and usability
- Improve stash readability and usability
- Refine town-service interaction clarity where needed
- Preserve the current server-authoritative vendor/stash model

Guardrails:

- No advanced economy unless explicitly selected later
- No account-wide stash unless explicitly selected later
- No feature creep into unrelated UI overhaul work

### 6. Runtime Hardening and Playability

**Goal:** Protect the shipped 0.3 loop while 0.4 broadens the game’s scope.

Watch areas:

- Protect the 0.3 loop from regressions
- Watch camera / projection / zoom / culling behavior
- Watch objective persistence and reward duplication safety
- Watch waypoint discovery/travel persistence
- Watch Prisma migration readiness for any future 0.4 persistence changes

Guardrails:

- Broader scope must not come at the cost of breaking the existing loop
- Hardening work should stay focused on real known risks, not speculative rewrites

---

## Core 0.4 Non-Goals

The following items are explicitly out of scope for Core Build 0.4 unless a later focused task re-opens one of them explicitly:

```text
Vue / app-shell migration
full class / skill overhaul
pets / mounts / familiars
professions
housing
guilds
PvP
large new zone
full art pipeline
full minimap / world map unless later selected as a focused 0.4 task
```

---

## 0.3 Freeze / Stability Baseline

Core Build 0.3 should now be treated as the stable shipped baseline for the current playable loop.

That means:

- 0.3 remains **RC / bugfix-only**
- no new 0.3 feature pillar should be opened
- new scope should be planned under 0.4
- any 0.3 bug fix must be minimal and regression-focused
- 0.4 must preserve the existing 0.3 playable flow rather than replacing it

The baseline loop being preserved is:

```text
Nightmarket hub
→ notice board objective start
→ route/waypoint travel to combat pocket
→ enemy kill / loot / reward progress
→ return to town
→ turn-in / vendor / stash / repeat
```

---

## Candidate Task Waves

This wave list is intentionally planning-focused. It is a candidate implementation sequence, not a commitment that every item will ship unchanged.

### Wave 1 — Planning, 0.3 Freeze, Runtime Guardrails

- Finalize 0.4 scope documents
- Mark 0.3 as RC / bugfix-only in relevant docs
- Reconfirm 0.3 regression watchlist
- Define guardrails for travel, persistence, and migration-sensitive work
- Reconfirm known camera/projection/travel/objective risk areas before broader implementation

### Wave 2 — Travel / Realm Investigation

- Investigate `CombatRoom` / cross-zone / cross-room handoff
- Define what the first real cross-room or cross-zone flow should be
- Clarify loading overlay expectations for real transition states
- Keep same-zone travel stable while broader realm work is explored

### Wave 3 — Objective / Journal Expansion

- Expand the notice board foundation into a lightweight objective panel or journal
- Add at least one second real objective
- Preserve server-authoritative progress/reward handling
- Keep the system narrow and readable rather than branching/heavy

### Wave 4 — Content / World Expansion

- Add a small new combat pocket, sub-area, or connected destination candidate
- Expand waypoint/world progression presentation
- Add small content expansion through existing data-driven enemy/loot/objective systems
- Improve readability/spacing where the broader world starts feeling crowded

### Wave 5 — Polish and RC Closure

- Harden the broadened loop against regressions
- Review travel persistence / objective persistence / world progression persistence
- Review camera/projection/culling after wider world usage
- Review migration readiness if any 0.4 schema work occurred
- Close toward a controlled 0.4 RC state

---

## Candidate Task List (Initial)

This is a groomable task pool for direct follow-up selection.

### Wave 1 Candidates

1. **0.3 RC freeze documentation pass** — ensure all relevant 0.3 docs clearly state RC / bugfix-only status
2. **0.3 runtime watchlist pass** — document the regression-sensitive surfaces that 0.4 work must not destabilize
3. **0.4 guardrail checklist** — define migration, persistence, travel, and camera watchpoints before implementation begins

### Wave 2 Candidates

4. **CombatRoom / cross-room handoff investigation** — explore Colyseus room migration or controlled leave+join flow with preserved state
5. **Cross-zone transition contract definition** — define the minimal server-owned handoff payload and validation rules
6. **Transition/loading overlay foundation plan** — define the client/server transition states for real room travel without fake success

### Wave 3 Candidates

7. **Lightweight quest journal / objective panel foundation** — expand the current objective tracker into a minimal readable panel
8. **Second real objective** — add a new objective using the existing authoritative progress/reward rules
9. **Objective persistence follow-up hardening** — review how multiple objectives should persist, restore, and avoid duplicate rewards

### Wave 4 Candidates

10. **Second destination / connected sub-area candidate** — add a small real destination that validates world progression beyond the current loop
11. **Waypoint/world panel improvement** — improve discovered/locked destination clarity without committing to a full map
12. **Small content expansion pack** — add enemy/loot/objective content using existing data-driven systems
13. **Readability and spacing pass** — tune crowded world/service areas after new content/destination additions

### Wave 5 Candidates

14. **Vendor/stash readability polish** — improve usability while preserving server-authoritative simplicity
15. **0.4 broadened-loop hardening audit** — end-to-end audit for travel, objective, waypoint, persistence, and camera regressions
16. **0.4 RC closure checklist** — verify the broadened loop is stable enough for bugfix-only closure

---

## Risks

The following risks should remain explicit throughout 0.4:

1. **CombatRoom / cross-room handoff risk**
   - Real room migration can destabilize the currently stable same-zone loop.
   - The first implementation may need to be a conservative validated leave+join flow rather than a fully seamless handoff.

2. **Objective persistence complexity**
   - Moving from one objective to multiple objectives or journal states increases persistence and restore complexity.
   - Reward duplication and partial-state edge cases must remain tightly controlled.

3. **Travel / loading state race conditions**
   - Real transitions introduce timing issues between request, acceptance, room leave, room join, sync application, and overlay cleanup.
   - Client UX must reflect only real server-owned state transitions.

4. **Camera / projection regressions**
   - Broader world and travel flows may re-expose camera, zoom, culling, or overlay alignment regressions already touched in 0.3.

5. **Schema / migration drift**
   - If 0.4 expands persisted objectives, travel state, or world progression, schema planning must remain disciplined.
   - Prisma migrations must stay committed and predictable.

6. **AI task scope creep**
   - 0.4 is broad enough that implementation tasks can easily become oversized.
   - Tasks should stay narrow, evidence-driven, and scoped to one pillar or one clear integration slice at a time.

---

## Decision: Recommended First Path After Planning

The recommended first implementation path after this planning task is:

1. **Either** start with **CombatRoom / cross-zone handoff investigation**
2. **Or** start with **lightweight quest journal / objective panel foundation**

### Recommended bias

If the priority is **world expansion**, start with:

- **CombatRoom / cross-zone handoff investigation**

If the priority is **playable objective depth with lower infrastructure risk**, start with:

- **lightweight quest journal / objective panel foundation**

### Suggested default recommendation

The most practical first task is likely:

**CombatRoom / cross-zone handoff investigation**

Reasoning:

- it answers the biggest architectural uncertainty in the 0.4 scope,
- it determines how real multi-area world progression should be shaped,
- it can be done as an investigation/planning task before committing to fragile implementation,
- it reduces the risk of building objective/world UX around a travel model that changes later.

That said, if the immediate priority is lower-risk player-facing depth while preserving the current same-zone structure, the best alternative first task is:

**Lightweight quest journal / objective panel foundation**

---

## Validation Expectations for Future 0.4 Tasks

Every future 0.4 implementation task should still preserve the project baseline:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Manual validation should emphasize:

- no regression in the shipped 0.3 playable loop,
- no fake travel success,
- no fake quest/objective progress,
- no duplicate reward paths,
- no broken persistence after refresh/reconnect where persistence is required.

---

## Summary

Core Build 0.4 is the **Realm, Quest, and World Expansion Foundation** build.

It is broader than 0.3, but it must remain controlled.

Its job is not to replace the current playable loop. Its job is to **extend that loop into a broader, more scalable world foundation** while preserving the real server-authoritative and persistence-minded standards already established in 0.3.