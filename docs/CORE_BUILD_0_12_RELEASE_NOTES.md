# docs/CORE_BUILD_0_12_RELEASE_NOTES.md — Core Build 0.12 Release Notes

---

## Task — Combat Integrity, Part Three: Dodge and Healing Flask in the Real Combat Zones

**Date:** 2026-09-01
**Build:** Core Build 0.12
**Status:** Waves 1-3 and 5 implemented and verified in one pass. Wave 4 (flask heal-amount itemization) was deliberately cut — see below.

### Summary

Core Build 0.12 closes a gap this planning pass found while weighing whether to open balance tuning instead: `CombatRoom` — Blackwire Sewers and Static Yard, the game's only dedicated combat zones — had no `request_dodge` and no `request_use_healing_flask` handler at all. A player fighting there could not dodge or heal with their flask; both inputs silently did nothing, even though the client already sends both intents unconditionally and `CombatRoom` already tracked and persisted flask state as if it expected to support it. Both are now registered in `CombatRoom.ts`, reusing `TownRoom.ts`'s already-correct, unmodified logic.

Planning docs: `docs/CORE_BUILD_0_12_PLAN.md`, `docs/CORE_BUILD_0_12_CHECKLIST.md`.

### What changed — Dodge in CombatRoom (Wave 2)

- **`apps/server/src/realtime/rooms/CombatRoom.ts`**: added a `dodgeHandlerRegistered` guard flag and a new `registerDodgeHandler` method, called from `onCreate` alongside the room's other handlers. It is a direct port of `TownRoom.ts`'s `request_dodge` handler — same alive/lifeState gate, same `validateDodgeIntent`, same `isDodgeReady`/`consumeDodgeCooldown`, same `applyDodgeIntent` call, same accepted/rejected response shape.
- **No changes to `applyDodgeIntent.ts`, `dodgeIntentValidation.ts`, or `dodgeCooldown.ts`** — this is reuse, not new dodge logic, per the plan.
- **The one type-shape wrinkle**: `applyDodgeIntent` expects a `TownRoomState`-typed `state`. Resolved with the same `as unknown as` cast `registerAttackHandler` already uses in the same file for `validateAttackIntent` — `state as unknown as TownRoomState` — not a new pattern.
- **No client changes** — confirmed during planning that the client already sends `request_dodge` unconditionally regardless of room kind; it simply had nowhere to land in `CombatRoom`.

### What changed — Healing flask in CombatRoom (Wave 3)

- **`apps/server/src/realtime/rooms/CombatRoom.ts`**: added a `healingFlaskHandlerRegistered` guard flag and a new `registerHealingFlaskHandler` method, called from `onCreate`. A direct port of `TownRoom.ts`'s `request_use_healing_flask` handler — same `validateHealingFlaskIntent` and `applyHealingFlaskIntent` calls, same accepted/rejected response shape.
- **No changes to `applyHealingFlaskIntent.ts` or `healingFlaskConfig.ts`** — same reuse-not-rewrite shape as the dodge pillar.
- **No client changes**, same reasoning as dodge.

### Wave 4 — cut

Flask heal-amount itemization (threading `starter_blood_flask`'s real `useEffect.value`/`charges` into the heal, instead of the flat `HEALING_FLASK_HEAL_AMOUNT`/`HEALING_FLASK_MAX_CHARGES` constants) was cut from this build, per the plan. It remains a real, named, deferred gap: `useEffect` is read by zero server code anywhere today, unlike `statModifiers` (which `CharacterStatsService` already generically consumes for `damage`/`armor`), so wiring it means building a new small read path, not threading an already-computed value — a different, larger risk class than the dodge/flask room-parity fix above. Cutting it creates no new debt: the gap is exactly where 0.12's planning pass found it (`healingFlaskConfig.ts`'s own header comment already names this as "no flask affixes... yet" — a documented, pre-existing Core 0.1 scope decision, not something this build broke). It remains open for a future, properly-scoped pass.

### Balance tuning — deferred again, logged explicitly

This build's planning brief asked directly whether 0.12 should tune the armor-ceiling and Skitter-floor findings 0.11 surfaced, now that there is real data to act on. The plan weighed this seriously (see `docs/CORE_BUILD_0_12_PLAN.md`'s "The Question This Build's Brief Actually Asks" section) and decided against it: whether "everything floors to 1 at max armor" is a problem or the intended reward for itemization is a design-intent question, not an arithmetic one, and 0.11 already characterized it as a legitimate outcome. Nothing new changed that verdict. A numeric-invariant test could verify a *chosen* tuning target (e.g. "at least two distinct mitigated-damage outcomes across the four enemies at every armor level 0-9"), but it would only prove the new numbers satisfy a target this environment invented, not that the target is right or that the result feels better — a categorically weaker claim than what 0.9-0.11's tests have actually proven. The plan proposes that a future balance build start from a human-set target curve, not one reverse-engineered from what's easiest to verify here.

### Verification

Per `AGENTS.md`'s "Verification Must Be Permanent" rule and this build's explicit efficiency constraint, verification ran entirely through the existing harness — no live dev-server step was needed (this build touches no client/UI code).

**In-process (`apps/server/test/`, `pnpm --filter @doomscrolls/server test` — 12 files, 21 tests, all passing):**

- `test/combat/dodgeIntent.test.ts` (new — `CombatRoom`'s first-ever dodge assertion): a dodge sent in `blackwire_sewers` moves the player's real `x`/`y` by the real `DEFAULT_DODGE_DISTANCE`, clamped to the real zone bounds (computed via the same `resolveZoneBounds` the application logic itself uses, not a hardcoded expectation), and advances `nextDodgeAt` — proving the intent actually resolves, not just that sending it doesn't error.
- `test/combat/healingFlaskIntent.test.ts` (new — `CombatRoom`'s first-ever healing-flask assertions): a flask use heals the test character's real HP by the real `HEALING_FLASK_HEAL_AMOUNT`, decrements a real charge, and sets a real cooldown timestamp; a second case confirms a depleted-charges flask is rejected with `no_charges`.
- **Regression-check discipline** (per 0.9-0.11's established practice): both new `onCreate` registration calls were temporarily commented out and the three new test cases were confirmed to fail — each timed out waiting for its expected `_accepted`/`_rejected` message after 3000ms, reproducing exactly the "the input silently does nothing" symptom this build fixes — before restoring both registrations and re-verifying all 21 tests green.

**Typecheck:** `pnpm -r typecheck` — 0 errors across all 6 workspace packages.

### Non-goals held

No enemy damage/heavyAttackDamage, armor item, or mitigation-formula changes; no `heavy_strike`/third-skill-slot wiring; no gating of the existing no-flask-equipped baseline; no new dodge/flask mechanics, effects, or numbers; no new zones, classes, skills, or enemy types; no death/respawn consequences, loadout system, or objectives/quest depth — all exactly as scoped in the plan.
