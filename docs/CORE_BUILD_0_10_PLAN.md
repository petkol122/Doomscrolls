# docs/CORE_BUILD_0_10_PLAN.md — Core Build 0.10 Plan

## Status

**Planning phase.** Core Build 0.9 shipped the second class (Ironclad) and the classId-aware skill-slot fix, and is now the stable baseline. Core Build 0.10 planning begins as the next scoped build, explicitly scoped to gameplay (0.8 already covered the testing-harness gap; this build is not infra/tooling).

No runtime code changes, gameplay implementation, schema changes, or UI implementation are part of this planning task.

---

## Core 0.10 Theme

**Combat Integrity — Wiring Weapon Damage Into Combat**

---

## Which Gap Matters More: The Case For Damage Wiring Over Loadout Choice

Three real candidates were on the table for 0.10, per the planning brief: a loadout/build-choice system (explicitly deferred by name in 0.9), the inert weapon-`damage`-stat gap (flagged as a known issue in 0.9's risk list, never fixed), and objectives/quest depth (declined twice, at 0.6 and again explicitly at 0.7). Here is the case for picking damage wiring, and the case against the others.

**Why not objectives/quest depth:** declined twice already (0.6, and again explicitly in 0.7's non-goals). Nothing about the current state of the game changes that calculus — this build doesn't reopen it.

**Why not a loadout/build-choice system, even though it's the more "structurally exciting" gap:** the practical blocker, confirmed by reading `packages/content/src/data/skills.ts`, is that **the entire game has exactly five skills**, and both existing classes already have their two slots (secondary/tertiary) filled with two of them each — there is no unassigned skill content left over to let a player choose *between*. A "loadout system" with nothing to select between is itself a fake feature. To make player choice mean anything, this build would first have to design, balance, and localize enough *new* skill content that a choice is real — folding a full itemization/content-design build's worth of scope (new skill numbers, new balance tuning, no crisp stopping point) into the same build as a new selection UI and a new slot-mapping data model. That combination is exactly the shape of open-ended, tuning-heavy, hard-to-bound scope this project has twice declined for objectives depth, for the same underlying reason: no clean Definition of Done. It remains a real gap and stays explicitly deferred (see Non-Goals) — but it is not this build's gap to close yet.

**Why not "just add more items" or a third zone:** more of either would repeat 0.9's own rejected pattern (world variety is proven-safe repetition, not a new kind of decision) — and, worse, more items would mean *shipping still more damage-modifying gear* on top of a stat that provably does nothing today. That would be irresponsible before the existing broken instances are fixed.

**Why damage wiring wins — it is not merely "cheap," it is an existing broken promise:** `AGENTS.md`'s Core Rule states plainly: *"Placeholder mechanics are not [allowed]."* Weapon damage modifiers are exactly that today, and this is not hypothetical — it is already shipped, reachable content:

- `starter_pipe` (a common-tier weapon, `allowedEquipmentSlots: ["weapon"]`) carries `statModifiers: [{ target: "damage", operation: "add", value: 3 }]`.
- `condemned_cleaver` and `livewire_lance` (epic-tier weapons from 0.7) both carry `damage` modifiers and drop from both zones' loot tables at meaningful weights (0.4–0.6).
- All three are equippable today, and equipping any of them changes **nothing** about actual combat output. A player who reads an item tooltip promising more damage, equips it, and fights the exact same fight, is looking at a fake feature with real data flow and real persistence but no real server logic — precisely the failure mode the Core Rule is written to prevent.

This is also a **well-bounded** fix, not a balance-formula redesign, because the pieces already exist and there's already a working precedent for exactly this kind of wiring:

- `CharacterStatsService.calculateDerivedStats` already computes `damage = 1 + power`, and `calculateEquippedStats`/`applyDerivedModifiers` already fold item `damage` modifiers into it. This recalculation already runs today, at every equip/unequip/level-up, in all three rooms — the number is already computed and even **persisted to the database** (`updateProgressionState`'s `stats: {...recalculated.derived}` includes `damage`).
- The only thing missing is the last step: writing that already-computed number onto `PlayerPresence` and reading it at the two real-time combat call sites. Compare this to the *other* two frequently-modified derived stats, `attackCooldownMs` and `movementSpeed` — both already flow all the way from character stats onto `PlayerPresence` and are consumed by real combat/movement logic. `damage` is the one derived stat that stops one step short of the finish line. This build finishes that one step.
- The 0.8 test fixture `TEST_CHARACTER_STATS.derived.damage = 12` (`apps/server/test/support/fixtures.ts`) already exists and is presently unusable for any combat-damage assertion, because no combat path reads `derived.damage`. Wiring this in gives the existing harness a value it has been carrying, unused, since before this plan was written.

---

## Build Framing — Current Combat-Damage State (audited 2026-09-01)

This is what actually exists in the codebase today, not aspirational:

- **Basic attacks always deal exactly `1` damage, hardcoded at three call sites**: `CombatRoom.ts:634`, `TownRoom.ts:1882`, `deferredActionExecution.ts:246` all call `applyEnemyDamage(enemy, 1)` — the literal `1`, not any character stat.
- **Skill casts always deal exactly the skill's own flat `baseDamage`, at three call sites**: `CombatRoom.ts:799`, `TownRoom.ts:2679`, `deferredActionExecution.ts:343` all call `applyEnemyDamage(enemy, skillDefinition.damage)` — `skillDefinition.damage` comes straight from `skillSlotContent.ts`'s `resolveSkillSlotDefinition`, itself just `skill.baseDamage` from content. No player stat is consulted at all for skills, not even indirectly.
- **`derived.damage` is fully computed, including equipment, but never read back.** `CharacterStatsService.calculateDerivedStats` computes `damage: 1 + primary.power`; `calculateEquippedStats` → `applyDerivedModifiers` folds any `{ target: "damage" }` item stat modifier on top. This recalculation already executes today in all three rooms' progression-update helpers (on level-up and whenever equipment changes), and the result is persisted to the database. It is simply never written onto `PlayerPresence` or consulted by `applyEnemyDamage`.
- **`PlayerPresence` has no `damage` field at all.** Contrast with `attackCooldownMs` and `movementSpeed`, both derived stats that already are schema fields on `PlayerPresence`, already populated at join (`buildPlayerPresence.ts`/`buildCombatPlayerPresence.ts`) and at recalculation, and already consumed by real logic (`consumeAttackCooldown`, movement stepping). `damage` is the odd one out.
- **Three already-shipped, already-reachable items carry inert `damage` modifiers**: `starter_pipe` (weapon, common, `+3`), `condemned_cleaver` and `livewire_lance` (weapons, epic, both from 0.7, dropped in both zones' loot tables). Equipping any of them today changes nothing about actual fights.
- **Enemy HP was presumably tuned against the old flat-damage assumption.** Current enemy `maxHp` values are small (`trashboar_skitter` 8, `static_wretch` 10, `trashboar_runt` 12, `trashboar_brute` 30). Real per-character damage (the existing fixture models a level-3 character at `derived.damage: 12`) could drop several existing enemies in a single or near-single basic attack once wired in — a legitimate feel/pacing question this build must actively check, not just a correctness question (see Risks).
- **Zero unit tests exist for `CharacterStatsService`** today (confirmed by search) — this build is a chance to add its first, directly proving the equipment-modifier fold works, independent of any room.

Core 0.10 should answer:

> Weapon damage stat modifiers have existed since Core 0.1 (`starter_pipe`) and were extended in 0.7 (`condemned_cleaver`, `livewire_lance`), but have never once affected a real fight. What does it take to make the number on the item tooltip be the number that actually lands, for both basic attacks and skills, without opening a full combat-balance rewrite?

---

## Major Feature Pillars

### 1. Thread `derived.damage` onto `PlayerPresence`

**Goal:** Make the already-computed, already-persisted `derived.damage` value actually reach the presence object every other combat/movement stat already reaches.

Candidate scope:

- Add `@type("number") public damage: number` to `PlayerPresence.ts`, as a new constructor parameter — same pattern as `attackCooldownMs`/`movementSpeed`.
- Populate it at join time in both `buildPlayerPresence.ts` (`TownRoom`) and `buildCombatPlayerPresence.ts` (`CombatRoom`), from the joined character's persisted `derived.damage` — the same source `maxHp`/`attackCooldownMs` are already read from, so no new query is required.
- Populate it at recalculation time in all three rooms' existing progression-update helper (`CombatRoom.ts`, `TownRoom.ts`, `deferredActionExecution.ts` all already compute `recalculated.derived.damage` today for persistence purposes) — add one line writing `player.damage = recalculated.derived.damage` alongside the existing `player.maxHp` update. No new recalculation trigger is needed; the trigger (equip/unequip/level-up) already exists and already runs this exact computation.

Guardrails:

- All three rooms' recalculation call sites must be updated together — a partial fix would leave one room silently serving stale `player.damage` after an equip change in another room's data path, echoing 0.9's `classKey` risk. Mitigated the same way 0.9 mitigated it: per-room integration tests (see Verification Strategy), not inspection alone.

### 2. Make combat resolution consume `player.damage` instead of hardcoded numbers

**Goal:** Replace the flat literals at all six `applyEnemyDamage` call sites with real, character-derived numbers.

Candidate scope:

- **Basic attack** (`CombatRoom.ts:634`, `TownRoom.ts:1882`, `deferredActionExecution.ts:246`): replace `applyEnemyDamage(enemy, 1)` with `applyEnemyDamage(enemy, player.damage)`.
- **Skill cast** (`CombatRoom.ts:799`, `TownRoom.ts:2679`, `deferredActionExecution.ts:343`): this is the one real design decision in this build. `calculateDerivedStats` already treats `1` as the universal per-hit floor baked into `damage = 1 + power`; everything above that floor is the power-stat/equipment contribution. Recommended formula: `damageBonus = player.damage - 1` (zero for an unequipped, zero-power character; grows with power stat and equipped `damage` modifiers), then skill damage becomes `skillDefinition.damage + damageBonus`. This keeps each skill's own numbers as the dominant, distinguishing factor between skills (Shatter Blow still hits harder than Grave Spark, per 0.9's explicit "mechanically distinct" bar) while making power/gear investment matter uniformly for both basic attacks and skills — closing the gap without opening a combat-formula rebalance.
  - **This formula is flagged explicitly for review/approval before implementation** — it is the one number-shaped judgment call in this plan; an alternative (e.g. a multiplier instead of an additive bonus) is a reasonable substitute if preferred, but changes numbers ​differently across levels and is not proposed here as the default.

Guardrails:

- No change to any skill's own `baseDamage` content values — only the bonus layered on top changes.
- No change to `applyEnemyDamage`'s own signature or defeat/respawn logic — it already accepts an arbitrary `requestedDamage` number; this build only changes what gets passed in.

### 3. Verification: first-ever `CharacterStatsService` unit coverage + per-room integration proof

**Goal:** Prove both that the equipment fold is computed correctly in isolation, and that real combat now actually uses it — the same two-layer pattern 0.9 used for classId-aware skill resolution.

Candidate scope:

- New unit test (no room needed) directly against `CharacterStatsService.calculateEquippedStats`, asserting a `damage` stat modifier changes `derived.damage` by exactly the modifier's value — the first test this service has ever had.
- Extend `apps/server/test/combat/skillSlotCasting.test.ts` (or a sibling file) and add a `TownRoom` equivalent: a joined player's basic attack lands for `TEST_CHARACTER_STATS.derived.damage` (12), not the old hardcoded `1`; a skill cast lands for the skill's `baseDamage` plus the fixture's damage bonus, per the formula in Pillar 2.
- Regression-check discipline per 0.9's established practice: temporarily revert each fix, confirm the new assertions fail with the exact old/new number mismatch, then restore and re-verify green.

---

## Verification Strategy (in-process only — no live server needed this build)

Every piece of combat-damage logic in this build gets a vitest case in `apps/server/test/`, per `AGENTS.md`'s "Verification Must Be Permanent" rule. Unlike 0.9 (which needed one live browser check for its class-picker UI), **this build touches no client/UI code at all** — it is pure server-side combat math and schema wiring, so it is expected to be fully verifiable in-process, with no live dev-server step required. This should be called out explicitly as a nice property of this build's scope, and revisited only if implementation surfaces something genuinely untestable in-process.

Planned test additions:

- **Unit-level, no room needed:** a new `apps/server/test/character/characterStatsService.test.ts` (first-ever coverage for this service) proving `calculateEquippedStats` folds a `damage` modifier correctly.
- **Integration-level, both rooms:** extend `apps/server/test/combat/skillSlotCasting.test.ts` and add a `TownRoom` regression test proving a joined character's actual `derived.damage` — not a hardcoded literal — determines both basic-attack and skill-cast damage against a real enemy.
- **Content/typecheck:** `pnpm --filter @doomscrolls/server typecheck` and `pnpm --filter @doomscrolls/server test`.

---

## Core 0.10 Non-Goals

```text
a loadout/build-choice system — still deferred; there is no spare skill content to choose between yet (see the case above)
new skill content, new classes, new origins, or a third combat zone
rebalancing any skill's existing baseDamage numbers
an armor/mitigation formula (armor stays 0/unused, out of scope)
new items, new equipment slots, or new statModifier targets
PvP or any player-vs-player damage path
objectives/quest depth (declined at 0.6, declined again at 0.7 — no new information changes that here)
a full combat-balance pass — the bar is "weapon/power stats have a real, correct effect," not "the game is tuned"
```

---

## 0.9 Freeze / Stability Baseline

Core Build 0.9 should now be treated as the stable shipped baseline. That means:

- 0.9's full server test suite is the required regression baseline this build must not break, and its harness (`apps/server/test/`) is the required verification path — no throwaway scripted-client verification.
- Both classes' existing skill numbers, and the classId-aware skill-slot resolution fix, must not regress.
- Any bug fix needed along the way must be minimal and regression-focused.

---

## Candidate Task Waves

### Wave 1 — Planning

- Finalize 0.10 scope documents (this plan + checklist)
- Reconfirm the 0.9 class-variety baseline + full server test suite as what 0.10 must not break

### Wave 2 — Presence Wiring (priority)

- Add `damage: number` to `PlayerPresence`, both presence-builder input interfaces, and both `onJoin` call sites
- Add `player.damage = recalculated.derived.damage` to all three rooms' progression-recalculation helpers
- Add the `CharacterStatsService` unit test

### Wave 3 — Combat Resolution (priority, the real fix)

- Replace the three hardcoded `applyEnemyDamage(enemy, 1)` basic-attack call sites with `applyEnemyDamage(enemy, player.damage)`
- Implement the agreed skill-damage formula (Pillar 2) at the three skill-cast call sites
- Add/extend the per-room integration tests proving both basic-attack and skill-cast damage now reflect the joined character's real stats
- `pnpm --filter @doomscrolls/server typecheck` and `pnpm --filter @doomscrolls/server test` both pass
- Regression-check discipline: revert, confirm the new tests fail with the expected old/new number mismatch, restore, re-verify green

### Wave 4 — Feel Pass (bounded, not a balance rewrite)

- With real damage numbers now live, do a short subjective playtest pass against existing enemy HP values (8–30 across the four enemy types) to check for an obviously broken pace (e.g. every enemy dying in a single hit for every character). This is a feel check, not a correctness question — the tests already prove the numbers apply correctly.
- If something reads as clearly broken (not just "could be tighter"), the only sanctioned response in this build is a small, explicitly-labeled numeric adjustment (e.g. enemy HP) — not a new combat formula. If nothing reads as broken, this wave produces no changes and that should be stated plainly.

### Wave 5 — Docs and Polish

- `docs/CORE_BUILD_0_10_RELEASE_NOTES.md`
- Full `pnpm -r typecheck` and `pnpm --filter @doomscrolls/server test`

---

## Risks

1. **The skill-damage formula is a genuine design judgment call**, not a mechanical fix like Pillar 1 — flagged explicitly above for approval before implementation. Low risk of it being *wrong*, since it's additive and reversible, but it is the one place this plan is making a call rather than just wiring existing numbers through.
2. **All three rooms' recalculation call sites must be updated together**, or one room could silently serve a stale `player.damage` after an equip change made through a different room's data path. Same shape of risk as 0.9's `classKey` threading; same mitigation — per-room integration tests, not inspection alone.
3. **Real per-character damage will likely make existing fights noticeably faster**, since enemy HP (8–30) was presumably tuned against the old always-`1` basic-attack assumption and skills that never scaled. A level-3 test character's `derived.damage` of 12 could one-shot the two lowest-HP enemies. This is an intended consequence of fixing the bug, not a bug itself, but it is a real feel change worth a deliberate look (Wave 4), not a silent side effect discovered later.
4. **Content/localization scaling is not a risk this time** — this build adds zero new classes, skills, or items, so no new localization keys are required. Called out only because every prior build's risk list has carried this; it's worth noting explicitly when it *doesn't* apply.

---

## Decision: Recommended Order

Start with **Wave 2 — Presence Wiring**, immediately followed by **Wave 3 — Combat Resolution** in the same pass — wiring `damage` onto `PlayerPresence` without also changing the `applyEnemyDamage` call sites would leave the fix half-done (the number would exist but still not be consulted), so these two waves are not meaningfully separable in practice, the same way 0.9's Waves 2/3 weren't. Wave 4 (feel pass) follows once the server-side numbers are provably correct via the Wave 3 tests, and only produces changes if something reads as clearly broken.

---

## Validation Expectations for 0.10 Tasks

```bash
pnpm -r typecheck
pnpm --filter @doomscrolls/server test
```

No live dev-server verification is expected to be required for this build (see Verification Strategy) — this should be revisited only if implementation surfaces something genuinely untestable in-process.

---

## Summary

Core Build 0.10 is the **Combat Integrity** build. Its job is to fix a real, already-shipped fake feature — weapon `damage` stat modifiers (`starter_pipe` since 0.1, `condemned_cleaver`/`livewire_lance` since 0.7) that are computed, persisted, and equippable, but have never once affected an actual fight, because `PlayerPresence` never gained a `damage` field and every damage call site uses a hardcoded literal instead. A loadout/build-choice system was considered and explicitly passed over: it is the more structurally novel gap, but the game currently has zero spare skill content to let players choose between, so building it now would mean designing a full new content pillar under the same open-ended-scope pressure this project has twice declined for objectives depth. Damage wiring, by contrast, has an exact existing precedent (`attackCooldownMs`/`movementSpeed` already flow this way) and a crisp Definition of Done. Verification is expected to be fully in-process, with no live-server step required — a first for this series of builds.
