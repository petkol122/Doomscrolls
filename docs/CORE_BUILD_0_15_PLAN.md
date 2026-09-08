# docs/CORE_BUILD_0_15_PLAN.md — Core Build 0.15 Plan

## Status

Planned and implemented in one pass, per this build's brief. Start-of-session check: working tree diff matches exactly what Core Builds 0.13+0.14 left behind (confirmed via `git status`/`git diff c211a10 --stat` — same 25 modified + 12 new files, `pnpm -r typecheck` and the 16-file/27-test server suite both green). Nothing unexplained found. Building on top of that baseline.

---

## Theme: Quest Depth — Concurrent Objectives, Real Coverage, and a Repeatable Grind

Three related pillars, all under the "objectives/quest depth" backlog item declined at 0.6 and again at 0.9 for being lower-priority than other gaps — those gaps are now closed, and this build found the actual system is far more built-out than its own code comments claim, making a real slice newly cheap and safe.

**Why bigger than 0.14, honestly:** investigating this system turned up that `TownRoom.ts` already implements a selectable objective catalog, a persisted per-character completed-objectives list, and (unused) full gating logic for repeatable objectives — none of which its own doc comments or prior plans mention (they still say "single-objective foundation... NOT the final quest system"). The `characterObjective` DB table is already keyed by `(characterId, objectiveId)`, so it already supports multiple rows per character with **zero migration needed**. That discovery is what makes Pillar 1 (real concurrency, not just more content) responsibly in-scope for one pass, not just the content-only slice a smaller plan would have settled for.

---

## Pillar 1: Two Concurrent Active Objectives

**Goal:** a player can have two objectives active at once (e.g., one Nightmarket kill-count and one combat-zone one), instead of the current hard "one at a time" gate.

**Design:** duplicate the existing single-slot scalar fields into a second parallel set, the same pattern this codebase already uses for skill-slot cooldowns (`nextSkillSlotAt`/`nextTertiarySkillSlotAt`/`nextPrimarySkillSlotAt` — three named fields, not an array). Explicit `slot: 1 | 2` branching throughout, not a generic accessor abstraction — matches house style and keeps each slot's logic independently revertible/testable.

- **`PlayerPresence.ts`**: add `hasObjective2`, `objectiveId2`, `objectiveLabel2`, `objectiveDescriptionKey2`, `objectiveCurrent2`, `objectiveTarget2`, `objectiveCompleted2`, `objectiveRewardGranted2`, mirroring the existing 8 slot-1 fields.
- **`TownRoom.ts`**: `startNoticeBoardObjective`/`resetNoticeBoardObjective`/`buildObjectiveUpdatedMessage`/`getActiveObjectiveContent`/`advanceObjectiveProgress`'s two call sites/the notice-board turn-in handler/the `request_start_board_objective` handler/the `request_reset_objective` handler/join-time restoration all become slot-aware: the "start" handler picks the first EMPTY slot (rejects only when both are full); the turn-in handler checks and turns in both slots' ready objectives when the notice board is clicked; kill-progress advances whichever slot(s) target the killed enemy; join restoration (already a loop over `NOTICE_BOARD_OBJECTIVE_SEQUENCE` looking for the first non-reward-granted row) collects up to two such rows instead of one.
- **`CombatRoom.ts`**: its two kill-progress call sites (basic attack, skill cast) become slot-aware the same way.
- **`buildPlayerPresence.ts`/`buildCombatPlayerPresence.ts`**: accept and populate the second slot from join-time restoration.
- **Protocol**: `ObjectiveUpdatedServerMessage` gains a `slot: 1 | 2` field so the client knows which tracker changed. `RequestResetObjectiveClientMessage` gains a required `slot: 1 | 2` (dev/debug reset-objective utility, currently slot-less).
- **Client**: `townRoomPresence.ts`'s `applyOptionalObjective` duplicated for slot 2 (`objective2`/`hasObjective2` on `PlayerPresenceEntry`); `worldSessionOverlayView.ts`'s `createHudSection`/`createObjectivesSection` render up to two tracker cards instead of one (grid layout already adapts column count based on whether an objective is present — extended to a 0/1/2 count); `WorldSessionScene.ts`'s `objective_updated` listener and its per-slot "just completed" notice de-duplication (`lastObjectiveReadyToTurnInId`/`lastObjectiveCompletionNotice`) become per-slot; `resetObjectiveClient.ts`'s message gains the slot param, called once per tracker's own reset button.
- **No DB/Prisma changes** — `ObjectiveRepository` is already keyed by `(characterId, objectiveId)`, fully slot-agnostic; only the in-session Colyseus schema and client presentation model change.

---

## Pillar 2: Combat-Zone Objective Coverage

**Goal:** kills in Blackwire Sewers and Static Yard actually count toward something. Today all 3 objectives target only `trashboar_runt`/`trashboar_brute`, and kill-tracking already fires in `CombatRoom` — `trashboar_skitter` and `static_wretch` kills currently advance zero objectives, in the game's own dedicated combat zones.

- **`packages/content/src/data/objectives.ts`**: add two new objectives — one targeting `trashboar_skitter` (Blackwire), one targeting `static_wretch` (Static Yard) — added to `NOTICE_BOARD_OBJECTIVE_SEQUENCE`. Reuses the exact existing kill-count/reward mechanism; no new objective type.
- **Localization**: title/description keys for both, matching the existing three objectives' key pattern.
- Pairs directly with Pillar 1: a player can now run a Nightmarket objective and a combat-zone objective in the two slots at once, which is the actual point of adding a second slot — one slot alone wouldn't have anywhere new to send a player.

---

## Pillar 3: Repeatable Objectives, Actually Turned On

**Goal:** close the `repeatable?: boolean` field's five-build-old "not implemented yet" status — except investigation found `isObjectiveRepeatable`/`isObjectiveStartBlockedByCompletion` already correctly bypass the completion-block for repeatable objectives in `buildAvailableNoticeBoardObjectives`. No objective has ever set `repeatable: true`, so this exact path has never been exercised by anything, including tests.

- **`objectives.ts`**: mark one low-reward, always-useful objective `repeatable: true` (a small kill-count objective, reusing an existing low reward value — not inventing a new number). This is a content-availability decision, not the kind of combat-formula "balance tuning" this project has kept off-limits since 0.10; it's flagged here for the record rather than treated as free of any judgment call.
- **Verification is the real work here**: prove the already-built gating logic actually behaves correctly end-to-end (start → complete → turn in → immediately re-appears in the available catalog → can be restarted → progress resets to 0) — this path has zero existing test coverage despite the logic existing since some prior, undocumented task.

---

## Verification Strategy

- **Pillar 1**: new test(s) proving two objectives can be active simultaneously (start one into slot 1, start a second into slot 2, confirm a third is rejected `already_has_active_objective`), that a kill matching only one active objective's target advances only that slot, and that turning in one completed slot leaves the other slot's progress untouched.
- **Pillar 2**: extend/add a test confirming a `trashboar_skitter` kill in `CombatRoom` (Blackwire) advances the new Blackwire objective when active — closing the exact "kills here count for nothing" gap.
- **Pillar 3**: new test proving a repeatable objective can be completed, turned in, and immediately restarted with progress reset to 0 — the first real exercise of `isObjectiveRepeatable`'s existing logic.
- Regression-check discipline throughout (per 0.9-0.14's established practice): revert each new gate/branch, confirm the corresponding new test fails, restore, confirm green.
- `pnpm -r typecheck` and `pnpm --filter @doomscrolls/server test` (full suite) at the end.

---

## Non-Goals

```text
no balance/tuning changes to combat formulas (enemy damage, armor, mitigation, skill numbers)
no more than 2 concurrent objective slots -- a fixed, small number, not a generic N-slot system
no new objective TYPES (still kill-count only) -- fetch/deliver/escort objectives remain out of scope
no quest chains/branching/dialogue
no DB schema/migration changes -- ObjectiveRepository's existing (characterId, objectiveId) keying already supports this
no loadout/build-choice system (still open, confirmed in a separate scoping pass to need a DB migration + new content + new UI -- out of proportion for this build)
```

---

## Working-Tree Discipline

No commits. All changes land on top of the existing uncommitted Core Build 0.13 + 0.14 diffs already in the tree.
