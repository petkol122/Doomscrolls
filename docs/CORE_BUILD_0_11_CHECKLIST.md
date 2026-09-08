# docs/CORE_BUILD_0_11_CHECKLIST.md — Core Build 0.11 Checklist

---

## Core 0.11 Planning Open Checklist

**Date:** 2026-09-01
**Build:** Core Build 0.11
**Theme:** Combat Integrity, Part Two — Wiring Armor Mitigation
**Status:** Waves 1-4 implemented and verified in one pass. See `docs/CORE_BUILD_0_11_RELEASE_NOTES.md` for full detail.

### Planning Deliverables

- [x] Create `docs/CORE_BUILD_0_11_PLAN.md`
- [x] Create `docs/CORE_BUILD_0_11_CHECKLIST.md`
- [x] Define Core Build 0.11 theme
- [x] Make an explicit case for the chosen theme against the real alternatives (death/respawn consequences, loadout/build-choice, world/objectives content), not a sequence-default or cheapest-option pick
- [x] Audit current incoming-damage call sites and confirm/correct assumptions from the planning brief (enemy-type count, skills-per-class count)
- [x] Define Core Build 0.11 feature pillars
- [x] Define candidate task waves
- [x] Define explicit 0.11 non-goals
- [x] Define the 0.11 risk list
- [x] Define the recommended implementation order
- [x] Define the in-process verification strategy up front, including the explicit statement that live-feel verification is out of scope, not just deferred
- [x] Arithmetic check: realistic max simultaneous armor (9, corrected from a naive 13-point sum — `chest`/`head` are single slots, only the best item per slot counts) against real enemy damage/heavyAttackDamage values, under the recommended formula — named explicitly in the plan's Risks section (Risk 6), formula kept unchanged
- [x] Get plan reviewed/approved before starting Wave 2

### Core 0.11 Scope Guardrails

- [x] The build stays scoped to gameplay (armor mitigation wiring), not infra/tooling
- [x] `PlayerPresence` gains an `armor` field, populated identically at join and at recalculation by all three rooms (`CombatRoom.ts`, `TownRoom.ts`, `deferredActionExecution.ts`)
- [x] Incoming enemy damage at both landing call sites (`CombatRoom.ts`, `TownRoom.ts`) applies the agreed mitigation formula instead of the raw content value
- [x] Heavy attacks are mitigated the same way as normal attacks — no special-casing
- [x] No enemy content values (`damage`, `heavyAttackDamage`) or existing armor item values are changed
- [x] No death/respawn consequence changes, no `heavy_strike`/basic-attack-formula wiring, no loadout system, no new enemy/AI/zone/class/skill/item content
- [x] Every new incoming-damage behavior lands as a vitest case in `apps/server/test/`, not a throwaway scripted client
- [x] The `CharacterStatsService` unit test is extended, not duplicated, for the armor-modifier case
- [x] The plan and release notes state plainly that live combat-feel verification is out of scope for this build, not silently skipped

### Candidate Wave Checklist

#### Wave 1 — Planning

- [x] Finalize 0.11 scope documents
- [x] Reconfirm 0.10's full server test suite (12 tests, 8 files) as the regression baseline 0.11 must not break

#### Wave 2 — Presence Wiring (priority)

- [x] Add `@type("number") armor: number` to `PlayerPresence`
- [x] Add `apps/server/src/realtime/rooms/resolvePlayerArmor.ts` (mirrors `resolvePlayerDamage.ts`, fallback `0`)
- [x] Add `armor` to `BuildTownPlayerPresenceInput` and `BuildCombatPlayerPresenceInput`; populate from the joined character's `derived.armor` in both `onJoin` handlers
- [x] Add `player.armor = recalculated.derived.armor` to all three rooms' progression-recalculation helper
- [x] Extend `test/character/characterStatsService.test.ts` with an armor stat-modifier case

#### Wave 3 — Mitigation at the Landing Sites (priority, the real fix)

- [x] Apply the agreed mitigation formula (`Math.max(1, rawDamage - player.armor)`, via the new shared `mitigateIncomingDamage` helper) at `CombatRoom.ts`'s enemy-attack landing branch
- [x] Apply the same formula at `TownRoom.ts`'s landing branch, covering both the normal and heavy damage values
- [x] Add `test/combat/incomingDamageMitigation.test.ts`
- [x] Add the `TownRoom` equivalent integration test
- [x] `pnpm --filter @doomscrolls/server typecheck` passes
- [x] `pnpm --filter @doomscrolls/server test` passes
- [x] Regression-check discipline: reverted both fixes, confirmed the floor-case tests fail with the expected old/new number mismatch (`998` vs `999`), restored, re-verified all 18 tests green

#### Wave 4 — Docs and Polish

- [x] Write `docs/CORE_BUILD_0_11_RELEASE_NOTES.md`
- [x] Full `pnpm -r typecheck` passes across all workspace packages
- [x] `pnpm --filter @doomscrolls/server test` passes
- [x] Close toward controlled 0.11 RC / bugfix-only state

### Explicit Non-Goals / Deferred Items

- [x] No death/respawn consequence changes (respawn stays instant, free, cost-free — a flagged, real gap for a future build)
- [x] No wiring of `heavy_strike`/a "primary" skill slot into the basic-attack formula (a flagged, real gap; redesigning basic attack collides with the live `attackCooldownMs` derived stat)
- [x] No loadout/build-choice system
- [x] No new enemy types, AI states, ranged or pack-aggro behavior
- [x] No new zones, classes, skills, items, or equipment slots
- [x] No percentage-based or diminishing-returns mitigation formula — flat and floor-preserving only
- [x] No rebalancing of enemy damage content values or existing armor item values
- [x] No PvP
- [x] No objectives/quest depth
- [x] No live playtest of combined damage+armor combat feel — explicitly out of scope, not deferred-but-attempted

### Planning Exit Criteria

- [x] Core Build 0.11 has a clear theme
- [x] The theme choice is justified against real alternatives, not defaulted to sequence or cheapest option
- [x] Core Build 0.11 has a clear goal grounded in an actual audit of current incoming-damage call sites
- [x] The planning brief's assumptions (enemy-type count, skills-per-class count) were checked against the codebase and corrected/confirmed in the plan
- [x] Core Build 0.11 has defined feature pillars
- [x] Core Build 0.11 has grouped candidate waves
- [x] Core Build 0.11 has explicit non-goals
- [x] Core Build 0.11 has an explicit risk list
- [x] Core Build 0.11 has an explicit in-process-first verification strategy
- [x] The one genuine design decision (the mitigation formula) is flagged explicitly for approval, not buried in implementation
- [x] Plan reviewed and approved by the user
- [x] The next implementation task can be selected directly from the plan (Wave 2 — Presence Wiring, immediately followed by Wave 3)
