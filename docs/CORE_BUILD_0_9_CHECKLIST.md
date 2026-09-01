# docs/CORE_BUILD_0_9_CHECKLIST.md — Core Build 0.9 Checklist

---

## Core 0.9 Planning Open Checklist

**Date:** 2026-09-01
**Build:** Core Build 0.9
**Theme:** Build Variety — the Second Class
**Status:** Waves 1-4 and 6 implemented and verified in one pass (Task 363). Wave 5 (optional test-debt down payment) was deliberately cut — see its section below. See `docs/CORE_BUILD_0_9_RELEASE_NOTES.md` for full detail.

### Planning Deliverables

- [x] Create `docs/CORE_BUILD_0_9_PLAN.md`
- [x] Create `docs/CORE_BUILD_0_9_CHECKLIST.md`
- [x] Define Core Build 0.9 theme
- [x] Make an explicit case for the chosen theme against the real alternatives (third zone / more itemization / test-debt backfill), not a sequence-default pick
- [x] Audit current class/origin/skill-resolution state as the plan's factual baseline
- [x] Define Core Build 0.9 feature pillars
- [x] Define candidate task waves
- [x] Define explicit 0.9 non-goals
- [x] Define the 0.9 risk list
- [x] Define the recommended implementation order
- [x] Define the in-process verification strategy up front (per this build's efficiency constraint), not as an afterthought
- [x] Flag `AGENTS.md` bulk/staleness for trimming, specifically the section this build will make factually wrong

### Core 0.9 Scope Guardrails

- [x] 0.9 is explicitly framed as building on the shipped 0.7 loop + the 0.8 regression harness
- [x] The second class (`ironclad`) reuses the existing `sewer_dweller` origin — no second origin
- [x] `ironclad`'s `baseStats` and both new skills are mechanically distinct from Gravewalker's, not relabeled numbers
- [x] `resolveSkillSlotDefinition` becomes classId-aware and all three call sites (`CombatRoom.ts`, `TownRoom.ts`, `deferredActionExecution.ts`) are updated together
- [x] `PlayerPresence` gains `classKey`, populated identically by both `buildPlayerPresence.ts` and `buildCombatPlayerPresence.ts`
- [x] No loadout/talent selection — each class keeps a fixed secondary/tertiary mapping
- [x] No rebalancing of Gravewalker's existing numbers
- [x] No new items, equipment slots, or class-restricted equipment
- [x] Every new room/skill-resolution behavior lands as a vitest case in `apps/server/test/`, not a throwaway scripted client
- [x] The client class-picker is the only piece that needed a live dev-server check — confirmed via a real Playwright session, not "code inspection only" (browser-automation tooling turned out to be available in this environment, unlike 0.7/0.8)

### Candidate Wave Checklist

#### Wave 1 — Planning

- [x] Finalize 0.9 scope documents
- [x] Reconfirm the 0.7 loop + 0.8 harness as the stable baseline 0.9 must not break

#### Wave 2 — Class Content (priority)

- [x] Widen `CharacterClassKey` in `packages/shared/src/character/CharacterTypes.ts` from `"gravewalker"` to `"gravewalker" | "ironclad"`
- [x] Add `ironclad` to `packages/content/src/data/classes.ts` (`baseStats`, `startingSkillId: "heavy_strike"`, `secondarySkillId: "shatter_blow"`, `tertiarySkillId: "groundbreaker"`)
- [x] Add `"ironclad"` to `sewer_dweller.allowedClassIds` in `origins.ts`
- [x] Add `shatter_blow` and `groundbreaker` `SkillContentDefinition`s to `skills.ts` (also required widening `SkillId` in `types.ts`, not called out in the plan but the same shape of change)
- [x] Add all required localization keys (`class.ironclad.name`/`.description`, `skill.shatter_blow.name`/`.description`, `skill.groundbreaker.name`/`.description`) to `en.ts` and `LocaleTypes.ts`
- [x] `pnpm --filter @doomscrolls/content typecheck` passes
- [x] Content-registry validation succeeds on server boot / test harness boot

#### Wave 3 — Class-Aware Skill Resolution (priority, the real fix)

- [x] Add `classKey: CharacterClassKey` to `PlayerPresence`
- [x] Add `classKey` to `BuildTownPlayerPresenceInput` and `BuildCombatPlayerPresenceInput`; populate from `result.character.classKey` in both `onJoin` handlers
- [x] Change `resolveSkillSlotDefinition(slot)` to `resolveSkillSlotDefinition(slot, classKey)`; remove `DEFAULT_CLASS_ID`
- [x] Update all three call sites: `CombatRoom.ts`, `TownRoom.ts`, `deferredActionExecution.ts`
- [x] Add unit test: `resolveSkillSlotDefinition` returns the correct skill definition per class id, for both slots
- [x] Extend `apps/server/test/support/fixtures.ts` with an Ironclad character fixture
- [x] Add/extend `apps/server/test/combat/skillSlotCasting.test.ts`: an Ironclad join casts Shatter Blow (not Grave Spark)
- [x] Add a new `apps/server/test/town/` regression test: TownRoom's skill-slot handler resolves per the joined character's class (TownRoom's first vitest coverage)
- [x] `pnpm --filter @doomscrolls/server typecheck` passes
- [x] `pnpm --filter @doomscrolls/server test` passes
- [x] Regression-check discipline: reverted the `CombatRoom.ts` fix to a hardcoded `"gravewalker"` argument and confirmed the new Ironclad test actually fails (`expected 3 to be 6`) before restoring the fix and re-verifying green

#### Wave 4 — Client Class Picker

- [x] Add a real multi-option select control (new `createOptionSelect` in `accountShellDom.ts`, alongside the existing single-option `createFixedOptionSelect`)
- [x] Wire `ironclad` as a second selectable, localized option in `characterCreateFormView.ts`
- [x] Live dev-server check: create a character as each class; confirm the persisted `classKey` is correct — done via a real Playwright session (browser-automation tooling was available in this environment): confirmed both options render with correct labels, the real `POST /characters` request sent `classId: "ironclad"`, the real response persisted it with correctly-derived stats, and the character list displayed "Class: Ironclad" afterward. Temp account cleaned up from the dev database afterward.
- [x] Confirm no change was needed in `AccountShellScene.ts`'s submit path (already reads `.value` generically) — confirmed, both by inspection and by the live request payload above

#### Wave 5 — Optional, cut first: one test-debt down payment

- [ ] Add one targeted vitest regression test for an existing untested `TownRoom` money-mutating path (vendor buy or sell)
- [x] **Cut.** Reason: `vendorBuyItem.ts` runs inside a real `prisma.$transaction` across three repositories, unlike the flat single-service mocks (`CharacterService`, `ObjectiveRepository`) the 0.8 harness already has. Testing it properly needs either meaningfully more mock infrastructure than "one small test" implies, or the real dev database, which would contradict the harness's own no-throwaway-DB-accounts design. No new debt was created — TownRoom's vendor/stash/waypoint coverage is exactly where 0.8 left it.

#### Wave 6 — Docs and Polish

- [x] Update `AGENTS.md`'s "Core 0.1 Game Scope" section so it no longer claims "multiple origins/classes" is excluded (labeled the section a historical snapshot; corrected the line to "a second origin", which remains accurate)
- [x] Write `docs/CORE_BUILD_0_9_RELEASE_NOTES.md`
- [x] `pnpm -r typecheck` passes across all workspace packages
- [x] `pnpm --filter @doomscrolls/server test` passes
- [x] Close toward controlled 0.9 RC / bugfix-only state

### Explicit Non-Goals / Deferred Items

- [ ] No second origin
- [ ] No third combat zone or new world/region content
- [ ] No player-chosen skills within a class (loadout/talent selection)
- [ ] No character respec or class-change after creation
- [ ] No rebalancing of Gravewalker's existing stats or skills
- [ ] No new items, equipment slots, or class-restricted equipment
- [ ] No new AI states or enemy behavior
- [ ] No full backfill of TownRoom's test-coverage gap (vendor, stash, waypoints, notice board) — only Wave 5's single down payment
- [ ] No claim of competitive class balance — only "functionally real and mechanically distinct"

### Planning Exit Criteria

- [x] Core Build 0.9 has a clear theme
- [x] The theme choice is justified against real alternatives, not defaulted to sequence
- [x] Core Build 0.9 has a clear goal grounded in an actual audit of current class/skill-resolution state
- [x] Core Build 0.9 has defined feature pillars
- [x] Core Build 0.9 has grouped candidate waves
- [x] Core Build 0.9 has explicit non-goals
- [x] Core Build 0.9 has an explicit risk list
- [x] Core Build 0.9 has an explicit in-process-first verification strategy
- [x] Core Build 0.8's harness is clearly the required verification path, not a live scripted client
- [x] `AGENTS.md` staleness is flagged with a specific section and reason, not a vague "it's getting long"
- [x] The next implementation task can be selected directly from the plan (Wave 2 — Class Content, immediately followed by Wave 3)
