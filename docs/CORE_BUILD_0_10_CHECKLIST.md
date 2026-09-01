# docs/CORE_BUILD_0_10_CHECKLIST.md — Core Build 0.10 Checklist

---

## Core 0.10 Planning Open Checklist

**Date:** 2026-09-01
**Build:** Core Build 0.10
**Theme:** Combat Integrity — Wiring Weapon Damage Into Combat
**Status:** Waves 1-3 and 5 implemented and verified in one pass. Wave 4 (feel pass) done as a numeric analysis, not a live playtest — see `docs/CORE_BUILD_0_10_RELEASE_NOTES.md` for full detail.

### Planning Deliverables

- [x] Create `docs/CORE_BUILD_0_10_PLAN.md`
- [x] Create `docs/CORE_BUILD_0_10_CHECKLIST.md`
- [x] Define Core Build 0.10 theme
- [x] Make an explicit case for the chosen theme against the real alternatives (loadout/build-choice, more world/itemization content, objectives depth), not a sequence-default or cheapest-option pick
- [x] Audit current combat-damage call sites and stat-flow state as the plan's factual baseline
- [x] Define Core Build 0.10 feature pillars
- [x] Define candidate task waves
- [x] Define explicit 0.10 non-goals
- [x] Define the 0.10 risk list
- [x] Define the recommended implementation order
- [x] Define the in-process verification strategy up front, including the expectation that no live dev-server step is needed this build
- [x] Get plan reviewed/approved before starting Wave 2

### Core 0.10 Scope Guardrails

- [x] The build stays scoped to gameplay (combat damage wiring), not infra/tooling — 0.8 already covered the testing-harness gap
- [x] `PlayerPresence` gains a `damage` field, populated identically at join and at recalculation by all three rooms (`CombatRoom.ts`, `TownRoom.ts`, `deferredActionExecution.ts`)
- [x] Basic attack damage at all three call sites reads `player.damage` instead of the hardcoded literal `1`
- [x] Skill-cast damage at all three call sites uses the agreed formula (skill `baseDamage` + power/equipment bonus), not the flat `skillDefinition.damage` alone
- [x] No skill's own `baseDamage` content value is changed
- [x] No loadout/talent selection, new skills, new classes, new origins, or new zones
- [x] No new items, equipment slots, or statModifier targets
- [x] No armor/mitigation formula work
- [x] Every new combat-damage behavior lands as a vitest case in `apps/server/test/`, not a throwaway scripted client
- [x] `CharacterStatsService` gets its first-ever unit test
- [x] Wave 4's live-server expectation was revisited: no live check was available in this environment, so the feel pass ran as a numeric analysis against real content values instead — called out explicitly in the release notes, not silently presented as equivalent

### Candidate Wave Checklist

#### Wave 1 — Planning

- [x] Finalize 0.10 scope documents
- [x] Reconfirm the 0.9 class-variety baseline + full server test suite as what 0.10 must not break

#### Wave 2 — Presence Wiring (priority)

- [x] Add `@type("number") damage: number` to `PlayerPresence`
- [x] Add `damage` to `BuildTownPlayerPresenceInput` and `BuildCombatPlayerPresenceInput`; populate from the joined character's `derived.damage` in both `onJoin` handlers
- [x] Add `player.damage = recalculated.derived.damage` to all three rooms' progression-recalculation helper (`CombatRoom.ts`, `TownRoom.ts`, `deferredActionExecution.ts`)
- [x] Add unit test: `CharacterStatsService.calculateEquippedStats` folds a `damage` stat modifier into `derived.damage` correctly

#### Wave 3 — Combat Resolution (priority, the real fix)

- [x] Replace `applyEnemyDamage(enemy, 1)` with `applyEnemyDamage(enemy, player.damage)` at all three basic-attack call sites
- [x] Implement the agreed skill-damage formula (`resolveSkillCastDamage` in `skillSlotContent.ts`) at all three skill-cast call sites
- [x] Add `test/combat/basicAttackDamage.test.ts` and extend `test/combat/skillSlotCasting.test.ts`: basic attack and skill cast both reflect the joined character's real `derived.damage`, not the old hardcoded numbers
- [x] Add the `TownRoom` equivalent integration tests (`test/town/basicAttackDamage.test.ts`, extended `test/town/skillSlotClassResolution.test.ts`)
- [x] `pnpm --filter @doomscrolls/server typecheck` passes
- [x] `pnpm --filter @doomscrolls/server test` passes
- [x] Regression-check discipline: reverted both fixes, confirmed the new/extended tests fail with the expected old/new number mismatch (`999` vs `988`; `6` vs `17`), restored, re-verified all 12 tests green

#### Wave 4 — Feel Pass (bounded)

- [x] Playtest pass done as a numeric analysis against real starting content values (no live server available): Gravewalker/Ironclad starting `derived.damage` (5/6) vs. enemy HP (8–30) — see release notes for the full table
- [ ] If pacing reads as clearly broken: one small, explicitly-labeled numeric adjustment (e.g. enemy HP) — not a new formula
- [x] Nothing read as broken: stated plainly; no changes made in this wave

#### Wave 5 — Docs and Polish

- [x] Write `docs/CORE_BUILD_0_10_RELEASE_NOTES.md`
- [x] Full `pnpm -r typecheck` passes across all workspace packages
- [x] `pnpm --filter @doomscrolls/server test` passes
- [x] Close toward controlled 0.10 RC / bugfix-only state

### Explicit Non-Goals / Deferred Items

- [x] No loadout/build-choice system (still deferred — no spare skill content exists to choose between yet)
- [x] No new skill content, new classes, new origins, or a third combat zone
- [x] No rebalancing of any skill's existing `baseDamage` numbers
- [x] No armor/mitigation formula changes
- [x] No new items, equipment slots, or statModifier targets
- [x] No PvP or player-vs-player damage
- [x] No objectives/quest depth (declined at 0.6, declined again at 0.7)
- [x] No full combat-balance pass — only "stats have a real, correct effect," not "the game is tuned" (Wave 4 made no numeric changes)

### Planning Exit Criteria

- [x] Core Build 0.10 has a clear theme
- [x] The theme choice is justified against real alternatives, not defaulted to sequence or cheapest option
- [x] Core Build 0.10 has a clear goal grounded in an actual audit of current combat-damage call sites
- [x] Core Build 0.10 has defined feature pillars
- [x] Core Build 0.10 has grouped candidate waves
- [x] Core Build 0.10 has explicit non-goals
- [x] Core Build 0.10 has an explicit risk list
- [x] Core Build 0.10 has an explicit in-process-first verification strategy, including the expectation of no live-server step
- [x] The one genuine design decision (the skill-damage formula) is flagged explicitly for approval, not buried in implementation
- [x] Plan reviewed and approved by the user
- [x] The next implementation task can be selected directly from the plan (Wave 2 — Presence Wiring, immediately followed by Wave 3)
