# docs/CORE_BUILD_0_10_RELEASE_NOTES.md — Core Build 0.10 Release Notes

---

## Task — Combat Integrity: Wiring Weapon Damage Into Combat

**Date:** 2026-09-01
**Build:** Core Build 0.10
**Status:** Waves 1-3 and 5 implemented and verified in one pass. Wave 4 (feel pass) was performed as a numeric analysis rather than a live playtest — see below — and produced no changes.

### Summary

Core Build 0.10 is the **Combat Integrity** build. It fixes a real, already-shipped fake feature: weapon `damage` stat modifiers (`starter_pipe` since Core 0.1, `condemned_cleaver`/`livewire_lance` since 0.7) were computed, persisted, and equippable, but never once affected an actual fight, because basic attacks were hardcoded to deal exactly `1` damage and skills always dealt their flat content `baseDamage`, at three call sites each. `PlayerPresence` never carried a `damage` field at all, unlike `attackCooldownMs`/`movementSpeed`, which already flowed the same way.

Planning docs: `docs/CORE_BUILD_0_10_PLAN.md`, `docs/CORE_BUILD_0_10_CHECKLIST.md`.

### What changed — Presence Wiring (Wave 2)

- **`apps/server/src/realtime/rooms/PlayerPresence.ts`**: added a `damage: number` schema field, populated identically to `attackCooldownMs`/`movementSpeed`.
- **`apps/server/src/realtime/rooms/resolvePlayerDamage.ts`** (new): a small fallback resolver mirroring `resolveAttackCooldownMs`'s shape — falls back to `1`, the same floor `CharacterStatsService.calculateDerivedStats` uses for a zero-power, unequipped character.
- **`buildPlayerPresence.ts`** (TownRoom) and **`buildCombatPlayerPresence.ts`** (CombatRoom): both input interfaces gained `damage`, threaded into the `PlayerPresence` constructor call.
- **`TownRoom.ts`** and **`CombatRoom.ts`**: both `onJoin` handlers now compute `damage = resolvePlayerDamage(result.character.stats?.derived.damage)` and pass it into their presence builder, the same way `maxHp`/`attackCooldownMs` are already read.
- **All three rooms' `applyProgressionUpdate` helper** (`CombatRoom.ts`, `TownRoom.ts`, `deferredActionExecution.ts`) — each already recalculated `derived.damage` via `CharacterStatsService.calculateEquippedStats` on every level-up/equip change and persisted it to the database, but never wrote it back onto the live presence. Each now also sets `player.damage = recalculated.derived.damage` alongside the existing `player.maxHp`/`player.hp` writes.

### What changed — Combat Resolution (Wave 3, the real fix)

- **Basic attack**, at all three call sites (`CombatRoom.ts`, `TownRoom.ts`, `deferredActionExecution.ts`): `applyEnemyDamage(enemy, 1)` → `applyEnemyDamage(enemy, player.damage)`.
- **Skill cast**, at all three call sites: replaced the flat `skillDefinition.damage` with `resolveSkillCastDamage(skillDefinition, player.damage)`, a new helper in `skillSlotContent.ts`. The formula: `skillDefinition.damage + Math.max(0, player.damage - 1)` — treating the universal `1` floor baked into `calculateDerivedStats`'s `damage = 1 + power` as shared by every damage source, and layering the power/equipment bonus above that floor onto a skill's own numbers. This keeps each skill's own numbers as the dominant, distinguishing factor between skills (Shatter Blow still hits harder than Grave Spark) while making gear and the power stat matter for skills too, not just basic attacks.
- The `request_use_skill_slot_accepted` message's `damage` field now reports the real number dealt (`castDamage`), not the stale flat `skillDefinition.damage`, in all three rooms.

### Wave 4 — Feel pass (numeric analysis, not a live playtest)

Per the plan, this build's verification is expected to be fully in-process with no live-server step, since it touches no client/UI code. That held for correctness, but Wave 4 asked for a subjective pacing check against real enemy HP, which this environment cannot perform via an actual playtest. Instead, the check was done by computing real starting numbers directly from content, rather than relying on the test suite's intentionally high, synthetic fixture stats (`TEST_CHARACTER_STATS.derived.damage: 12`, chosen to be "deliberately non-fallback" and distinctive for assertions — not representative of an actual fresh character):

- **Real starting `derived.damage`** (origin `sewer_dweller` + class, no equipment, per `CharacterStatsService`'s `damage = 1 + power`): Gravewalker `1 + (1 + 3) = 5`; Ironclad `1 + (1 + 4) = 6`.
- **Enemy `maxHp`**: `trashboar_skitter` 8, `static_wretch` 10, `trashboar_runt` 12, `trashboar_brute` 30.
- **Basic-attack hits-to-defeat, before vs. after this build**: skitter 8→2, wretch 10→2, runt 12→3 (Gravewalker) / 2 (Ironclad), brute 30→6 (Gravewalker) / 5 (Ironclad). Before this build every one of these was flat-damage-1, so every kill took as many hits as the enemy's HP (8-30) regardless of character.
- **Skill damage** (base + bonus, bonus = starting `damage - 1`): Gravewalker's Grave Spark `3 + 4 = 7`, Bone Splinter `5 + 4 = 9`; Ironclad's Shatter Blow `6 + 5 = 11`, Groundbreaker `10 + 5 = 15`.

Conclusion: pacing gets meaningfully faster (2-6 basic-attack hits per kill instead of 8-30) but nothing reads as degenerate — no enemy is one-shot by a basic attack, and the two skills that come close to or exceed a trash mob's HP in one hit (Shatter Blow/Groundbreaker against the two lowest-HP enemies) are exactly the "heaviest hit, slowest cooldown" skills such a result is supposed to reward. **No numeric adjustment was made** — stated plainly, per the plan's explicit exit condition for this wave. This numeric-analysis substitute for a live playtest, and the reason a live check wasn't available, should be called out explicitly rather than silently presented as an equivalent to actually playing it.

### Verification

Per `AGENTS.md`'s "Verification Must Be Permanent" rule and this build's explicit efficiency constraint, verification ran entirely through the existing harness — **no live dev-server step was needed this build**, a first for this series (the build touches no client/UI code).

**In-process (`apps/server/test/`, `pnpm --filter @doomscrolls/server test` — 8 files, 12 tests, all passing):**

- `test/character/characterStatsService.test.ts` (new — `CharacterStatsService`'s first-ever unit test): `calculateEquippedStats` folds a `damage` stat modifier into `derived.damage` correctly, for both `add` and `multiply` operations.
- `test/combat/basicAttackDamage.test.ts` and `test/town/basicAttackDamage.test.ts` (new — first-ever basic-attack damage assertions for either room): a joined character's basic attack deals exactly their real `derived.damage`, not a hardcoded literal.
- `test/combat/skillSlotCasting.test.ts` and `test/town/skillSlotClassResolution.test.ts` (extended): the existing Ironclad-class-resolution assertions, which previously asserted the flat `skillDefinition.damage` (6) as proof the correct skill resolved, now assert the correct *total* (`6 + (fixture damage - 1)` = 17) as proof both the correct skill resolves *and* the new damage formula applies to it.
- **Regression-check discipline** (per 0.9's established practice): both fixes were temporarily reverted (basic attack back to hardcoded `1`; skill cast back to flat `skillDefinition.damage`) and the affected tests were confirmed to fail with the exact expected old/new number mismatch (`999` vs `988` for basic attack; `6` vs `17` for skill cast) before restoring both fixes and re-verifying all 12 tests green.

**Typecheck:** `pnpm -r typecheck` — 0 errors across all 6 workspace packages (5 with a `typecheck` script; the content package's registry validation, exercised on every test-harness room boot, also passed throughout).

### Non-goals held

No loadout/build-choice system, no new skill/class/origin/zone content, no rebalancing of any skill's own `baseDamage` numbers, no armor/mitigation formula changes, no new items or equipment slots, no PvP, and no objectives/quest depth — all exactly as scoped in the plan.
