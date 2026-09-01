# docs/CORE_BUILD_0_11_PLAN.md — Core Build 0.11 Plan

## Status

**Planning phase.** Core Build 0.10 shipped weapon-damage wiring (basic attacks and skill casts now deal a real, character-derived `damage` number instead of a hardcoded literal) and is now the stable baseline. Core Build 0.11 planning begins as the next scoped build, explicitly scoped to gameplay, not infra/tooling.

No runtime code changes, gameplay implementation, schema changes, or UI implementation are part of this planning task.

---

## Core 0.11 Theme

**Combat Integrity, Part Two — Wiring Armor Mitigation**

---

## Which Gap Matters More: The Case For Armor Over the Alternatives

Four candidates were weighed for 0.11: armor mitigation (the incoming-damage half of 0.10's fix), death/respawn consequences (currently a no-op), a loadout/build-choice system (still explicitly deferred at 0.9), and more world/objectives content (declined at 0.6 and 0.9). Here is the case for armor, and the case against each alternative.

**Why not a loadout/build-choice system:** unchanged from 0.10's reasoning — still only 5 skill definitions exist total (see audit below), both classes' slots are already filled, and there is still no spare skill content to let a player choose between. Nothing about 0.10 changed this calculus.

**Why not more objectives/world content:** declined at 0.6 and declined again explicitly in 0.9's non-goals. Nothing new changes that here either.

**Why not death/respawn consequences, even though it's a real gap:** confirmed by audit (see below), dying today costs nothing — instant, free, full-HP/full-flask respawn with no timer and a purely cosmetic corpse marker. This is real, but it is a **deliberate scope decision**, not an oversight: `CombatRoom.ts`'s respawn handler is explicitly commented "Minimal respawn... Heavy corpse / recovery UI is out of scope." Fixing it means designing a real penalty from scratch — a respawn timer? Lost currency? A corpse-run mechanic with real dropped items? None of that has an existing formula or precedent to lean on, unlike armor (see below). That makes it open-ended in the same shape objectives-depth and loadout were declined for: no crisp Definition of Done, real risk of turning into its own build. It stays a flagged, real gap for a future build, not this one.

**Why armor wins — it is 0.10's exact bug, mirrored, and arguably worse:** an audit of the incoming-damage path (enemy attacks reducing player `hp`) found the precise symmetric case to what 0.10 fixed on the outgoing side:

- Enemy attacks apply their content-defined `damage`/`heavyAttackDamage` **directly** to `player.hp`, in two independent call sites — `CombatRoom.ts:1220-1223` (`const damage = Math.max(1, Math.floor(enemyDefinition?.damage ?? 1)); ... targetPlayer.hp = Math.max(0, previousHp - damage);`) and `TownRoom.ts:3416-3419` (`const landingDamage = landingKind === "heavy" ? heavyDamage : enemyAttackDamage; ... landingTarget.hp = Math.max(0, landingTarget.hp - landingDamage);`). Neither call site reads any player defensive stat at all.
- **`PlayerPresence` doesn't even carry an `armor` field.** This is one step worse than 0.10's starting point: `damage` at least existed on the schema before 0.10 (just unpopulated correctly); `armor` doesn't exist on the runtime object at all today.
- **Armor is nonetheless a real, computed, persisted, itemized stat.** `CharacterStatsService.calculateDerivedStats` computes `armor: 0` as the base, and `applyDerivedModifiers` already folds equipped `{ target: "armor" }` statModifiers into it — the exact same code path proven for `damage`. Six items across the game's content already carry armor modifiers (`+1` ×3, `+2`, `+3`, `+5`, in `packages/content/src/data/items.ts`), and `derived.armor` is persisted to the database via `CharacterRepository`. It is computed and stored, then discarded before combat ever sees it — the identical "fake feature" shape `AGENTS.md`'s Core Rule forbids, and the same shape 0.10 already fixed once. Six pieces of armor gear are silently doing nothing today, the same way three weapons silently did nothing before 0.10.
- **It is well-bounded, with 0.10's own implementation as a proven template**, and in fact simpler: 0.10 touched six damage-application call sites (three basic-attack, three skill-cast) across three files; armor only needs two (`CombatRoom.ts`'s and `TownRoom.ts`'s enemy-attack-landing code — `deferredActionExecution.ts` has no enemy-initiated damage path to touch). The wiring shape (schema field → builder inputs → join-time population → recalculation-time sync) is now a known, once-proven pattern, not a new design.

This build closes the other half of "combat stats do real things," making 0.10 and 0.11 a coherent two-build arc, and removes the last blocker to a real end-to-end feel-check of combat (armor doing nothing today means any playtest of 0.10's damage numbers is necessarily playtesting a character with a completely fake defense, which is not this build's job to fix on the feel side, but is a real reason to fix the wiring side first).

---

## Build Framing — Current State (audited 2026-09-01)

Corrections and confirmations against assumptions in this build's planning brief:

- **Enemy types: 4, not 2.** `packages/content/src/data/enemies.ts` defines `trashboar_runt`, `trashboar_brute`, `trashboar_skitter` (added across Core 0.1-0.5), and `static_wretch` (Core 0.6) — 4 total, not 2. "2 enemy types" matches only the Core 0.1-era roster (runt + brute) before Skitter and Static Wretch were added; 0.10's own plan already correctly said "the four enemy types." `blackwire_sewers` and `nightmarket` both use the three Trashboar variants; `static_yard` uses `static_wretch` plus a reused `trashboar_brute` anchor — so Static Yard still isn't a fully independent roster, but the *type* count is 4.
- **Skills: 5 content definitions total, but only 4 are actually castable, and one is orphaned.** `gravewalker` and `ironclad` each have `secondarySkillId`/`tertiarySkillId` (4 unique skills total across the two classes: Grave Spark, Bone Splinter, Shatter Blow, Groundbreaker) plus a shared `startingSkillId: "heavy_strike"`. `heavy_strike` is validated for referential existence only (`ContentValidation.ts`) and is **never resolved or cast by any input path** — the player's actual basic attack (`attackIntentValidation.ts`) uses a hardcoded `BASIC_ATTACK_RANGE` constant with no reference to `heavy_strike`'s content at all (its `baseDamage: 3`, `cooldownMs: 1000`, `range: 1.4` are all dead numbers). This is a third fake-feature-shaped gap in the same family as 0.10's fix and this build's armor fix — **explicitly flagged and deferred, not fixed here** (see Non-Goals): wiring it would mean redefining the basic-attack formula itself, which collides with the already-live, per-character `attackCooldownMs` derived stat (`max(500, 1000 - speed * 25)`) that `consumeAttackCooldown` already uses — a redesign question, not a wiring fix, and a different-shaped decision than this build's bounded armor fix.
- **Incoming damage is 100% flat, confirmed at exact call sites**: `CombatRoom.ts:1220-1223`, `TownRoom.ts:3238` (normal) / `:3246` (heavy) / `:3416-3419` (landing). Neither applies any mitigation.
- **`PlayerPresence` has no `armor` field.** Confirmed by full-file review (`apps/server/src/realtime/rooms/PlayerPresence.ts`) — every other derived combat stat that matters at runtime (`movementSpeed`, `attackCooldownMs`, `damage` as of 0.10) is already a schema field; `armor` is the one still missing entirely.
- **`derived.armor` is computed and persisted, exactly like `derived.damage` was before 0.10.** `CharacterStatsService.calculateDerivedStats`/`applyDerivedModifiers` handle `armor` identically to `damage` (same `add`/`multiply` modifier fold); `CharacterRepository` persists an `armor` column.
- **Death/respawn is confirmed a no-op** (see Non-Goals for why this isn't 0.11's job): instant, free, full-HP/full-flask respawn in both rooms, no timer, no cost, a cosmetic-only corpse marker with no item/currency/XP payload.
- **Enemy AI depth is minimal and deliberately unchanged since 0.6** (`idle`/`chasing`/`returning`/`defeated`, one binary heavy-attack variant on Brute only, no ranged/pack behavior) — confirmed still explicitly out of scope per 0.6's plan, not reopened here.
- **No PvP exists** — confirmed zero player-vs-player damage path. Not relevant to this build (armor only ever mitigates enemy-to-player damage).

Core 0.11 should answer:

> Armor items have existed since Core 0.1 (`sewer_jacket`) and been extended at 0.7 (epic armor pieces), computed correctly, and persisted to the database — but have never once reduced a real hit, because incoming damage never looks at the player at all, and the runtime schema doesn't even have anywhere to put the number. What does it take to make equipping armor actually change what a hit costs?

---

## Major Feature Pillars

### 1. Thread `derived.armor` onto `PlayerPresence`

**Goal:** Give the runtime presence object the field it's missing, populated the same way `damage` was in 0.10.

Candidate scope:

- Add `@type("number") public armor: number` to `PlayerPresence.ts`, as a new constructor parameter.
- Add a `resolvePlayerArmor.ts` helper mirroring `resolvePlayerDamage.ts`'s shape (fallback `0`, matching `calculateDerivedStats`'s own base value for zero armor — unlike damage's `1` floor, `0` is the correct unarmored baseline).
- Add `armor` to `BuildTownPlayerPresenceInput`/`BuildCombatPlayerPresenceInput`, populate at join in both `onJoin` handlers from `result.character.stats?.derived.armor`.
- Add `player.armor = recalculated.derived.armor` to all three rooms' `applyProgressionUpdate` helper (`CombatRoom.ts`, `TownRoom.ts`, `deferredActionExecution.ts`) — the recalculation already runs and already computes this value; only `deferredActionExecution.ts`'s helper doesn't currently have an enemy-damage-to-player path to consume it, but keeping all three in sync (as 0.10 did for `damage`) avoids a repeat of the "stale in one path" risk class.

### 2. Apply armor mitigation at both enemy-damage-landing call sites

**Goal:** Make the two places an enemy attack reduces `player.hp` actually consult `player.armor` first.

Candidate scope:

- `CombatRoom.ts:1220-1223`: change the flat `damage` value into a mitigated value before subtracting from `hp`.
- `TownRoom.ts:3416-3419`: same change, applied uniformly to both `landingKind` branches (normal and heavy) — armor mitigates a heavy hit the same way it mitigates a normal one; no special-casing.
- **Recommended formula** (the one design decision in this build, flagged for approval): `mitigatedDamage = Math.max(1, rawDamage - player.armor)`. This mirrors 0.10's own floor-preserving philosophy exactly (a `1` HP-loss floor per landed hit, so armor cannot grant total immunity, the same way `damage`'s `1` floor meant power/gear couldn't be reduced to zero) and keeps the mitigation additive/flat, consistent with every other derived-stat formula in `CharacterStatsService` (nothing in this codebase uses percentage-based or diminishing-returns mitigation today). An alternative — allowing armor to fully block a hit down to `0` — is a reasonable substitute if preferred, but changes the "guaranteed minimum chip damage" property this plan defaults to.
- **Arithmetic check against real numbers, done before implementation (see Risk 6 below for the full analysis and the explicit tradeoff this surfaces):** the realistic maximum simultaneously-equipped armor is **9**, not the naive 13-point sum of all six armor-modifying items — `chest` and `head` are each single slots contested by multiple items (`warden_plate` +5 beats `sewer_jacket` +2 and `chargeplate_vest` +1 for `chest`; `scavenger_king_helm` +3 beats `scavenged_hood` +1 for `head`), so only one item per slot ever counts. `9 = warden_plate(+5) + scavenger_king_helm(+3) + rustbound_ring(+1)`. Even at this realistic max, every current enemy attack — including Trashboar Brute's heavy attack (6, the hardest hit in the game) — floors to the minimum 1 HP per hit under the recommended formula. The formula is kept as planned; this is named explicitly, not treated as a reason to change it (see Risk 6).
- No change to enemy content values (`damage`, `heavyAttackDamage`) themselves — only what happens to that number before it reaches `hp`.

Guardrails:

- Both call sites must change together, same risk shape as every prior "all rooms/sites together" build (0.9's `classKey`, 0.10's `damage`) — mitigated the same way, with a per-room integration test each.
- `deferredActionExecution.ts` is confirmed to have no enemy-initiated damage call site (only player-initiated attack/skill paths), so there is nothing to change there for Pillar 2 — only Pillar 1's presence-sync needs to touch it, for consistency.

### 3. Verification: first-ever incoming-damage-mitigation coverage

**Goal:** Prove both that the formula is correct in isolation and that real combat actually applies it — the same two-layer pattern used in 0.9 and 0.10.

Candidate scope:

- Extend the existing `CharacterStatsService` unit test file (`test/character/characterStatsService.test.ts`, first added in 0.10) with a case proving an `armor` stat modifier folds into `derived.armor` the same way a `damage` modifier does — this path is already exercised generically by the existing tests' loop structure, so this is a small, targeted addition, not new test infrastructure.
- New integration tests, one per room, proving an enemy hit against an armored player deals less raw `hp` loss than the same hit against an unarmored one, and that the floor holds (armor greater than raw damage still costs exactly 1 HP, never 0): likely `test/combat/incomingDamageMitigation.test.ts` and a `test/town/` equivalent, following `test/combat/basicAttackDamage.test.ts`'s established shape (set `player.armor` directly on the presence, or use the fixture's real equipped-armor recalculation path if that proves easy to exercise; direct presence assignment is simpler and sufficient, following how 0.9/0.10's tests set state directly rather than always routing through a full equip flow).
- Regression-check discipline per 0.9/0.10's established practice: temporarily revert the fix, confirm the new tests fail with the exact expected old/new number mismatch, then restore.

---

## Verification Strategy (in-process only — no live server expected)

Every piece of combat-damage logic in this build gets a vitest case in `apps/server/test/`, per `AGENTS.md`'s "Verification Must Be Permanent" rule. Like 0.10, this build touches no client/UI code — it is pure server-side combat math and schema wiring — so it is expected to be fully verifiable in-process, with no live dev-server step required.

**Explicitly not this build's job** (per this build's planning brief): confirming the resulting damage-in/damage-out numbers *feel* good together, in a real playtest. 0.10 already flagged this as open; 0.11 does not close it, it only makes armor's contribution to that eventual feel-check real instead of fake. If a numeric sanity pass is useful the way 0.10's Wave 4 was (checking real content numbers against each other, not a live playtest), it should say so plainly and not be presented as equivalent to actually playing it — same discipline 0.10 used for its own Wave 4.

Planned test additions:

- Extend `test/character/characterStatsService.test.ts` with an armor-modifier case.
- New `test/combat/incomingDamageMitigation.test.ts` and a `test/town/` equivalent.
- `pnpm --filter @doomscrolls/server typecheck` and `pnpm --filter @doomscrolls/server test`.

---

## Core 0.11 Non-Goals

```text
death/respawn consequences (respawn stays instant, free, and cost-free) -- a real, flagged gap, deliberately left for a future build with its own scoping, not folded in here
wiring heavy_strike / a "primary" skill slot into the basic-attack formula -- a real, flagged gap, but redefining basic attack collides with the already-live per-character attackCooldownMs derived stat; a redesign question, not a wiring fix
a loadout/build-choice system -- still deferred; unchanged since 0.9/0.10, no spare skill content exists
new enemy types, new AI states, ranged or pack-aggro enemy behavior -- unchanged since 0.6's explicit non-goal
new zones, new classes, new skills, new items, new equipment slots
percentage-based or diminishing-returns mitigation formulas -- the flat, floor-preserving formula is the default; a different formula is a balance decision for a future build, not a wiring correctness question
rebalancing enemy damage/heavyAttackDamage content values, or existing armor item values
PvP or player-vs-player damage
objectives/quest depth (declined at 0.6, declined again at 0.9)
a live playtest verifying combined damage+armor combat feel -- explicitly out of scope per this build's brief; the numbers are proven wired correctly, not proven to feel good
```

---

## 0.10 Freeze / Stability Baseline

Core Build 0.10 should now be treated as the stable shipped baseline. That means:

- 0.10's full server test suite (12 tests across 8 files) is the required regression baseline this build must not break.
- The weapon-damage wiring fix (`player.damage` consumed by both basic attacks and skill casts, via `resolveSkillCastDamage`) must not regress.
- Any bug fix needed along the way must be minimal and regression-focused.

---

## Candidate Task Waves

### Wave 1 — Planning

- Finalize 0.11 scope documents (this plan + checklist)
- Reconfirm 0.10's full server test suite as the regression baseline 0.11 must not break

### Wave 2 — Presence Wiring (priority)

- Add `armor: number` to `PlayerPresence`, both presence-builder input interfaces, and both `onJoin` call sites
- Add `resolvePlayerArmor.ts` (mirrors `resolvePlayerDamage.ts`, fallback `0`)
- Add `player.armor = recalculated.derived.armor` to all three rooms' `applyProgressionUpdate` helper
- Extend the `CharacterStatsService` unit test with an armor-modifier case

### Wave 3 — Mitigation at the Landing Sites (priority, the real fix)

- Apply the agreed mitigation formula at `CombatRoom.ts:1220-1223` and both `TownRoom.ts` landing branches (`:3416-3419`)
- Add `test/combat/incomingDamageMitigation.test.ts` and a `test/town/` equivalent
- `pnpm --filter @doomscrolls/server typecheck` and `pnpm --filter @doomscrolls/server test` both pass
- Regression-check discipline: revert, confirm the new tests fail with the expected old/new number mismatch, restore, re-verify green

### Wave 4 — Docs and Polish

- `docs/CORE_BUILD_0_11_RELEASE_NOTES.md`
- Full `pnpm -r typecheck` and `pnpm --filter @doomscrolls/server test`

Unlike 0.10, this build has no analogous "Wave 4 feel pass" — the live-feel question is explicitly out of scope here (see Non-Goals), not deferred-but-attempted.

---

## Risks

1. **The mitigation formula is the one genuine design judgment call**, flagged explicitly above for approval before implementation — same shape of risk as 0.10's skill-damage-bonus formula. Low risk of it being *wrong* (it's a floor-preserving subtraction, easy to reason about and reverse), but it is a real choice, not just wiring existing numbers through.
2. **Both landing call sites must change together**, or one room could apply mitigation while the other still deals raw damage — same risk shape as every prior "all sites together" fix. Mitigated with a per-room integration test each, not inspection alone.
3. **This build makes existing enemies noticeably weaker against armored characters**, by design — six armor items that currently do nothing will start doing something. Combined with 0.10's damage fix, this changes the overall combat pace again. This plan explicitly does not attempt to judge whether the combined result feels good (see Non-Goals) — only that armor is now real, correctly-applied mitigation.
4. **Content/localization scaling does not apply** — no new classes, skills, items, or zones. Called out only because every prior build's risk list has carried this.
5. **The orphaned `heavy_strike`/basic-attack-formula gap, once flagged, could tempt scope creep** into "fix the basic attack formula while we're in here." This plan explicitly declines that (see Non-Goals) — it is a different-shaped decision (redesigning a formula, not wiring an existing stat) and deserves its own build.
6. **A fully-armored character floors every current enemy's damage to the minimum, and armor's useful range against the weakest enemies is very narrow — named explicitly, per this build's planning brief, rather than left silent.** Worked against real content values (`packages/content/src/data/enemies.ts`, `items.ts`), with the recommended `Math.max(1, rawDamage - player.armor)` formula:
   - Enemy raw damage: `trashboar_skitter` 1, `trashboar_runt`/`static_wretch` 2, `trashboar_brute` 3 (normal) / 6 (heavy — the hardest hit in the game).
   - Realistic max simultaneously-equipped armor is **9**, not a naive 13-point sum of all six armor items — `chest` and `head` are single slots each contested by multiple items, so only the best one per slot ever counts (`warden_plate` +5 chest, `scavenger_king_helm` +3 head, `rustbound_ring` +1 ring; `sewer_jacket`/`chargeplate_vest` and `scavenged_hood` are strictly worse alternatives for the same two slots, never additive with the item that wins that slot).
   - At armor 9 (or even the unconstrained 13), **every enemy attack in the game floors to 1 HP**, including the Brute's heavy attack — full itemization progression on this stat eliminates all differentiation between enemies for a maxed-armor character. This is a legitimate flat-mitigation-with-a-floor outcome (armor doing its job is supposed to feel like this), not obviously broken, but it does mean armor's ceiling is reached well before a player could plausibly max every slot.
   - **Sharper edge case: against `trashboar_skitter` specifically, armor has zero effect at any value, including zero armor** — its raw damage (1) already equals the floor unarmored, so `Math.max(1, 1 - armor)` is always exactly `1` regardless of how much armor the player has. This is the closest the current numbers come to the "armor moot even unstacked" failure mode this plan was asked to check for, but it is isolated to one enemy: `trashboar_runt`/`static_wretch` (raw 2) still show a real, visible reduction for a totally unarmored character down to 1-2 armor points before saturating, and `trashboar_brute` has genuine graduated range up to 2 armor (normal attack) or 5 armor (heavy attack).
   - **Decision: the formula is not changed.** Per this build's planning brief, this doesn't cross into "actually broken" — a lightly-armored character still sees real, graduated differentiation against 3 of 4 enemies, and the fourth (Skitter) dealing exactly floor-level damage is a content-tuning fact about a specific enemy's low damage value, not a flaw in the mitigation wiring itself. It is named here as an explicit, visible tradeoff for future combat-balance builds to weigh (e.g. raising enemy damage floors, lowering the mitigation floor below 1, or leaving it as-is), not something this wiring-focused build should silently paper over or unilaterally rebalance.

---

## Decision: Recommended Order

Start with **Wave 2 — Presence Wiring**, immediately followed by **Wave 3 — Mitigation at the Landing Sites** — wiring `armor` onto `PlayerPresence` without also changing the two landing call sites would leave the fix half-done, the same way 0.10's Waves 2/3 weren't meaningfully separable. Wave 4 (docs) follows once both landing sites are provably correct via the Wave 3 tests.

---

## Validation Expectations for 0.11 Tasks

```bash
pnpm -r typecheck
pnpm --filter @doomscrolls/server test
```

No live dev-server verification is expected to be required for this build, for the same reason as 0.10: no client/UI code is touched.

---

## Summary

Core Build 0.11 is **Combat Integrity, Part Two**. Its job is to fix the mirror image of 0.10's bug: incoming enemy damage is fully flat and never consults the player's `armor` stat, and unlike `damage` before 0.10, `armor` doesn't even have a field on the runtime `PlayerPresence` object to read from — despite being a real, computed, persisted stat that six already-shipped armor items modify. Death/respawn consequences and the orphaned `heavy_strike`/basic-attack-formula gap were both found and are both real, but were passed over: the former is open-ended design work with no existing formula to lean on (the same shape of scope this project has repeatedly declined for objectives/loadout), and the latter would mean redesigning the basic-attack formula itself, not wiring an existing stat. Armor mitigation, by contrast, is a direct, bounded mirror of a fix this project has now proven once already. As with 0.10, verification is expected to be fully in-process, and this build explicitly does not attempt to judge whether the resulting combat feel is good — only that the stat is now real.
