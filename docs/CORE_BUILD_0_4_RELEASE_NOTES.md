# docs/CORE_BUILD_0_4_RELEASE_NOTES.md — Core Build 0.4 Release Notes

---

## Core 0.4 Planning Opened

**Date:** 2026-06-15
**Build:** Core Build 0.4
**Status:** Planning open
**Previous Build State:** Core Build 0.3 is now treated as **RC / bugfix-only**

### Summary

Core Build 0.4 is now opened as the next scoped build after the Core Build 0.3 playable-loop checkpoint.

The 0.4 theme is:

**Realm, Quest, and World Expansion Foundation**

The goal of 0.4 is to expand the shipped 0.3 playable loop into a more scalable foundation for:

- multiple areas,
- richer objectives,
- better travel/world progression,
- modest content growth,
- continued runtime hardening.

This is a scope-opening documentation milestone only. No runtime code, gameplay systems, schema changes, UI implementation, or new content implementation were added as part of this task.

### What changed in planning

- Added **`docs/CORE_BUILD_0_4_PLAN.md`** to define the build theme, goal, pillars, waves, risks, non-goals, and recommended implementation entry path.
- Added **`docs/CORE_BUILD_0_4_CHECKLIST.md`** to track the opened 0.4 planning scope and the future implementation waves.
- Added **`docs/CORE_BUILD_0_4_RELEASE_NOTES.md`** to record the 0.4 planning-open milestone.
- Updated the relevant 0.3 planning/status documentation so Core Build 0.3 is clearly framed as **Release Candidate / bugfix-only**.

### Core 0.4 Pillars

1. **Travel and realm foundation**
   - investigate CombatRoom / cross-zone / cross-room handoff
   - keep same-zone travel stable
   - prepare loading-overlay expectations for real transitions
   - no fake client-only teleport success

2. **Objective and quest foundation**
   - evolve the single-objective foundation toward a lightweight objective panel or quest journal
   - add at least one second objective
   - preserve server-authoritative progress/reward handling
   - avoid a full branching quest system

3. **World and waypoint progression**
   - expand the discovered waypoint model
   - improve lightweight world/waypoint panel clarity
   - consider a second real destination or small connected combat area
   - no full minimap unless later explicitly selected

4. **Content expansion**
   - add a small new combat pocket, sub-area, or connected zone candidate
   - add more enemy / loot / objective content through existing data-driven systems
   - improve readability and spacing where needed

5. **Town service polish**
   - improve vendor/stash readability and usability
   - keep vendor/stash systems simple and server-authoritative
   - no advanced economy or account-wide stash unless explicitly selected later

6. **Runtime hardening and playability**
   - protect the 0.3 loop from regressions
   - watch camera / projection / zoom / culling
   - watch objective persistence / reward duplication
   - watch waypoint discovery / travel persistence
   - watch Prisma migration readiness

### Candidate Waves

- **Wave 1:** planning, 0.3 freeze, runtime guardrails
- **Wave 2:** travel / realm investigation
- **Wave 3:** objective / journal expansion
- **Wave 4:** content / world expansion
- **Wave 5:** polish and RC closure

### Explicit non-goals

```text
no Vue / app-shell migration
no full class / skill overhaul
no pets / mounts / familiars
no professions
no housing
no guilds
no PvP
no large new zone
no full art pipeline
no full minimap / world map unless later selected as a focused 0.4 task
```

### Key risks carried into 0.4

- CombatRoom / cross-room handoff risk
- objective persistence complexity
- travel/loading state race conditions
- camera/projection regressions
- schema/migration drift
- AI task scope creep

### Recommended first implementation decision

The likely first implementation task after planning should be either:

1. **CombatRoom / cross-zone handoff investigation**, or
2. **Lightweight quest journal / objective panel foundation**

The default recommendation is to start with **CombatRoom / cross-zone handoff investigation** because it resolves the largest architectural uncertainty in the 0.4 scope.

### Build-state note

Core Build 0.4 should be understood as a **controlled expansion build**.

It is broader than 0.3, but it is not intended to replace or destabilize the shipped 0.3 loop. The existing playable loop remains the baseline that 0.4 must preserve while extending the game toward broader realm, objective, and world progression foundations.

---

## Task 344 — Conservative CombatRoom → TownRoom return handoff skeleton

**Date:** 2026-06-15
**Status:** Implemented

### Summary

Added the smallest safe Core 0.4 return path from `CombatRoom` back to `TownRoom`, mirroring the Task 343 leave-and-join handoff style without generalizing the full travel system.

### What changed

- Added a dedicated conservative `request_combat_return` client/server message path.
- Added `combat_town_return_approved` / `combat_town_return_rejected` server messages so the client can reuse the existing leave-and-join room handoff behavior.
- Implemented a `CombatRoom` return validator that accepts only the controlled Nightmarket return target and safely rejects duplicate, invalid, or not-ready requests.
- Reused `CharacterService.updateCharacterRoomIntent()` so return approval persists intended town destination, HP, and flask state before the combat room is left.
- Reused the existing room join infrastructure on the client to leave `CombatRoom` and rejoin `TownRoom` with the approved target zone.
- Reused the travel overlay pattern with a conservative `return_handoff` copy variant instead of introducing a larger transition framework.
- Added a temporary combat-only “Return to Town” control in the world-session overlay as the minimal sanctioned return trigger.

### Constraints preserved

- No generalized cross-zone travel system was introduced.
- No client authority over destination approval was added.
- No same-room repositioning shortcut was used; return remains leave-and-join semantics.
- Existing objective, inventory, and loot persistence flows were not reset or intentionally broadened.
- Existing 0.3 town loop behavior stayed on its prior path outside the controlled combat return handoff.

### Verification

- `pnpm typecheck`