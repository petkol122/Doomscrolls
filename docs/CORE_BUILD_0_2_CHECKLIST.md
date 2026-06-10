# docs/CORE_BUILD_0_2_CHECKLIST.md — Core Build 0.2 Task Tracking

## Purpose

Track Core Build 0.2 tasks against their candidate pillars. Each row represents a scoped task, not a system. Tasks are not ordered by priority.

---

## Legend

| Column | Meaning |
|--------|---------|
| # | Sequential task number |
| Pillar | Which pillar(s) the task serves (1–6) |
| Task | Short description |
| PR | PR link when merged |
| Validation | Manual re-test performed? |
| Docs | Architecture/docs updated? |

---

## Active Development Lane

0.2 development begins with **Lane 1: UI / Input Reliability** (Pillar 1). This lane focuses on pointer-event gaps, cursor feedback and keyboard input issues that affect moment-to-moment playability.

---

## Regression-Watch Items

The following issues were fixed during Core Build 0.1 and are **not active blockers** for 0.2. They are tracked here only as regression-watch items. If any of these regress during 0.2 work, they should be filed as bugs against the specific task that caused the regression.

```text
- Pointer-event swallowing by invisible UI layers in WorldSessionScene
- Keyboard shortcuts (flask, dodge) consumed by browser focus
- Reconnect after browser refresh restores player presence correctly
- Reconnect after network drop restores game state correctly
- Corrupted localStorage token cleared on startup
- Phantom player presence after tab close (server-side cleanup)
- Enemy population initialises correctly on room join
- Loot drops visible and pickable, no duplicates or orphans
- Full-inventory rejection surfaced to player
- Click-to-move responsiveness at various zoom levels
- Camera follow and zoom range feel correct
```

---

## Task List

| # | Pillar | Task | Status | PR | Validation | Docs |
|---|--------|------|--------|----|------------|------|
| 284 | — | Open Core Build 0.2 development baseline | ✅ | — | ✅ | ✅ |
| 290 | 6 | Remove Nightmarket-specific town interactable hardcoding (data-driven zone-based filtering) | ✅ | — | ⬜ | ✅ |
| 291 | 6 | Replace hardcoded `"nightmarket"` fallback in TownRoom zone selection with content-registry resolver | ✅ | — | ⬜ | ✅ |
| 292 | 6 | Remove client town room display fallback hardcoding (`formatTownRoomState`) | ✅ | — | ⬜ | ✅ |
| 293 | 6 | Add first small 0.2 content slice (ambient rat props + `tarnished_coin` item + loot table entries) | ✅ | — | ✅ | ✅ |
| 294 | 5 | Add basic world boundary readability pass (data-driven boundary markers along zone edges) | ✅ | — | ✅ | ✅ |

---

## Pending Candidate Ideas

These are not committed tasks. They are rough ideas for future grooming.

```text
Pillar 1: Fix pointer-event swallowing by invisible UI layers in WorldSessionScene
Pillar 1: Add cursor feedback (default / pointer / attack / interact) for ground and entities
Pillar 1: Ensure keyboard shortcuts (flask, dodge) are not consumed by browser focus
Pillar 2: Test full reconnect: browser refresh after death, rejoin, verify HP/flask/inventory
Pillar 2: Test reconnect after network drop (disable/re-enable network in devtools)
Pillar 2: Handle corrupted localStorage token on startup (clear state, redirect to login)
Pillar 2: Prevent phantom player presence after tab close (server-side cleanup)
Pillar 3: Review click-to-move responsiveness at far zoom levels
Pillar 3: Grave Spark targeting feedback (range highlight or target reticle)
Pillar 4: Verify enemy population initialisation after room transition (town→combat→town)
Pillar 4: Prevent orphaned loot on client disconnect (server-side cleanup timeout?)
Pillar 4: Surface full-inventory rejection more visibly (floating text vs console log)
Pillar 5: Smooth camera follow (lerp or dead zone tweaks)
Pillar 5: Zoom range clamp review (prevent clipping into void or losing readability)
Pillar 5: Zone boundary / transition point visual hints
Pillar 6: Content registry validation unit tests in CI
Pillar 6: Spawn zone & loot table test coverage
Pillar 6: Content data linting (schema conformity checks)
```

---

## 0.2 Completion Gate

Core Build 0.2 is considered **complete** when:

1. All committed tasks in the task list above are merged and validated
2. `pnpm validate:0.1` passes with only the same existing warnings (0 errors)
3. `docs/CORE_BUILD_0_1_SMOKE_CHECKLIST.md` re-test passes for all non-deferred items
4. `docs/CORE_BUILD_0_2_RELEASE_NOTES.md` is updated to reflect what shipped
5. No new gameplay systems, database schema changes or protocol contract additions were introduced
6. Vue / app-shell migration was not started