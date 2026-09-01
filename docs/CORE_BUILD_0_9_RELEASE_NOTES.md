# docs/CORE_BUILD_0_9_RELEASE_NOTES.md — Core Build 0.9 Release Notes

---

## Task 363 — Ironclad: The Second Class

**Date:** 2026-09-01
**Build:** Core Build 0.9
**Status:** Waves 1-4 and 6 implemented and verified in one pass. Wave 5 (optional test-debt down payment) was deliberately cut — see below.

### Summary

Core Build 0.9 is the **Build Variety** build. It ships the second class the game has deferred by name since Core 0.1 (and declined again explicitly in 0.7's non-goals): **Ironclad**, a close-range physical bruiser contrasting Gravewalker's longer-range caster-ish lean. Shipping it required fixing the one real hardcoded single-class assumption the planning audit found — `resolveSkillSlotDefinition` always resolved through a hardcoded `DEFAULT_CLASS_ID = "gravewalker"` constant, meaning every class's players would otherwise have silently been cast as Gravewalker's skills.

Planning docs: `docs/CORE_BUILD_0_9_PLAN.md`, `docs/CORE_BUILD_0_9_CHECKLIST.md`.

### What changed — Class Content (Wave 2)

- **`packages/shared/src/character/CharacterTypes.ts`**: widened `CharacterClassKey` from the single-literal `"gravewalker"` to `"gravewalker" | "ironclad"`.
- **`packages/content/src/data/types.ts`**: widened `SkillId` to include `"shatter_blow" | "groundbreaker"` (the same shape of change as `CharacterClassKey` above — a closed literal union that grows with new content, same pattern as 0.7's `ItemRarity` widening).
- **`packages/content/src/data/classes.ts`**: added `ironclad` (`baseStats: { power: 4, speed: 0, mind: 0, toughness: 5 }`, `startingSkillId: "heavy_strike"`, `secondarySkillId: "shatter_blow"`, `tertiarySkillId: "groundbreaker"`).
- **`packages/content/src/data/origins.ts`**: added `"ironclad"` to `sewer_dweller.allowedClassIds` — no second origin (see Non-Goals in the plan).
- **`packages/content/src/data/skills.ts`**: added `shatter_blow` (range 64, cooldown 1300ms, damage 6) and `groundbreaker` (range 80, cooldown 3200ms, damage 10) — melee-range, high-commitment-burst numbers, deliberately distinct from Grave Spark (range 96, damage 3) and Bone Splinter (range 140, damage 5).
- **`packages/localization/src/locales/en.ts`** and **`LocaleTypes.ts`**: added the 6 required keys (`class.ironclad.name`/`.description`, `skill.shatter_blow.name`/`.description`, `skill.groundbreaker.name`/`.description`).
- A build-process gotcha found along the way: `packages/shared` and `packages/localization` are consumed by `packages/content` through TypeScript project references with pre-built `dist/*.d.ts` output. Editing their source types without rebuilding left `content`'s typecheck seeing stale, pre-edit types (e.g. `CharacterClassKey` still resolving to only `"gravewalker"`). Fixed by running `pnpm --filter @doomscrolls/shared build` and `pnpm --filter @doomscrolls/localization build` before re-typechecking `content`. Not a code bug — just a build-ordering trap worth knowing about the next time a shared/localization type changes.

### What changed — Class-Aware Skill Resolution (Wave 3, the real fix)

- **`apps/server/src/realtime/rooms/skillSlotContent.ts`**: `resolveSkillSlotDefinition(slot)` → `resolveSkillSlotDefinition(slot, classKey)`. Removed the `DEFAULT_CLASS_ID` constant entirely.
- **`apps/server/src/realtime/rooms/PlayerPresence.ts`**: added a `classKey: CharacterClassKey` schema field (new constructor parameter, positioned alongside `characterId`/`displayName`).
- **`buildPlayerPresence.ts`** (TownRoom) and **`buildCombatPlayerPresence.ts`** (CombatRoom): both `BuildTownPlayerPresenceInput`/`BuildCombatPlayerPresenceInput` gained `classKey`, threaded into the `PlayerPresence` constructor call.
- **`TownRoom.ts`** and **`CombatRoom.ts`**: both `onJoin` handlers now pass `classKey: result.character.classKey` into their presence builder; both `registerSkillSlotHandler`s now call `resolveSkillSlotDefinition(slot, player.classKey)` instead of the old single-argument call. In both rooms this required moving the call to after the existing "player undefined / not alive" guard, since `player.classKey` needs a non-undefined `player`.
- **`deferredActionExecution.ts`**: its deferred-cast skill-slot execution path updated the same way (`player.classKey` was already guaranteed non-undefined at that call site).
- All three call sites had to change together — the signature change is a hard TypeScript compile error otherwise, not a silent gap, which is exactly the property the plan called out as the fix's own built-in mitigation.

### What changed — Client Class Picker (Wave 4)

- **`apps/client/src/game/scenes/accountShell/accountShellDom.ts`**: added `createOptionSelect(labelText, id, options)`, a real multi-option `<select>` builder, alongside the existing single-fixed-option `createFixedOptionSelect` (kept as-is for the origin field, which still has exactly one real choice).
- **`apps/client/src/game/scenes/accountShell/characterCreateFormView.ts`**: the class field now renders both `gravewalker` and `ironclad` as real, localized, selectable options. No change was needed in `AccountShellScene.ts`'s submit handler — confirmed live (see Verification) that it already reads `elements.characterClass.value` generically.

### Wave 5 — cut

The plan's optional "one test-debt down payment" wave (a targeted vitest regression test for vendor buy/sell) was cut. Reason, stated plainly: vendor buy/sell (`vendorBuyItem.ts`) runs inside a real `prisma.$transaction` across three repositories, unlike `CharacterService`/`ObjectiveRepository`, which the 0.8 harness mocks as single flat service calls. Testing it properly would mean either mocking a full Prisma transaction callback across three repositories (a meaningfully bigger lift than "one small test," and easy to get subtly wrong) or using the real dev database, which would contradict the harness's own "no throwaway DB accounts" design. Cutting this creates no new debt — it leaves TownRoom's vendor/stash/waypoint coverage exactly where 0.8 left it, which remains open for a future, properly-scoped pass.

### Docs (Wave 6)

- **`AGENTS.md`**: the "Core 0.1 Game Scope" section is now explicitly labeled a point-in-time historical snapshot rather than living scope, and its "Excluded until later" list's "multiple origins/classes" line was corrected to "a second origin" (Core 0.9 shipped the second class this line used to jointly exclude).

### Verification

Per `AGENTS.md`'s "Verification Must Be Permanent" rule (0.8) and this build's explicit efficiency constraint, verification ran through the 0.8 harness first, with a live dev-server check reserved for the one thing that is genuinely real client UI.

**In-process (`apps/server/test/`, `pnpm --filter @doomscrolls/server test` — 5 files, 7 tests, all passing):**

- `test/content/skillSlotClassResolution.test.ts` (new, unit-level, no room): `resolveSkillSlotDefinition("secondary"/"tertiary", "gravewalker"|"ironclad")` returns the correct skill definition per class — the fast, direct proof the `classKey` parameter is consulted, not just accepted and ignored.
- `test/combat/skillSlotCasting.test.ts` (extended): a new case joins `CombatRoom` as Ironclad and casts `secondary`, asserting the accepted message carries Shatter Blow's damage (6), not Grave Spark's (3).
- `test/town/skillSlotClassResolution.test.ts` (new — **TownRoom's first vitest coverage of any kind**, a direct side effect of fixing this bug correctly rather than a separate backfill effort): the equivalent case for `TownRoom`'s own skill-slot handler.
- `test/support/fixtures.ts` extended with `buildTestIroncladCharacterDetails()`; `test/setup.ts`'s `CharacterService` mock now branches on the requested `characterId` so a test can join as either fixture class.
- **Regression-check discipline** (per the same practice established in 0.8): each of the three new/extended assertions was confirmed to actually catch its regression by temporarily reverting `CombatRoom.ts`'s fixed call site back to a hardcoded `"gravewalker"` argument and re-running — the Ironclad test failed with `expected 3 to be 6`, reproducing exactly the bug this fix closes, before the fix was restored and all tests re-verified green.

**Live dev-server check (the one piece that is real client UI — the class-picker `<select>`), performed against the already-running local dev stack (Postgres/Redis via `infra/compose/docker-compose.local.yml`, `apps/server` dev, `apps/client` dev) with Playwright driving a headless Chromium session:**

- The class `<select>` renders exactly two options with correct localized labels: `{value: "gravewalker", label: "Gravewalker"}`, `{value: "ironclad", label: "Ironclad"}`.
- Registered a temp account, selected Ironclad, submitted character creation. The real `POST /characters` request body carried `classId: "ironclad"`; the real server response confirmed persistence and returned correctly-derived stats: `primary: { power: 5, speed: 2, mind: 1, toughness: 7 }` (origin `sewer_dweller` + class `ironclad` summed exactly as expected), `derived: { maxHp: 55, damage: 6, armor: 0, moveSpeed: 1.04, attackCooldownMs: 950 }` (each matches `CharacterStatsService`'s formulas by hand-check) — confirming `CharacterStatsService` is indeed fully class-generic with zero changes needed, as the plan's audit predicted.
- The character list correctly displayed "Class: Ironclad" after creation, confirming the full round trip (picker → request → persistence → display) works end-to-end, not just the request payload.
- No console errors during the session.
- The temp test account (and its cascade-deleted character/stats/inventory rows) was removed from the dev database after verification.

**Typecheck:** `pnpm -r typecheck` — 0 errors across all 6 workspace packages.
