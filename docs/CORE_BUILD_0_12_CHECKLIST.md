# docs/CORE_BUILD_0_12_CHECKLIST.md — Core Build 0.12 Checklist

---

## Core 0.12 Planning Open Checklist

**Date:** 2026-09-01
**Build:** Core Build 0.12
**Theme:** Combat Integrity, Part Three — Dodge and Healing Flask in the Real Combat Zones
**Status:** Waves 1-3 and 5 implemented and verified in one pass. Wave 4 (flask heal-amount itemization) was deliberately cut — see `docs/CORE_BUILD_0_12_RELEASE_NOTES.md` for full detail.

### Planning Deliverables

- [x] Create `docs/CORE_BUILD_0_12_PLAN.md`
- [x] Create `docs/CORE_BUILD_0_12_CHECKLIST.md`
- [x] Define Core Build 0.12 theme
- [x] Weigh balance tuning vs. continued wiring/content explicitly, with a real case for each side, not a default to whichever is easier to scope
- [x] Answer "how would a balance tuning change be verified without a live playtest" explicitly, even though balance was not chosen
- [x] Audit `heavy_strike`/a third skill slot as a candidate and confirm/deny whether it is actually a bounded wiring fix
- [x] Audit `CombatRoom.ts`'s and `TownRoom.ts`'s message handler registrations directly to find the actual chosen gap, not assume one
- [x] Define Core Build 0.12 feature pillars
- [x] Define candidate task waves
- [x] Define explicit 0.12 non-goals
- [x] Define the 0.12 risk list
- [x] Define the recommended implementation order
- [x] Define the in-process verification strategy up front
- [x] Log the deferred balance question explicitly with a concrete proposal for how a future build should scope it, not just "later"
- [x] Get plan reviewed/approved before starting Wave 2

### Core 0.12 Scope Guardrails

- [x] No enemy damage/heavyAttackDamage values, armor item values, or the mitigation formula are changed anywhere in this build
- [x] `heavy_strike`/a third skill slot is not wired — confirmed out of scope (protocol change + new client UI required)
- [x] `request_dodge` and `request_use_healing_flask` are registered in `CombatRoom.ts` by reusing existing, unmodified `TownRoom`-proven helpers — no new dodge/flask game logic is written
- [x] `TownRoom.ts`'s existing dodge/flask behavior is not changed at all
- [x] No client-side changes — confirmed the client already sends both intents unconditionally regardless of room kind
- [x] Flask itemization (Wave 4) was cut, not attempted — the no-flask-equipped baseline question did not arise
- [x] Every new `CombatRoom` dodge/flask behavior lands as a vitest case in `apps/server/test/`, not a throwaway scripted client
- [x] No documented reason for dodge/flask's exclusion from `CombatRoom` was found during implementation (matching the plan's audit) — the port proceeded as planned

### Candidate Wave Checklist

#### Wave 1 — Planning

- [x] Finalize 0.12 scope documents
- [x] Reconfirm 0.11's full server test suite (18 tests, 10 files) as the regression baseline 0.12 must not break

#### Wave 2 — Dodge in CombatRoom (priority)

- [x] Register `request_dodge` in `CombatRoom.ts`, reusing `applyDodgeIntent`/`validateDodgeIntent`/`dodgeCooldown` unchanged
- [x] Resolve the `TownRoomState`-typed parameter using the same reuse pattern `validateAttackIntent` already uses in `CombatRoom.ts`
- [x] Add `test/combat/dodgeIntent.test.ts`
- [x] Regression-check discipline: temporarily disabled the registration, confirmed the test fails (timed out waiting for `request_dodge_accepted`), restored, re-verified green

#### Wave 3 — Healing flask in CombatRoom (priority)

- [x] Register `request_use_healing_flask` in `CombatRoom.ts`, reusing `applyHealingFlaskIntent`/`healingFlaskConfig` unchanged
- [x] Add `test/combat/healingFlaskIntent.test.ts` (including a rejection case)
- [x] Regression-check discipline: temporarily disabled the registration, confirmed both tests fail (timed out waiting for `_accepted`/`_rejected`), restored, re-verified green

#### Wave 4 — Optional, cut first: flask itemization

- [ ] Thread an equipped `starter_blood_flask`'s real `useEffect.value`/`charges` into the heal/charge-grant paths
- [ ] Preserve the existing no-flask baseline as the fallback
- [ ] Add test cases for both the itemized and fallback paths
- [x] **Cut**, per the task instructions. No new debt was created — the gap is exactly where this plan found it, and is named explicitly in the release notes rather than silently dropped.

#### Wave 5 — Docs and Polish

- [x] Write `docs/CORE_BUILD_0_12_RELEASE_NOTES.md`
- [x] Full `pnpm -r typecheck` passes across all workspace packages
- [x] `pnpm --filter @doomscrolls/server test` passes
- [x] Close toward controlled 0.12 RC / bugfix-only state

### Explicit Non-Goals / Deferred Items

- [x] No enemy damage/heavyAttackDamage/armor-item/mitigation-formula changes (balance tuning deferred again, logged explicitly for a future build)
- [x] No wiring of `heavy_strike`/a third "primary" skill slot (confirmed to need a protocol change + new client UI)
- [x] No gating of the existing no-flask baseline behind equipment ownership
- [x] No new dodge/flask mechanics, effects, or numbers — this build only ports existing behavior into a room missing it
- [x] No new zones, classes, skills, or enemy types
- [x] No death/respawn consequences, loadout/build-choice system, or objectives/quest depth

### Planning Exit Criteria

- [x] Core Build 0.12 has a clear theme
- [x] The balance-vs-wiring question was weighed with a genuine case on both sides, not defaulted
- [x] The "verify a tuning change without a live playtest" question was answered explicitly, independent of which option was chosen
- [x] Core Build 0.12 has a clear goal grounded in a direct audit of both rooms' message handler registrations
- [x] A second candidate (`heavy_strike`) was investigated and explicitly ruled out with reasoning, not just skipped
- [x] Core Build 0.12 has defined feature pillars
- [x] Core Build 0.12 has grouped candidate waves
- [x] Core Build 0.12 has explicit non-goals
- [x] Core Build 0.12 has an explicit risk list
- [x] Core Build 0.12 has an explicit in-process-first verification strategy
- [x] The deferred balance question has a concrete, actionable proposal for a future build, not just a "later"
- [x] Plan reviewed and approved by the user
- [x] The next implementation task can be selected directly from the plan (Wave 2 — Dodge in CombatRoom, Wave 3 — Healing flask in CombatRoom)
