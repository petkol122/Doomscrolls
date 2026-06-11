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

## Completion Status

**Core Build 0.2 has reached Release Candidate (RC) status after Tasks 285–315.** All 29 committed tasks are merged and validated. No new gameplay scope, no new content, no schema changes, no protocol additions will be added.

**Core Build 0.2 is frozen for RC/bugfix-only.** 0.3 planning is underway under the **Playable Loop Build** theme. See [`docs/CORE_BUILD_0_3_PLAN.md`](./CORE_BUILD_0_3_PLAN.md) for the full plan, feature pillars, and candidate task list.

### Pillar Coverage (Final)

| Pillar | Status | Tasks |
|--------|--------|-------|
| 1 — UI / Input Reliability | ✅ Shipped | Keyboard focus guard (301), lag fix + guardrails (307, 308) |
| 2 — Reconnect / Session Persistence | ✅ Shipped | Phantom presence cleanup + scene teardown hardening (315) |
| 3 — Diablo-Like Interaction Flow | ✅ Shipped | Move-then-act queue (285–288), rest refill (299, 302–305), hit feedback (310, 312) |
| 4 — Enemy / Loot Reliability | 🟡 Partial | Full-inventory rejection (300), loot readability (309). Orphaned loot cleanup deferred. |
| 5 — Camera / World Readability | ✅ Shipped | Boundary markers (294), safe-area ring (295), area banner (298), loot depth/labels (309), hit/damage flash (310, 311, 312), lag fix (307) |
| 6 — Content / Data Pipeline | ✅ Shipped | Content validation (289), Nightmarket hardcoding removal (290–292), first content slice (293), label localization (296), rest bounds validation (305) |

### Completed Work Blocks

| Block | Tasks | Pillar(s) | Summary |
|-------|-------|-----------|---------|
| Interaction intent / move-then-act | 285–288 | 1, 3 | Movement intent validation, `applyMovementIntent`, deferred action queue (attack, pickup, interact after move), dodge intent, `resolveApproachTarget`. Client sends intent; server stores target and advances position on tick. Move-to-attack, move-to-interact, move-to-pickup all wired through the deferred queue. |
| Content validation / Nightmarket cleanup / first content slice | 289–293, 296 | 6 | Content registry validation hardened (`ContentValidation.ts`), hardcoded Nightmarket town-interactable branching removed (data-driven zone filtering, Task 290), hardcoded zone fallback replaced with content-registry resolver (Task 291), client display fallback neutralized (Task 292), first small content slice: ambient rats + `tarnished_coin` item + loot table entries (Task 293), `labelKey` support for world prop labels (Task 296). |
| World readability / localized prop labels | 294–295, 298, 309 | 5, 6 | Data-driven boundary markers along zone edges (Task 294), safe-area ring markers around the service cluster (Task 295), area name banner on zone entry (Task 298), y-sorted depth/label readability for ground loot (Task 309). |
| Town rest-area polish | 299, 302–305 | 3, 5, 6 | Town rest refill on join (299), trigger audit (302), physical rest area with server tick refill (303), visual feedback with enter/exit detection (304), rest bounds validation + area banner hardening (305). |
| Combat/readability polish | 300–301, 306, 310–312 | 1, 3, 4, 5 | Full-inventory pickup rejection (300), keyboard focus guard (301), combat feel tuning (306), hit/damage visual feedback (310), player damage/death readability (311), enemy attack windup readability (312). |
| Performance fixes | 307–308 | 1, 5 | WorldSession lag fix (event listener churn, per-frame object rebuild, unnecessary redraws) + guardrail comments against regression. |

---

## Regression-Watch Items

The following issues were fixed during Core Build 0.1 or 0.2 and are **not active blockers** for RC. They are tracked here only as regression-watch items. If any of these regress during future work, they should be filed as bugs against the specific task that caused the regression.

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
- Progressive FPS degradation during extended play (lag over time)
- Double-notification on full-inventory pickup (redundant interact_response)
```

---

## Task List

| # | Pillar | Task | Status | PR | Validation | Docs |
|---|--------|------|--------|----|------------|------|
| 284 | — | Open Core Build 0.2 development baseline | ✅ | — | ✅ | ✅ |
| 285 | 1, 3 | Add movement intent validation (`validateMovementIntent`) | ✅ | — | ✅ | ✅ |
| 286 | 3 | Add server-authoritative position stepping (`applyMovementIntent`) | ✅ | — | ✅ | ✅ |
| 287 | 3 | Add deferred action queue for move-then-act (attack, pickup, interact after movement) | ✅ | — | ✅ | ✅ |
| 288 | 3 | Add dodge intent + approach target resolution | ✅ | — | ✅ | ✅ |
| 289 | 6 | Harden content registry validation (`ContentValidation.ts` — zone, prop, enemy, item, loot table, vendor stock, objective, spawn point validation) | ✅ | — | ✅ | ✅ |
| 290 | 6 | Remove Nightmarket-specific town interactable hardcoding (data-driven zone-based filtering) | ✅ | — | ✅ | ✅ |
| 291 | 6 | Replace hardcoded `"nightmarket"` fallback in TownRoom zone selection with content-registry resolver | ✅ | — | ✅ | ✅ |
| 292 | 6 | Remove client town room display fallback hardcoding (`formatTownRoomState`) | ✅ | — | ✅ | ✅ |
| 293 | 6 | Add first small 0.2 content slice (ambient rat props + `tarnished_coin` item + loot table entries) | ✅ | — | ✅ | ✅ |
| 294 | 5 | Add basic world boundary readability pass (data-driven boundary markers along zone edges) | ✅ | — | ✅ | ✅ |
| 295 | 5/6 | Add town safe-area content boundary markers (visual ring around service cluster) | ✅ | — | ✅ | ✅ |
| 296 | 6 | Move world prop labels toward localization keys | ✅ | — | ✅ | ✅ |
| 298 | 5 | Add area name banner on zone/town entry (Diablo-like top-center location name with fade animation) | ✅ | — | ✅ | ✅ |
| 299 | 3 | Add Town Rest Refill Foundation (restore HP + flask charges on town entry, server-authoritative, localized notice) | ✅ | — | ✅ | ✅ |
| 300 | 4 | Surface full-inventory pickup rejection with localized message (audited server flow, fixed redundant interact_response double-notification in deferredActionExecution.ts; client already handles inventory_full via localized key) | ✅ | — | ✅ | ✅ |
| 301 | 1 | Keyboard shortcut focus guard — prevent gameplay hotkeys from firing while focus is inside editable UI elements (zoom +/-/numpad now also guarded via shouldIgnoreWorldSessionCombatHotkey) | ✅ | — | ✅ | ✅ |
| 302 | 3 | Audit and fix town rest refill trigger clarity — confirmed refill runs once on TownRoom.onJoin(), no code behavior changes, docs clarified for current join-only vs future physical-replenish-area behavior, redundant restoreFlaskToFull in buildPlayerPresence documented as intentional | ✅ | — | ✅ | ✅ |
| 303 | 3,5,6 | Add physical town rest/replenish area inside Nightmarket service cluster — data-driven `restAreaBounds` on zone content definition, `rest_area_marker` world prop kind with visual markers, server-authoritative `townRestAreaTrigger.ts` helper, wired into TownRoom simulation tick with spam-free notification | ✅ | — | ✅ | ✅ |
| 304 | 5 | Add rest area visual feedback polish — render `rest_area_marker` props (teal double-ring), client-side rest area detection via content registry bounds, enter/exit notice via localized feedback, persistent "Rest Area" label above player while inside, no message spam | ✅ | — | ✅ | ✅ |
| 305 | 3, 5, 6 | Core 0.2 Fast Polish Batch — Rest Bounds Validation + Area Banner Robustness + Release Notes | ✅ | — | ✅ | ✅ |
| 306 | 3, 4 | Combat Feel Tuning Batch — reduce player attack cooldown formula base (1100→1000), reduce enemy attack cooldowns (Runt 1180→1050, Brute 980→850, Skitter 1100→980), reduce enemy attack windup (350→300 ms), reduce default attack cooldown fallback (700→600 ms). No new systems, no formula changes, server remains authoritative. | ✅ | — | ✅ | ✅ |
| 307 | 1, 5 | Fix WorldSession lag over time — moved input listener registration out of per-frame refreshFromRoomState (was re-registering POINTER_DOWN/MOVE/UP ~60fps causing listener churn), added roomStateDirty flag to skip per-frame Phaser object destroy/recreate of static props and interactables (was destroying and rebuilding all containers/graphics/text every frame causing extreme GC pressure), removed refreshFromRoomState from UPDATE loop (expensive work now only runs on Colyseus state change). | ✅ | — | ✅ | ✅ |
| 308 | 1, 5 | Guard WorldSession refresh/update boundaries after lag fix — added structured section comments ([A] projection, [B] expensive dirty rebuild, [C] entity processing, [D] player position) inside refreshFromRoomState, added guardrail comments on roomStateDirty flag explaining all setters and that the UPDATE loop must not read it, added one-time-only guard on input handler registration, added per-frame UPDATE handler comment block listing allowed operations and forbidden operations to prevent expensive work from creeping back into the UPDATE loop. | ✅ | — | ✅ | ✅ |
| 309 | 5 | Improve ground loot readability — added y-sorted depth to loot containers (300+y) so loot renders above props but below enemies, increased loot label font (13→14px), strengthened label background (0.82→0.88 alpha, brighter border), slightly enlarged glow/ping ellipses and opacity, added y-sorted depth to corpse markers (350+y), reduced defeated enemy label dimness and changed separator from bullet to brackets for less visual clutter near loot | ✅ | — | ✅ | ✅ |
| 310 | 3, 5 | Add basic hit and damage feedback polish — brief enemy body white-flash on server-confirmed hits (attack accepted, skill accepted, damage_applied), float-up + fade animation on floating damage numbers, damage_applied routing to enemy or player visual, "Hit!" indicator on attack accepted, flash on skill hit. No combat formula changes, no new abilities, no fake client-side hits. | ✅ | — | ✅ | ✅ |
| 311 | 5 | Player damage and death readability polish — brief red flash overlay on the player body when server-confirmed damage lands (damage_applied route), subtle camera shake on downed state, improved own corpse marker with pulsing glow + "Click to recover" prompt + brighter teal styling to distinguish from defeated enemies and other players' corpses. No death mechanic changes, no combat formula changes, no new abilities. | ✅ | — | ✅ | ✅ |
| 312 | 3, 5 | Enemy attack windup readability polish — body/ring warning tint (amber for normal, hot red for heavy), pulsing body/ring glow scale tween during windup, "INCOMING"/"INCOMING!" label above enemy during windup, `incomingLabel` added to container and `telegraphGlowTween` properly cleaned up in `destroy()`. All visuals driven by existing server-authoritative `enemy_attack_telegraph` / `enemy_attack_resolved` messages. No AI changes, no combat formula changes, no new abilities, no schema changes. | ✅ | — | ✅ | ✅ |
| 314 | 1, 5 | World Cursor Target Feedback — add hover label showing target type ([Attack], [Pick up], [Interact], [Recover corpse], [Move]) with color-coded text and arrow indicator, enemy hover highlight ring (amber glow), loot hover highlight ring (gold outline), own corpse hover detection, ground hover feedback in debug_top_down mode. All feedback driven by POINTER_MOVE handler only (no per-frame churn). Existing click behavior, interaction priority, move-then-act, and all gameplay remain unchanged. | ✅ | — | ✅ | ✅ |
| 315 | 2 | Reconnect and Phantom Presence Cleanup Audit — audit and harden server room leave/cleanup (TownRoom.onLeave enemy target release, CombatRoom.already-defeated cleanup) and client scene teardown (WorldSessionScene.handleSceneTeardown nulls room/account first to prevent stale onStateChange callbacks from re-creating overlays after shutdown). No schema/database/protocol changes. | ✅ | — | ✅ | ✅ |

---

## RC Status — No True Blockers Remain

The following former RC blocker candidates have been resolved by committed 0.2 tasks and are no longer blockers:

| Resolved Issue | Resolving Task | Notes |
|----------------|----------------|-------|
| Cursor feedback (hover labels / highlight rings) | 314 | Cursor target feedback shipped with color-coded hover labels and highlight rings |
| Reconnect / phantom presence cleanup | 315 | Server-side `onLeave` enemy target release + client scene teardown null-guards |
| Lag over time (progressive FPS degradation) | 307 | Event listener churn, per-frame object rebuild, and unnecessary redraws eliminated |

**No true RC blockers remain.** The items below are non-blocking polish that do not prevent RC declaration. They are tracked here for future grooming:

| Priority | Issue | Pillar | Notes |
|----------|-------|--------|-------|
| Medium | Camera smooth follow (lerp or dead zone tweaks) | 5 | Camera follows player instantly; subtle smoothing would improve feel |
| Low | Zoom range clamp review | 5 | Verify zoom extremes don't clip into void or lose readability |
| Low | Orphaned loot cleanup on client disconnect | 4 | Loot drops from a disconnecting player's kills remain on the ground until timer expiry; no active cleanup on disconnect |
| Low | Content registry validation unit tests in CI | 6 | Currently validated via `pnpm validate:0.2` but not in automated test suite |
| Low | Spawn zone & loot table test coverage | 6 | No automated tests for content correctness |

---

## Deferred to 0.3 (Non-Blocking)

These items are explicitly **out of scope for 0.2 RC**. They will not block the release:

- **Vendors** — no buy/sell behavior; vendor stock entries exist as content data only
- **Stash** — stash keeper placed in world but has no storage functionality
- **Waypoints** — waypoint world prop exists but is non-functional
- **Safe-zone combat enforcement** — safe-area markers are visual only; no combat suppression
- **Vue/app-shell migration** — not started; Phaser-only client remains
- **Large character customization** — avatarKey from predefined defaults only; no customization UI
- **Large new zone** — no new zones beyond the Nightmarket
- **Class/skill overhaul** — no new classes, skills, or resource system (mana/rage/etc.)
- **Mana/class resource system** — flask charges are the only resource; no mana bar or class-specific resource

---

## 0.2 Release Candidate Gate

Core Build 0.2 reached **Release Candidate** status when:

1. ✅ All committed tasks (285–315) are merged and validated
2. ✅ `pnpm validate:0.1` passes with only the same existing warnings (0 errors)
3. ✅ `pnpm validate:0.2` passes
4. ✅ `pnpm lint` / `pnpm typecheck` / `pnpm build` pass
5. ✅ `docs/CORE_BUILD_0_2_RELEASE_NOTES.md` updated to reflect what shipped
6. ✅ No new gameplay systems, database schema changes or protocol contract additions were introduced
7. ✅ Vue / app-shell migration was not started
8. ✅ No true RC blockers remain — cursor feedback (314), reconnect/phantom presence (315), and lag (307) all resolved

**All gate items satisfied.** The build is declared RC. The optional smoke checklist re-test (Core 0.1) and any remaining non-blocking polish will be tracked separately for final release hardening.
