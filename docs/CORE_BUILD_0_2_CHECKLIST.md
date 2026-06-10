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

## Midpoint Status

**Core Build 0.2 is roughly 60–65% complete** after Tasks 284–296. Two of the six candidate pillars have shipped meaningful work; the remaining pillars are well-scoped but unstarted.

### Completed Blocks

| Block | Tasks | Pillar(s) | Summary |
|-------|-------|-----------|---------|
| Interaction intent / move-then-act | 285–288 | 1, 3 | Movement intent validation, `applyMovementIntent`, deferred action queue (attack, pickup, interact after move), dodge intent, `resolveApproachTarget`. Client sends intent; server stores target and advances position on tick. Move-to-attack, move-to-interact, move-to-pickup all wired through the deferred queue. |
| Content validation / Nightmarket cleanup / first content slice | 289–293 | 6 | Content registry validation hardened (`ContentValidation.ts`), hardcoded Nightmarket town-interactable branching removed (data-driven zone filtering, Task 290), hardcoded zone fallback replaced with content-registry resolver (Task 291), client display fallback neutralized (Task 292), first small content slice: ambient rats + `tarnished_coin` item + loot table entries (Task 293). |
| World readability / localized prop labels | 294–296 | 5, 6 | Data-driven boundary markers along zone edges (Task 294), safe-area ring markers around the service cluster (Task 295), `labelKey` support for all player-facing world prop labels with 31 English locale keys (Task 296). Client and server resolve labels through the localization layer. |
| Full-inventory pickup rejection | 300 | 4 | Audited server pickup rejection flow (already sending `inventory_full` reason via `request_pickup_world_loot_rejected`), verified client localized handling (already present in `WorldSessionScene.ts` and `en.ts`), fixed double-notification bug in `deferredActionExecution.ts` that was sending both the rejected message and a redundant hardcoded `interact_response`. |
| Keyboard shortcut focus guard | 301 | 1 | Added `shouldIgnoreWorldSessionCombatHotkey()` guard to zoom +/-/numpad keys in `worldSessionAreaView.ts`. The existing guard for Space (dodge) and Q (flask) already existed. All gameplay/UI hotkeys now skip when focus is inside an editable UI element. |

### Pillar Coverage

| Pillar | Status |
|--------|--------|
| 1 — UI / Input Reliability | 🟡 Partial. Keyboard focus guard shipped (Task 301). Pointer-event swallowing, cursor feedback remain open. |
| 2 — Reconnect / Session Persistence | ⬜ Not started. Full reconnect flows not yet re-tested or hardened for 0.2. |
| 3 — Diablo-Like Interaction Flow | ✅ Mostly shipped (285–288). Interaction intent + move-then-act deferred queue in place. Skill targeting feedback still open. |
| 4 — Enemy / Loot Reliability | 🟡 Partial. Full-inventory rejection surfaced (Task 300). Orphaned loot cleanup still open. |
| 5 — Camera / World Readability | 🟡 Partial. Boundary markers + safe-area ring shipped (294–295). Camera smoothness, zoom review still open. |
| 6 — Content / Data Pipeline | ✅ Mostly shipped (289–293, 296). Content validation hardened, first content slice added, localization foundation laid. CI unit-test coverage still open. |

### Remaining 0.2 Candidates

Candidates below are small, safe, and stay within 0.2 non-goals (no vendors, stash, waypoints, safe-zone combat enforcement, Vue/app-shell migration, large character customization, large new zone, class/skill overhaul).

```text
Pillar 1: Add cursor feedback (default / pointer / attack / interact) for ground and entities
Pillar 2: Test full reconnect: browser refresh after death, rejoin, verify HP/flask/inventory
Pillar 2: Prevent phantom player presence after tab close (server-side cleanup verification)
Pillar 4: Prevent orphaned loot on client disconnect (server-side cleanup timeout)
Pillar 5: Smooth camera follow (lerp or dead zone tweaks)
Pillar 5: Zoom range clamp review (prevent clipping into void or losing readability)
Pillar 6: Content registry validation unit tests in CI
Pillar 6: Spawn zone & loot table test coverage
```

---

## Active Development Lane

0.2 development begins with **Lane 1: UI / Input Reliability** (Pillar 1). This lane focuses on pointer-event gaps, cursor feedback and keyboard input issues that affect moment-to-moment playability.

---

## Regression-Watch Items

The following issues were fixed during Core Build 0.1 and are **not active blockers** for 0.2. They are tracked here only as regression-watch items. If any of these regress during 0.2 work, they should be filed as bugs against the specific task that caused the regression.

```text
- Pointer-event swallowing by invisible UI layers in WorldSessionScene
- Keyboard shortcuts (flask, dodge, zoom) consumed by browser focus
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
| 295 | 5/6 | Add town safe-area content boundary markers (visual ring around service cluster) | ✅ | — | ⬜ | ✅ |
| 296 | 6 | Move world prop labels toward localization keys | ✅ | — | ⬜ | ✅ |
| 298 | 5 | Add area name banner on zone/town entry (Diablo-like top-center location name with fade animation) | ✅ | — | ⬜ | ✅ |
| 299 | 3 | Add Town Rest Refill Foundation (restore HP + flask charges on town entry, server-authoritative, localized notice) | ✅ | — | ⬜ | ✅ |
| 300 | 4 | Surface full-inventory pickup rejection with localized message (audited server flow, fixed redundant interact_response double-notification in deferredActionExecution.ts; client already handles inventory_full via localized key) | ✅ | — | ⬜ | ✅ |
| 301 | 1 | Keyboard shortcut focus guard — prevent gameplay hotkeys from firing while focus is inside editable UI elements (zoom +/-/numpad now also guarded via shouldIgnoreWorldSessionCombatHotkey) | ✅ | — | ⬜ | ✅ |
| 302 | 3 | Audit and fix town rest refill trigger clarity — confirmed refill runs once on TownRoom.onJoin(), no code behavior changes, docs clarified for current join-only vs future physical-replenish-area behavior, redundant restoreFlaskToFull in buildPlayerPresence documented as intentional | ✅ | — | ⬜ | ✅ |
| 303 | 3,5,6 | Add physical town rest/replenish area inside Nightmarket service cluster — data-driven `restAreaBounds` on zone content definition, `rest_area_marker` world prop kind with visual markers, server-authoritative `townRestAreaTrigger.ts` helper, wired into TownRoom simulation tick with spam-free notification | ✅ | — | ⬜ | ✅ |
| 304 | 5 | Add rest area visual feedback polish — render `rest_area_marker` props (teal double-ring), client-side rest area detection via content registry bounds, enter/exit notice via localized feedback, persistent "Rest Area" label above player while inside, no message spam | ✅ | — | ✅ | ✅ |
| 305 | 3, 5, 6 | Core 0.2 Fast Polish Batch — Rest Bounds Validation + Area Banner Robustness + Release Notes | ✅ | — | ✅ | ✅ |
| 306 | 3, 4 | Combat Feel Tuning Batch — reduce player attack cooldown formula base (1100→1000), reduce enemy attack cooldowns (Runt 1180→1050, Brute 980→850, Skitter 1100→980), reduce enemy attack windup (350→300 ms), reduce default attack cooldown fallback (700→600 ms). No new systems, no formula changes, server remains authoritative. | ✅ | — | ✅ | ✅ |
| 307 | 1, 5 | Fix WorldSession lag over time — moved input listener registration out of per-frame refreshFromRoomState (was re-registering POINTER_DOWN/MOVE/UP ~60fps causing listener churn), added roomStateDirty flag to skip per-frame Phaser object destroy/recreate of static props and interactables (was destroying and rebuilding all containers/graphics/text every frame causing extreme GC pressure), removed refreshFromRoomState from UPDATE loop (expensive work now only runs on Colyseus state change). | ✅ | — | ✅ | ✅ |
| 308 | 1, 5 | Guard WorldSession refresh/update boundaries after lag fix — added structured section comments ([A] projection, [B] expensive dirty rebuild, [C] entity processing, [D] player position) inside refreshFromRoomState, added guardrail comments on roomStateDirty flag explaining all setters and that the UPDATE loop must not read it, added one-time-only guard on input handler registration, added per-frame UPDATE handler comment block listing allowed operations and forbidden operations to prevent expensive work from creeping back into the UPDATE loop. | ✅ | — | ✅ | ✅ |

---

## Pending Candidate Ideas

These are not committed tasks. They are rough ideas for future grooming.

```text
Pillar 1: Fix pointer-event swallowing by invisible UI layers in WorldSessionScene
Pillar 1: Add cursor feedback (default / pointer / attack / interact) for ground and entities
Pillar 2: Test full reconnect: browser refresh after death, rejoin, verify HP/flask/inventory
Pillar 2: Test reconnect after network drop (disable/re-enable network in devtools)
Pillar 2: Handle corrupted localStorage token on startup (clear state, redirect to login)
Pillar 2: Prevent phantom player presence after tab close (server-side cleanup)
Pillar 3: Review click-to-move responsiveness at far zoom levels
Pillar 3: Grave Spark targeting feedback (range highlight or target reticle)
Pillar 4: Verify enemy population initialisation after room transition (town→combat→town)
Pillar 4: Prevent orphaned loot on client disconnect (server-side cleanup timeout?)
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