# docs/CORE_BUILD_0_9_PLAN.md — Core Build 0.9 Plan

## Status

**Planning phase.** Core Build 0.8 shipped the persistent vitest + `@colyseus/testing` regression harness (`apps/server/test/`) in place of a manual Wave 5 live-verification audit, and is now the stable baseline. Core Build 0.9 planning begins as the next scoped build.

No runtime code changes, gameplay implementation, schema changes, or UI implementation are part of this planning task.

---

## Core 0.9 Theme

**Build Variety — the Second Class**

---

## Which Gap Matters More: The Case For Class Variety Over World Variety

Two real gaps exist today: exactly one playable class (Gravewalker, 2 active skills) and exactly two combat zones (Blackwire Sewers, Static Yard). Both have been true since early builds and both are legitimate. This build picks class variety. Here is the case, and the case against the alternatives.

**Why not a third zone (world variety):** Zone #3 would be the third repetition of a now fully-proven, copy-paste pattern — `zones.ts` entry, `spawnZones.ts` rows, at most one new enemy variant, reuse of `CombatRoom`'s existing spawn/loot/skill machinery unchanged. It is cheap and safe, but it adds *more of the same loop*, not a *new kind* of decision for the player. An ARPG's core replay hook is build identity — "what am I playing," not "where am I standing" — and right now every player's answer to the first question is identical: Gravewalker, Grave Spark, Bone Splinter. A third zone doesn't touch that. It was also the sequence-default choice (0.6 added zone #2; zone #3 would just be "next"), which is exactly the trap this planning prompt asked not to fall into.

**Why not more itemization:** 0.7 just closed the itemization gap (epic tier, 6 items). Doing another itemization pass back-to-back would be sequence-default in the other direction, and the audit below shows class variety is the thinner, longer-standing gap (see next section) — origin/class content has been explicitly out of scope since Core 0.1 and was explicitly declined again in 0.7's non-goals.

**Why not "just backfill test debt":** 0.8 already delivered the harness; using 0.9 to backfill coverage for existing untested `TownRoom` paths (vendor, stash, waypoints, notice-board turn-in) would be a second consecutive infra build with no player-facing output. That work is real and worth doing, but it doesn't need to consume a whole build — it fits as a small, explicitly optional wave inside a feature build instead (see Wave 5).

**Why class variety wins:** it is the single largest structural thinness in the game (1 class, 2 skills, since Core 0.1), it was explicitly deferred by name in 0.7's non-goals ("no new class/origin content"), and — per the audit below — the content layer (`CharacterStatsService`, `ContentValidation.ts`) is *already fully class-generic*. The only genuinely single-class-hardcoded logic in the entire codebase is one function (`resolveSkillSlotDefinition`) and one client form. That makes this a well-bounded build, not a build-a-new-subsystem build.

---

## Build Framing — Current Class/Skill State (audited 2026-09-01)

This is what actually exists in the codebase today, not aspirational:

- **Exactly one origin and one class exist.** `packages/content/src/data/origins.ts`: `sewer_dweller` (baseStats `power:1, speed:2, mind:1, toughness:2`, `allowedClassIds: ["gravewalker"]`). `packages/content/src/data/classes.ts`: `gravewalker` (baseStats `power:3, speed:1, mind:2, toughness:3`, `secondarySkillId: "grave_spark"`, `tertiarySkillId: "bone_splinter"`).
- **`allowedClassIds` is already an array** — the content model was built to support more than one class per origin from the start; it has just never been exercised with a second value.
- **`CharacterStatsService` is already fully class-generic.** `calculateStartingStats`/`calculateLevelScaledStats` take `originStats`/`classStats` as plain parameters and sum them; nothing in this service references `"gravewalker"` or any class id. A second class needs zero changes here.
- **`ContentValidation.ts` already validates class content generically** — it loops over `registry.classes` checking `secondarySkillId`/`tertiarySkillId` resolve to real skills, with no hardcoded class-count assumption.
- **`skillSlotContent.ts` is the one real hardcoded gap.** `resolveSkillSlotDefinition(slot)` takes no character/class argument at all — it always resolves through a module constant, `const DEFAULT_CLASS_ID = "gravewalker"`. The function's own comment says why: *"Core 0.1 has exactly one playable class, so the slot -> skill mapping does not vary per player yet."* The instant a second class exists, every player of that class would still be cast as Gravewalker's skills (Grave Spark / Bone Splinter) through this lookup — a guaranteed, predictable bug, not a hypothetical one. Both call sites (`CombatRoom.ts`'s and `TownRoom.ts`'s `registerSkillSlotHandler`, plus `deferredActionExecution.ts`'s deferred-cast path) call it exactly the same way, so all three need the same fix.
- **`PlayerPresence` does not carry the player's class at all.** There is no `classKey` field on the schema, and neither `buildPlayerPresence.ts` (`TownRoom`) nor `buildCombatPlayerPresence.ts` (`CombatRoom`) is given one to store. Making skill resolution classId-aware requires adding this field and threading it through both builders — this is the concrete implementation shape of "fix `resolveSkillSlotDefinition`," not a separate task.
- **The client character-creation form hardcodes both choices, not just class.** `characterCreateFormView.ts` renders `origin` and `characterClass` through `createFixedOptionSelect()`, a DOM helper (`accountShellDom.ts`) that literally only supports rendering **one** fixed `<option>` — there is no picker UI at all today, for either field. `AccountShellScene.ts` already reads `elements.characterClass.value` generically when submitting `POST /characters`, so the server-side path needs no change here; only the form needs a real multi-option control for the class field.
- **Items are class-agnostic already.** Equipment slots are chosen by `EquipmentSlot`/`ItemCategory`, never by class. A second class needs no new items to be fully equippable with everything that exists today.

Core 0.9 should answer:

> The game has had "one class" as an explicit non-goal since Core 0.1, and declined again by name in 0.7. What does the game look like once that's no longer true — and what was actually hiding behind "we'll deal with that when there's a second class"?

---

## Major Feature Pillars

### 1. The Second Class — Content

**Goal:** Add one new class, mechanically and thematically distinct from Gravewalker, reusing the existing `sewer_dweller` origin (no second origin — see Non-Goals).

Proposed class: **`ironclad`** — a close-range physical bruiser, contrasting Gravewalker's longer-range caster-ish lean.

| | Gravewalker (existing) | Ironclad (new) |
|---|---|---|
| `baseStats` | power 3, speed 1, mind 2, toughness 3 | power 4, speed 0, mind 0, toughness 5 |
| Resulting lean (origin + class) | balanced, mind/toughness lean | tanky, power/toughness lean, slower |
| secondary skill | Grave Spark: range 96, dmg 3, cd 1500ms | **Shatter Blow**: range 64 (melee), dmg 6, cd 1300ms |
| tertiary skill | Bone Splinter: range 140, dmg 5, cd 2600ms | **Groundbreaker**: range 80, dmg 10, cd 3200ms |

This is a genuine playstyle contrast (long-range poke vs. close-range high-commitment burst), not the same numbers with new names — the explicit bar `AGENTS.md` sets for "real" content (compare: 0.7's item pillar required every new item's `statModifiers` combination to be distinct from every existing item; the equivalent bar here is that the new class's stat lean and skill shape must be distinct from Gravewalker's, not just relabeled).

Candidate scope:

- Add `ironclad` to `packages/content/src/data/classes.ts` (`startingSkillId` can reuse `heavy_strike` — per the 0.7 audit this field is validated for existence only and never read by damage calculation, same as Gravewalker's).
- Add `ironclad` to `sewer_dweller.allowedClassIds` in `origins.ts`.
- Add `shatter_blow` and `groundbreaker` to `packages/content/src/data/skills.ts`.
- Add all required localization keys (`class.ironclad.name`/`.description`, `skill.shatter_blow.name`/`.description`, `skill.groundbreaker.name`/`.description`) to `en.ts` and `LocaleTypes.ts`.

Guardrails:

- Reuse the exact `CharacterClassContentDefinition`/`SkillContentDefinition` shapes — no new fields, no new `targeting` mode (stays `"target"`).
- No changes to Gravewalker's existing numbers.
- No starting equipment or currency is granted to any class today — `CharacterService.createCharacter` initializes an empty inventory grid and `moneyCopper` defaults to `0` for every character, Gravewalker included. Ironclad follows this same empty-start flow unchanged; this build adds no starting-gear system for either class.

### 2. Class-Aware Skill Resolution (the real fix)

**Goal:** Make `resolveSkillSlotDefinition` resolve the *joined character's actual class*, not a hardcoded constant. Without this, Pillar 1 ships a class whose players silently get the wrong skills — the exact "fake feature" shape `AGENTS.md`'s Core Rule forbids.

Candidate scope:

1. Add `classKey: CharacterClassKey` to `PlayerPresence` (schema field, alongside the existing `characterId`/`level`/`xp` identity fields).
2. Add `classKey` to both `BuildTownPlayerPresenceInput` and `BuildCombatPlayerPresenceInput`, populate it from `result.character.classKey` in both `TownRoom.onJoin` and `CombatRoom.onJoin` (the character's classKey is already present on `CharacterDetails` — no new persistence or query needed).
3. Change `resolveSkillSlotDefinition(slot: SkillSlotId)` to `resolveSkillSlotDefinition(slot: SkillSlotId, classKey: CharacterClassKey)`, drop `DEFAULT_CLASS_ID`, and update its three call sites (`CombatRoom.ts`, `TownRoom.ts`, `deferredActionExecution.ts`) to pass `player.classKey`.

Guardrails:

- All three call sites must be updated in the same change — a partial fix (e.g. `CombatRoom` fixed, `TownRoom` or the deferred-cast path left on the old signature) would not compile (signature change is a hard TypeScript error, not a silent gap), which is itself a nice property: this refactor cannot ship half-done the way the 0.7 skill-slot-handler gap could.
- No loadout/selection system — a class's slot mapping is still fixed, exactly as Gravewalker's is today. Two classes, not player-chosen builds within a class (see Non-Goals).

### 3. Client Class Picker

**Goal:** Make the second class actually reachable at character creation — a class nobody can select is not a real feature.

Candidate scope:

- Add a small `createOptionSelect(labelText, id, options: readonly {value, label}[])` helper to `accountShellDom.ts` (or extend `createFixedOptionSelect` to accept an array — implementation detail to decide during the task, not here).
- `characterCreateFormView.ts`: render the class field with both `gravewalker` and `ironclad` as real, selectable options with localized labels. Leave the origin field as a single fixed option (see Non-Goals — no second origin this build).
- No change needed in `AccountShellScene.ts`'s submit handler — it already reads `elements.characterClass.value` generically.

Guardrails:

- Minimal control (native `<select>` with two real `<option>`s is sufficient) — no class-preview panel, no stat comparison UI, no portrait/art.
- This is the one piece of this build that needs a live dev-server check (see Verification Strategy) — DOM rendering and option selection are exactly the "client rendering, browser behavior" carve-out, not something the vitest harness can exercise.

---

## Verification Strategy (in-process first, per this build's efficiency constraint)

Every piece of room/matchmaking/skill-resolution logic in this build gets a vitest case in `apps/server/test/`. A live dev server is used **only** for the one piece that genuinely cannot be tested in-process: confirming the class `<select>` renders both options and submits the chosen value in a real browser.

Planned test additions (extending the existing `apps/server/test/` suite from 0.8, not a new harness):

- **Unit-level, no room needed:** a new `apps/server/test/content/skillSlotClassResolution.test.ts` (or colocated with existing combat tests) asserting `resolveSkillSlotDefinition("secondary", "gravewalker")` returns Grave Spark's numbers and `resolveSkillSlotDefinition("secondary", "ironclad")` returns Shatter Blow's — the fast, direct proof that the classId parameter is actually consulted, not just accepted and ignored.
- **Integration-level, both rooms:** extend `apps/server/test/support/fixtures.ts` with an Ironclad character fixture, then add a case per room proving the *joined* character's class — not a hardcoded default — determines which skill actually lands:
  - `apps/server/test/combat/skillSlotCasting.test.ts` (existing file): add a case joining as Ironclad and casting `secondary`, asserting the accepted message carries Shatter Blow's damage (6), not Grave Spark's (3).
  - **New:** a first `apps/server/test/town/` regression test doing the equivalent for `TownRoom`'s skill-slot handler — this is TownRoom's first vitest coverage of any kind, closing a small piece of the coverage gap 0.8 left behind, as a direct side effect of fixing this bug correctly (not a separate backfill effort).
- **Content validation:** `pnpm --filter @doomscrolls/content typecheck` plus a run of the server's existing content-registry validation-on-startup path (already exercised whenever the server boots or the harness boots a room) confirms the new class/skill content resolves cleanly.

This directly replaces what 0.7 did with a scripted Colyseus client that was written and discarded — the equivalent checks here become permanent, per `AGENTS.md`'s new "Verification Must Be Permanent" rule (added in 0.8).

---

## Core 0.9 Non-Goals

```text
a second origin (Ironclad ships under the existing sewer_dweller origin only)
a third combat zone or any new world/region content
player-chosen skills within a class (loadout/talent selection) — class -> slot mapping stays fixed, same as today
character respec or class-change after creation
rebalancing Gravewalker's existing stats or skill numbers
new items, new equipment slots, or class-restricted equipment
new AI states or enemy behavior
a full backfill of TownRoom's existing test-coverage gap (vendor, stash, waypoints, notice board) — Wave 5 below takes one small, explicit down payment on this, not the whole debt
competitive balance between the two classes — the bar is "functionally real and mechanically distinct," not tournament-tuned
```

---

## 0.8 Freeze / Stability Baseline

Core Build 0.8 should now be treated as the stable shipped baseline. That means:

- 0.8's harness (`apps/server/test/`) is the required verification path for this build's server-side work — no new throwaway scripted-client verification.
- The full 0.7 gameplay loop (Nightmarket → combat zone → loot/XP/objectives → return) must not regress.
- Any 0.8 bug fix must be minimal and regression-focused.

---

## Candidate Task Waves

### Wave 1 — Planning

- Finalize 0.9 scope documents (this plan + checklist)
- Reconfirm the 0.7 loop + 0.8 harness as the stable baseline 0.9 must not break

### Wave 2 — Class Content (priority)

- Widen `CharacterClassKey` in `packages/shared/src/character/CharacterTypes.ts` from `"gravewalker"` to `"gravewalker" | "ironclad"` — required before `classes.ts` can declare an `ironclad` entry typed against it (same shape of change as 0.7 widening `ItemRarity`)
- Add `ironclad` to `classes.ts`, add it to `sewer_dweller.allowedClassIds` in `origins.ts`
- Add `shatter_blow` and `groundbreaker` to `skills.ts`
- Add all required localization keys to `en.ts` / `LocaleTypes.ts`
- `pnpm --filter @doomscrolls/content typecheck` passes; content-registry validation succeeds

### Wave 3 — Class-Aware Skill Resolution (priority, the real fix)

- Add `classKey` to `PlayerPresence`, both presence-builder input interfaces, and both `onJoin` call sites
- Change `resolveSkillSlotDefinition`'s signature to take `classKey`; update all three call sites
- Add the unit-level and both room-level regression tests described in Verification Strategy
- `pnpm --filter @doomscrolls/server typecheck` and `pnpm --filter @doomscrolls/server test` both pass

### Wave 4 — Client Class Picker

- Add a real multi-option select control (new/extended DOM helper)
- Wire `ironclad` as a second selectable class in `characterCreateFormView.ts`
- Live dev-server check: create a character as each class, confirm the correct classKey is persisted and the correct skills are castable in a real combat zone

### Wave 5 — Optional, cut first: one test-debt down payment

- Add one targeted vitest regression test for an existing untested `TownRoom` money-mutating path (vendor buy or sell) — not a full backfill, one concrete case
- If cut: no debt is created by cutting this — it was already-existing, pre-0.9 debt, so cutting it just leaves it exactly where 0.8 left it, and that should be stated plainly rather than implied

### Wave 6 — Docs and Polish

- Update `AGENTS.md`'s stale "Core 0.1 Game Scope" section (see below) so it no longer claims "multiple origins/classes" is excluded
- `docs/CORE_BUILD_0_9_RELEASE_NOTES.md`
- Full `pnpm -r typecheck` and `pnpm --filter @doomscrolls/server test`

---

## Flagged for Trimming: AGENTS.md

`AGENTS.md` is 249 lines today — not yet unwieldy, but it is read at the start of every session, so its size is a recurring cost, and one section has gone stale in a way this exact build will make concretely wrong:

- The **"Core 0.1 Game Scope"** section (~52 lines) is a snapshot of Core 0.1-era decisions. Several "Excluded until later" items are already outdated in spirit (the game has long since shipped things not on the "Included" list, like the epic rarity tier or a second combat zone) but the section has never been revised. Its "multiple origins/classes" exclusion is about to become **factually false** the moment 0.9 ships a second class.
- Recommendation: either delete this section (the equivalent history already lives in `docs/BACKLOG_CORE_0_1.md` and each build's release notes, which are the more appropriate home for point-in-time scope snapshots) or rewrite it as a current, actively-maintained scope summary instead of a frozen 0.1 artifact. This is a Wave 6 docs task, not a separate build.
- Everything else in the file (Core Rule, Non-Negotiables, GitHub Workflow, Definition of Done, Verification Must Be Permanent) is a durable rule, not a point-in-time snapshot, and does not need trimming.

---

## Risks

1. **The classId-aware fix is a hard compile-time dependency across three call sites**, which is a mitigation more than a risk (a partial fix cannot silently ship — TypeScript will refuse to compile `resolveSkillSlotDefinition(slot)` once the signature requires `classKey`), but the three sites (`CombatRoom.ts`, `TownRoom.ts`, `deferredActionExecution.ts`) must all be found and updated in the same pass; missing one is a typecheck failure, not a runtime surprise, so the actual risk is low.
2. **`PlayerPresence` schema field additions must land in both room builders identically** (`buildPlayerPresence.ts` and `buildCombatPlayerPresence.ts`), or one room would silently leave `classKey` at its schema default (likely resolving to whichever class id happens to be first, effectively reintroducing a narrower version of today's bug in one room only). Mitigate with the per-room integration tests in Wave 3, not just the unit test.
3. **Ironclad's numbers might feel unbalanced or its melee-range skills might feel bad against ranged/aggro enemy AI** that wasn't tuned with a close-range caster class in mind. This is a feel question, not a correctness question — the server-side tests prove the numbers apply correctly; only a live playtest can judge feel. Explicitly out of scope to chase "balanced" (see Non-Goals) — the bar is "distinct and functional."
4. **The client class-picker is the one real live-verification dependency this build has**, and no browser-automation tooling has been available in this environment in prior builds (per 0.7/0.8 notes). If that remains true, Wave 4's live check may again have to be a manual/described verification rather than an automated one — call this out explicitly in the checklist rather than silently downgrading it to "verified by code inspection" the way 0.7 had to for some of its client work.
5. **Content/localization scaling (recurring risk, same as every prior build's plan).** One new class, two new skills = at minimum 6 new localization keys (class name/description, 2x skill name/description) that must be present in both `en.ts` and `LocaleTypes.ts` or `validateContentRegistry` fails fast at content-load time.
6. **Weapon `damage` stat modifiers are currently inert for every class, not just Ironclad.** Every damage-dealing call site (`applyEnemyDamage`) is hardcoded/content-flat: basic attack always passes the literal `1`, and skills pass `skillDefinition.damage` (the skill's flat `baseDamage`), across all three call sites (`CombatRoom.ts`, `TownRoom.ts`, `deferredActionExecution.ts`). `derived.damage` — the stat `condemned_cleaver`/`livewire_lance` modify — is computed and persisted but never read by combat resolution. This is a known, pre-existing, class-agnostic gap, more visible on a melee-flavored class where weapon choice reads like it should matter. It is explicitly **not** in 0.9's scope — fixing it is a combat-formula/balance change that deserves its own build-sized decision, not a rider on this one.

---

## Decision: Recommended Order

Start with **Wave 2 — Class Content**, immediately followed by **Wave 3 — Class-Aware Skill Resolution** in the same pass — shipping the class content without the resolution fix would ship the exact bug this plan's audit found, so these two waves are not meaningfully separable in practice even though they're listed separately for clarity. Wave 4 (client picker) follows once the server-side class is provably correct via the Wave 3 tests. Wave 5 (test-debt down payment) is attempted only if Waves 2-4 land with scope to spare, and is the first and only thing to cut if not — cutting it costs nothing beyond leaving pre-existing debt exactly where it already was.

---

## Validation Expectations for Future 0.9 Tasks

```bash
pnpm -r typecheck
pnpm --filter @doomscrolls/server test
```

This supersedes 0.7's plan, which noted only `pnpm typecheck` was exercised per-task because no test runner existed yet. It now does (0.8's harness) — every 0.9 task touching room/combat/matchmaking logic must extend `apps/server/test/`, per `AGENTS.md`'s "Verification Must Be Permanent" rule, not fall back to a throwaway scripted client.

Manual/live validation should be limited to:

- the Wave 4 class-picker UI (the one piece that is not testable in-process), and
- a short subjective feel pass on Ironclad's two new skills in both combat zones (not correctness — that's server-tested).

---

## Summary

Core Build 0.9 is the **Build Variety** build. Its job is to ship the second class the game has deferred by name since Core 0.1 (and declined again explicitly in 0.7) — and, in doing so, to fix the one real hardcoded single-class assumption the audit found (`resolveSkillSlotDefinition`'s `DEFAULT_CLASS_ID`), which would otherwise have silently broken the new class's skills. A third combat zone was considered and explicitly passed over: it is cheaper but repeats an already-proven pattern, while class variety is the thinner, longer-deferred gap and is now well-bounded because the stats/validation layers turned out to already be class-generic. Verification for all server-side work runs through the 0.8 harness, not a live scripted client; only the new class-picker UI needs a real browser check.
