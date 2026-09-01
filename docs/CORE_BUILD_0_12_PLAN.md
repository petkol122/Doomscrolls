# docs/CORE_BUILD_0_12_PLAN.md — Core Build 0.12 Plan

## Status

**Planning phase.** Core Build 0.11 shipped armor mitigation wiring (incoming enemy damage now consults the player's real `armor` stat, mirroring 0.10's weapon-damage fix) and is now the stable baseline. Core Build 0.12 planning begins as the next scoped build, explicitly scoped to gameplay.

No runtime code changes, gameplay implementation, schema changes, or UI implementation are part of this planning task.

---

## Core 0.12 Theme

**Combat Integrity, Part Three — Dodge and Healing Flask in the Real Combat Zones**

---

## The Question This Build's Brief Actually Asks: Is It Time to Tune, Not Just Wire?

0.11 surfaced two concrete numeric findings, not just a wiring gap: at realistic max armor (9), every current enemy attack floors to 1 damage, including the Brute's heavy hit; and `trashboar_skitter`'s raw damage (1) is already at that floor at *zero* armor, so armor never affects it at all. Both were named on the record and deliberately left untouched, per 0.10/0.11's "wire it correctly, don't tune it" discipline. This build's planning brief asks directly: should 0.12 be the build that finally tunes numbers, now that there's real data to tune against — or should it defer again?

This section makes the case both ways, as asked, before landing on a recommendation.

### The case for tuning now

- **The gate has genuinely been crossed.** Before 0.10/0.11, armor and damage were fake — there was nothing real to tune. That is no longer true. This is the first build where a balance question could be asked about numbers that actually do something.
- **The findings are concrete, not vibes.** "Every enemy floors to 1 at armor 9" and "Skitter's damage never differs regardless of armor" are specific, named, reproducible facts about existing content values, not a vague "combat doesn't feel right" complaint.
- **A verification path without a live playtest does exist, in the same spirit as 0.10's Wave 4.** A tuning change could be checked by a numeric-invariant test: enumerate the realistic armor range (0-9) against all four enemies' damage/heavyAttackDamage values and assert a stated property — e.g. "at every armor value from 0 to 9, at least two distinct mitigated-damage outcomes exist across the four enemies" or "no enemy is floor-locked at armor 0." This is real, permanent, automatable verification, not hand-waving.

### The case against tuning now (why this plan does not pick it)

- **Whether the finding is even a problem is a design-intent question, not an arithmetic one — and 0.11 already answered it once.** 0.11's own plan characterized this exact outcome as "a legitimate flat-mitigation-with-a-floor outcome... armor doing its job is supposed to feel like this." Trivializing early-zone trash once a character is fully geared is a completely ordinary, often *intentional* ARPG reward curve, not automatically a bug. Nothing new has been learned since 0.11 that overturns that read — restating the same finding a build later isn't new information, and re-litigating an explicitly-accepted tradeoff without new evidence is scope creep dressed as diligence.
- **The numeric-invariant verification approach above proves less than it appears to.** It would prove that *new* numbers satisfy *a target I invent* (e.g. "at least two distinct outcomes"). It cannot prove that target is the right one, or that the new numbers feel better than the old ones — that remains exactly as unverifiable here as it was in 0.10. Tuning wouldn't shrink the pile of "numbers nobody has felt-tested," it would just move the pile to a different set of constants. That is a materially weaker claim than what 0.9-0.11's tests actually proved ("this code path now demonstrably consults the real stat, where it demonstrably didn't before") — and this project's test suite has meant the stronger claim across every build so far. Diluting that is a real cost, not a free upgrade in rigor.
- **It would be the first build to touch stable, untouched content values** (`enemies.ts` since 0.1/0.6, `items.ts`'s armor values since 0.1/0.7) rather than server-side plumbing — a genuine escalation in blast radius and reversibility risk relative to every wiring fix so far, for a payoff (numbers that are differently arbitrary, not provably better) that doesn't clearly justify it.
- **A cleaner, more clearly-bounded, more urgent gap was found during this planning pass instead** (below) — one that is unambiguously a bug, not a design-intent question, and closes with the same low-risk, high-confidence shape as 0.9-0.11's fixes, with zero new numbers invented.

**Decision: defer balance tuning again**, not by reflex or because it's harder to scope, but because this planning pass found something more clearly broken, more bounded, and higher-impact to fix first. The balance question is not abandoned — see "Flagged for a Future Build" below for how this plan thinks it should eventually be scoped.

---

## What This Planning Pass Actually Found

Two other candidates were audited and ruled out or superseded before landing on this build's theme:

**`heavy_strike` / a third "primary" skill slot — investigated and confirmed NOT a bounded wiring fix.** `heavy_strike` is `startingSkillId` on both classes, validated for existence only, never resolved by any input path — the same "content exists, never consulted" shape as 0.10/0.11's bugs. But unlike those, wiring it in would require **new** client UI, a **new** hotkey, and a **protocol change**: `packages/shared/src/protocol/ClientMessages.ts`'s `request_use_skill_slot.slot` field is a hard-coded `"secondary" | "tertiary"` union with no room for a third value, there is no "primary" slot concept anywhere in the client (`apps/client/src`), and no disabled/placeholder UI affordance for a third combat action exists. This independently confirms what 0.9's and 0.11's plans already concluded three times over: this is a different-shaped, bigger feature, not a small fix. Still a real, named, deferred gap — not this build's job.

**The real find: `CombatRoom` has no dodge and no healing-flask handler at all.** Confirmed by reading every `this.onMessage(...)` registration in both rooms:

- `TownRoom.ts` registers `request_dodge` and `request_use_healing_flask` (among 16 total handlers). `CombatRoom.ts` registers neither (its 6 handlers are `request_move`, `request_attack`, `request_use_skill_slot`, `request_pickup_world_loot`, `request_respawn`, `request_combat_return`).
- This means **a player fighting in Blackwire Sewers or Static Yard — the two dedicated combat zones this game actually has — cannot dodge or use their healing flask at all.** Pressing Space or Q there does nothing: the client sends the same `request_dodge`/`request_use_healing_flask` messages unconditionally regardless of which room it's in (confirmed by reading `worldSessionDodgeInput.ts` and the healing-flask input module — neither gates on room kind), and the server silently has no listener for either message type in `CombatRoom`.
- **This is not a documented scope decision.** `docs/CORE_BUILD_0_6_PLAN.md` (Static Yard) explicitly lists "movement, attack, dodge, flask, telegraph, loot pickup" as existing `CombatRoom.ts` gameplay logic that the new zone would simply reuse unchanged — that statement has been incorrect since it was written; dodge and flask were never actually in `CombatRoom.ts`. This reads as a genuine, unnoticed gap, not a choice.
- **`CombatRoom.ts` already tracks and persists flask state as if it expected to support it**: it restores full flask charges on respawn (`restoreFlaskToFull(player)`), clamps and persists `flaskCharges`/`maxFlaskCharges` on leave, and threads `restoredFlaskCharges` through its presence builder. There would be no reason to carry all of that plumbing if flask use were never meant to work there. `nextDodgeAt`, by contrast, has zero references anywhere in `CombatRoom.ts` — dodge appears to have simply never been considered when `CombatRoom` was built out, rather than half-wired like flask was.
- **The underlying application logic is already fully built, already correct, and already covered by existing behavior in `TownRoom`** — `applyDodgeIntent.ts`, `dodgeIntentValidation.ts`, `dodgeCooldown.ts`, `applyHealingFlaskIntent.ts`, `healingFlaskConfig.ts`. Closing this gap means registering the same message handlers in `CombatRoom.ts` that already exist in `TownRoom.ts`, calling the same helpers — not writing new game logic. `CombatRoom.ts` already does exactly this kind of TownRoom-logic reuse today for `request_attack` (via an `as unknown as Parameters<typeof validateAttackIntent>[0]` cast), so there is a direct, working precedent for the one type-shape wrinkle this port will hit (`applyDodgeIntent`'s `state` parameter is typed as `TownRoomState`, not a room-agnostic shape).
- **Zone bounds are not the blocker.** `resolveZoneBounds(zoneId)` (used by `applyDodgeIntent` to clamp the dodge target) resolves generically from content by `zoneId` — it already covers `blackwire_sewers`/`static_yard` the same way it covers `nightmarket`, since `CombatRoom` already relies on zone-bounds-by-content-id for its own movement validation.

**A second, smaller finding in the same file: the healing flask's heal amount is itemized in content but never read by the mechanic.** `starter_blood_flask` (`packages/content/src/data/items.ts`) carries `useEffect: { type: "restoreHpInstant", value: 25, charges: 3 }`. `applyHealingFlaskIntent`'s actual heal amount comes from a separate hard-coded constant, `HEALING_FLASK_HEAL_AMOUNT = 25` in `healingFlaskConfig.ts` — the numbers happen to match today only by coincidence, not because anything reads the item. Unlike `damage`/`armor` before 0.10/0.11, this was **explicitly, deliberately simple from Core 0.1** — `healingFlaskConfig.ts`'s own header comment says "There is no per-character stat, no flask affixes... yet," naming this as intentionally-simple-for-now scope, not an oversight. It is real, and `applyHealingFlaskIntent`'s input type already carries an unused `healAmount?: number` override "kept for symmetry with the dodge apply helper and to make tests trivial," per its own comment — the seam for this exact fix already exists. But **`useEffect` is read by zero server code anywhere today** (confirmed by a repo-wide search) — unlike `statModifiers`, which `CharacterStatsService` already consumes generically for `damage`/`armor`, there is no existing consumption path for `useEffect` to plug into. Wiring this in means building a new (small) read path, not threading an already-computed value the way 0.10/0.11 did. This is real scope, just a materially smaller and lower-risk piece than the dodge/flask room gap above — see Pillar 3 and Non-Goals for how this plan treats it.

---

## Major Feature Pillars

### 1. Port `request_dodge` into `CombatRoom`

**Goal:** A player in Blackwire Sewers or Static Yard can dodge, exactly as they already can in Nightmarket.

Candidate scope:

- Register a `request_dodge` handler in `CombatRoom.ts`, mirroring `TownRoom.ts`'s handler: same alive/lifeState gate, same `validateDodgeIntent`, same `isDodgeReady`/`consumeDodgeCooldown`, same `applyDodgeIntent` call, same accepted/rejected response shape.
- Resolve `applyDodgeIntent`'s `state: TownRoomState`-typed parameter the same way `CombatRoom.ts` already resolves `validateAttackIntent`'s TownRoom-shaped parameter today (an `as unknown as` cast, or a small shared-shape type — implementation detail to decide during the task, not here).
- No changes to `applyDodgeIntent.ts`, `dodgeIntentValidation.ts`, or `dodgeCooldown.ts` themselves — this pillar is a registration/reuse port, not new dodge logic.
- No client changes — confirmed the client already sends `request_dodge` unconditionally regardless of room kind; it simply hasn't had anywhere to land in `CombatRoom`.

### 2. Port `request_use_healing_flask` into `CombatRoom`

**Goal:** A player in a real combat zone can heal with their flask, exactly as they already can in Nightmarket.

Candidate scope:

- Register a `request_use_healing_flask` handler in `CombatRoom.ts`, mirroring `TownRoom.ts`'s handler: same `applyHealingFlaskIntent` call (alive gate, charges gate, cooldown gate, full-HP gate), same accepted/rejected response shape.
- No changes to `applyHealingFlaskIntent.ts` or `healingFlaskConfig.ts` themselves for this pillar — same reuse-not-rewrite shape as Pillar 1.
- No client changes — same reasoning as Pillar 1.

### 3. (Bonus, cut first if scope runs short) Flask itemization — thread the equipped flask's real heal amount

**Goal:** `starter_blood_flask`'s `useEffect.value`/`charges` actually determine the heal, when a flask is equipped.

Candidate scope:

- At the same join/recalculation points already used for `damage`/`armor` (0.10/0.11 precedent), look up the equipped `flask_1` item (if any) via `ItemRepository.listEquippedItems`, and if its content definition has a `useEffect` of type `restoreHpInstant`, pass its `value`/`charges` into `applyHealingFlaskIntent`'s existing `healAmount` override and into `restoreFlaskToFull`'s charge grant, instead of the flat constants.
- **The one design decision this pillar raises, flagged for approval like every prior build's formula decision:** when no flask is equipped, should the player still get the existing baseline (3 charges of 25 HP, matching `healingFlaskConfig.ts`'s current unconditional grant), or zero? This plan's recommendation is to **keep the existing baseline as the no-flask fallback** and only let an equipped flask's real values override it — this preserves all current player-facing behavior for anyone who has no flask equipped (a strictly additive change, not a removal of an existing entitlement), and matches the "sensible fallback when data is absent" pattern `resolvePlayerDamage`/`resolvePlayerArmor` already established. Fully gating healing behind equipment ownership is a bigger, riskier behavior change than this build's "port + wire" scope intends, and is explicitly not the default here.
- This pillar is scoped smaller and named explicitly as the first thing to cut if Pillars 1-2 consume the available session budget — `useEffect` has no existing consumption path anywhere in the server (unlike `statModifiers`, which `CharacterStatsService` already generically folds for `damage`/`armor`), so this is new plumbing, not thread-an-existing-value, and is honestly a different risk class than Pillars 1-2.

---

## Verification Strategy (in-process only — no live server expected)

Every piece of this build's server logic gets a vitest case in `apps/server/test/`, per `AGENTS.md`'s "Verification Must Be Permanent" rule. Like 0.10/0.11, this build is expected to be fully verifiable in-process: Pillars 1-2 are pure message-handler registration reusing already-tested logic, and Pillar 3 (if attempted) is pure server-side item-value threading. No client/UI code is touched anywhere in this plan, so no live dev-server step is expected to be required.

Planned test additions:

- **`test/combat/dodgeIntent.test.ts` (new — `CombatRoom`'s first dodge coverage):** join `CombatRoom`, send `request_dodge`, assert the player's position actually changed by the expected distance and stayed within zone bounds — the same shape of proof `TownRoom` already has implicitly through its existing manual-smoke coverage, now made permanent for `CombatRoom` specifically.
- **`test/combat/healingFlaskIntent.test.ts` (new — `CombatRoom`'s first flask coverage):** join `CombatRoom`, damage the player below max HP, send `request_use_healing_flask`, assert `hp` increased, `flaskCharges` decremented, and `nextFlaskAt` set — and a rejection case (no charges / on cooldown / already full HP) using the same reasons `TownRoom`'s existing behavior already produces.
- **If Pillar 3 is attempted:** a case proving an equipped `starter_blood_flask` overrides the flat heal amount, and a case proving the no-flask fallback is unchanged from today's behavior.
- Regression-check discipline per 0.9-0.11's established practice: temporarily remove/break each new handler registration, confirm the new tests fail (a `request_dodge`/`request_use_healing_flask` sent to `CombatRoom` currently gets no response at all — the test's `waitForMessage` should time out or the position/hp assertion should show no change), then restore and re-verify green.
- `pnpm --filter @doomscrolls/server typecheck` and `pnpm --filter @doomscrolls/server test`.

---

## Core 0.12 Non-Goals

```text
any enemy damage/heavyAttackDamage value changes, any armor item value changes, any mitigation-formula change -- balance tuning is explicitly deferred again this build (see "Flagged for a Future Build")
wiring heavy_strike / a third "primary" skill slot -- confirmed to require new client UI + a protocol change, not a bounded fix; still deferred
gating the existing no-flask-equipped baseline (3 charges, 25 HP) behind equipment ownership -- if Pillar 3 lands, the current baseline stays the fallback, not removed
new dodge or healing-flask mechanics, effects, or balance numbers -- this build ports existing, already-correct logic into a room that's missing it; it does not change what dodge or the flask do
new zones, classes, skills, or enemy types
death/respawn consequences, a loadout/build-choice system, objectives/quest depth -- unchanged, still deferred for the same reasons as 0.9-0.11
```

---

## Flagged for a Future Build: Balance

The armor-ceiling and Skitter-floor findings from 0.11 remain real and are not being dismissed — they are logged here explicitly so they aren't quietly lost. This plan's recommendation for whenever a balance build is actually picked up:

- **Start from a stated target, not an invented one.** Before implementing anything, get an explicit answer from the user/design lead to a concrete question like: "across the realistic 0-9 armor range, how many of the four enemies should still deal visibly different damage to a maxed-armor character?" or "should Skitter's damage ever matter against armor, or is it fine as a pure early-game nuisance hit?" Verification in this environment can then check the *chosen* target numerically (the same kind of invariant test sketched in this plan's "case for tuning" section above) — but the target itself should come from a real design call, not be reverse-engineered from what's easiest to prove.
- **Treat it as its own build**, not a rider on a wiring build — the moment any enemy `damage` value, `heavyAttackDamage` value, armor item value, or the mitigation floor constant changes, that's a balance-tuning build by definition, with the different verification ceiling this plan describes above, and deserves to be scoped and reviewed as one.

---

## 0.11 Freeze / Stability Baseline

Core Build 0.11 should now be treated as the stable shipped baseline. That means:

- 0.11's full server test suite (18 tests across 10 files) is the required regression baseline this build must not break.
- The armor mitigation fix and the weapon-damage fix (0.10) must not regress.
- `TownRoom.ts`'s existing dodge/flask behavior must not change at all — this build only adds the equivalent capability to `CombatRoom`, reusing `TownRoom`'s logic without modifying it.

---

## Candidate Task Waves

### Wave 1 — Planning

- Finalize 0.12 scope documents (this plan + checklist)
- Reconfirm 0.11's full server test suite as the regression baseline 0.12 must not break

### Wave 2 — Dodge in CombatRoom (priority)

- Register `request_dodge` in `CombatRoom.ts`, reusing `applyDodgeIntent`/`validateDodgeIntent`/`dodgeCooldown` helpers unchanged
- Resolve the `TownRoomState`-typed parameter the same way `validateAttackIntent` is already reused in `CombatRoom.ts`
- Add `test/combat/dodgeIntent.test.ts`

### Wave 3 — Healing flask in CombatRoom (priority)

- Register `request_use_healing_flask` in `CombatRoom.ts`, reusing `applyHealingFlaskIntent`/`healingFlaskConfig` helpers unchanged
- Add `test/combat/healingFlaskIntent.test.ts`

### Wave 4 — Optional, cut first: flask itemization

- Thread an equipped `starter_blood_flask`'s real `useEffect.value`/`charges` into the heal/charge-grant paths, preserving the existing no-flask baseline as the fallback
- Add the corresponding test cases
- If cut: no new debt is created — the itemization gap is exactly where this planning pass found it, explicitly named, not silently dropped

### Wave 5 — Docs and Polish

- `docs/CORE_BUILD_0_12_RELEASE_NOTES.md`
- Full `pnpm -r typecheck` and `pnpm --filter @doomscrolls/server test`

---

## Risks

1. **`applyDodgeIntent`'s `TownRoomState`-typed parameter** is the one real type-shape wrinkle in this port, but it has a direct, working precedent already in `CombatRoom.ts` (`validateAttackIntent` is reused the same way today) — low risk, a known pattern, not a new one.
2. **A residual chance dodge/flask were excluded from `CombatRoom` on purpose, for an undocumented pacing reason** — mitigated by the audit already performed for this plan: `CombatRoom.ts` already tracks and persists flask state as though it expected to support it, and no build doc anywhere states dodge/flask-in-CombatRoom as a deliberate non-goal (0.6's plan states the opposite, incorrectly, that it already worked). If implementation surfaces a real reason this was intentional, that should stop the build and get flagged, not be silently overridden.
3. **Pillar 3 (flask itemization) is a different, larger risk class than Pillars 1-2** — `useEffect` has no existing consumption path anywhere in the server, unlike `statModifiers`. Named explicitly as the first thing to cut, per the plan's own Wave 4 framing.
4. **Balance tuning is deferred a third time in a row** (after objectives/loadout and death-consequences), but for a different, specific reason each time — no spare content to choose between (loadout), no existing formula to build from (death), and now, for balance specifically: the finding is real but design-intent-dependent, and the verification available for a tuning change is categorically weaker than what this project's tests have proven so far. This is named explicitly here, with a concrete proposal for how to unblock it (see "Flagged for a Future Build"), not left as an unexplained pattern.
5. **Content/localization scaling does not apply** — no new classes, skills, items, or zones in this build.

---

## Decision: Recommended Order

Waves 2 and 3 (dodge and flask registration) are independent of each other and can be done in either order or interleaved — both are pure reuse of already-correct `TownRoom` logic via a new `CombatRoom` registration, with no shared new code between them. Wave 4 (flask itemization) is attempted only if Waves 2-3 land with scope to spare, and is the first and only thing to cut if not.

---

## Validation Expectations for 0.12 Tasks

```bash
pnpm -r typecheck
pnpm --filter @doomscrolls/server test
```

No live dev-server verification is expected to be required for this build — no client/UI code is touched.

---

## Summary

Core Build 0.12 was weighed between two real options: tuning the balance findings 0.11 surfaced (armor's ceiling, Skitter's floor-locked damage), or continuing the wiring/mechanism discipline of 0.9-0.11. Balance was seriously considered — the gate for it has genuinely opened now that damage and armor are both real — but was set aside again because whether the current numbers are a problem is a design-intent question this environment can't resolve any better than it could last build, and any new numbers picked here would be exactly as unverified for feel as the old ones, just relocated. Instead, this planning pass found a cleaner, more urgent, unambiguous gap: `CombatRoom` — the game's actual dedicated combat zones — has no dodge and no healing flask at all, a silent, undocumented gap (not a decision) that leaves players in real fights without two tools they've had in Nightmarket since Core 0.1. Closing it is a pure reuse-and-register port of already-built, already-correct logic, the same low-risk shape 0.9-0.11 have already proven works. The balance question is logged explicitly for a future build, with a concrete proposal (a human-set target first, then numeric verification against it) rather than left to repeat as an unexplained deferral.
