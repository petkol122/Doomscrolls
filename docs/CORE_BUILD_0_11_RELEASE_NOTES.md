# docs/CORE_BUILD_0_11_RELEASE_NOTES.md — Core Build 0.11 Release Notes

---

## Task — Combat Integrity, Part Two: Wiring Armor Mitigation

**Date:** 2026-09-01
**Build:** Core Build 0.11
**Status:** Waves 1-4 implemented and verified in one pass.

### Summary

Core Build 0.11 fixes the mirror image of 0.10's bug: incoming enemy damage was fully flat/content-driven and never consulted the player's `armor` stat, and unlike `damage` before 0.10, `armor` didn't even have a field on the runtime `PlayerPresence` object to read from — despite being a real, computed, persisted stat that six already-shipped armor items modify. Enemy attacks now consult the target's real `armor` before landing, in both rooms.

Planning docs: `docs/CORE_BUILD_0_11_PLAN.md`, `docs/CORE_BUILD_0_11_CHECKLIST.md`.

### Arithmetic check (done before implementation, per this build's brief)

The realistic maximum simultaneously-equipped armor is **9**, not the naive 13-point sum of all six armor-modifying items — `chest` and `head` are each single slots contested by multiple items, so only the best one per slot ever counts: `warden_plate` (+5, chest) beats `sewer_jacket` (+2) and `chargeplate_vest` (+1) for the same slot; `scavenger_king_helm` (+3, head) beats `scavenged_hood` (+1). `9 = warden_plate(+5) + scavenger_king_helm(+3) + rustbound_ring(+1)`.

Against real enemy damage values (`trashboar_skitter` 1, `trashboar_runt`/`static_wretch` 2, `trashboar_brute` 3 normal / 6 heavy), the recommended `Math.max(1, rawDamage - player.armor)` formula floors **every** current enemy attack to 1 HP at armor 9 — full itemization progression on this stat eliminates all differentiation between enemies for a maxed-armor character. A sharper edge case: `trashboar_skitter`'s raw damage (1) already equals the floor at **zero** armor, so armor has zero effect against it at any value. This was named explicitly in the plan's Risk 6 rather than left silent, and the formula was kept unchanged per the plan's decision — a lightly-armored character still sees real, graduated differentiation against 3 of 4 enemies, and this is a content-tuning fact about specific enemies' low damage values, not a flaw in the wiring.

### What changed — Presence Wiring (Wave 2)

- **`apps/server/src/realtime/rooms/PlayerPresence.ts`**: added an `armor: number` schema field, populated identically to `damage` (0.10) and `attackCooldownMs`/`movementSpeed`.
- **`apps/server/src/realtime/rooms/resolvePlayerArmor.ts`** (new): a small fallback resolver mirroring `resolvePlayerDamage.ts`'s shape — falls back to `0`, matching `CharacterStatsService`'s own unarmored base value.
- **`buildPlayerPresence.ts`** (TownRoom) and **`buildCombatPlayerPresence.ts`** (CombatRoom): both input interfaces gained `armor`, threaded into the `PlayerPresence` constructor call.
- **`TownRoom.ts`** and **`CombatRoom.ts`**: both `onJoin` handlers now compute `armor = resolvePlayerArmor(result.character.stats?.derived.armor)` and pass it into their presence builder.
- **All three rooms' `applyProgressionUpdate` helper** (`CombatRoom.ts`, `TownRoom.ts`, `deferredActionExecution.ts`) — each already recalculated `derived.armor` via `CharacterStatsService.calculateEquippedStats` on every level-up/equip change and persisted it to the database, but never wrote it back onto the live presence. Each now also sets `player.armor = recalculated.derived.armor` alongside the existing `damage` sync added in 0.10.
- `test/character/characterStatsService.test.ts` extended with two cases proving `calculateEquippedStats` computes `derived.armor` as `0` with no modifiers and folds an equipped `armor` modifier correctly — the same generic path already proven for `damage`.

### What changed — Mitigation at the Landing Sites (Wave 3, the real fix)

- **`apps/server/src/realtime/rooms/incomingDamageMitigation.ts`** (new): `mitigateIncomingDamage(rawDamage, playerArmor)` — a shared, floor-preserving formula (`Math.max(1, rawDamage - armor)`), mirroring `resolveSkillCastDamage`'s floor philosophy from 0.10. Used by both rooms so they apply the exact same rule.
- **`CombatRoom.ts`** (`applyCombatEnemyAggroDamage`'s landing branch): the raw `enemyDefinition?.damage` value is now passed through `mitigateIncomingDamage` before being subtracted from `targetPlayer.hp`.
- **`TownRoom.ts`** (`applyEnemyAggroDamage`'s landing branch): same change, applied uniformly to both the normal and heavy landing-damage branches — a Trashboar Brute's heavy attack is mitigated by armor exactly like its normal attack, no special-casing.
- No enemy content values (`damage`, `heavyAttackDamage`) or existing armor item values were changed.

### Verification

Per `AGENTS.md`'s "Verification Must Be Permanent" rule and this build's explicit efficiency constraint, verification ran entirely through the existing harness — **no live dev-server step was needed**, the same as 0.10 (this build touches no client/UI code). No live-feel verification of the combined damage+armor combat pace was attempted, per this build's explicit non-goal.

**In-process (`apps/server/test/`, `pnpm --filter @doomscrolls/server test` — 10 files, 18 tests, all passing):**

- `test/character/characterStatsService.test.ts` (extended): `calculateEquippedStats` computes `derived.armor` correctly with and without an equipped armor modifier.
- `test/combat/incomingDamageMitigation.test.ts` and `test/town/incomingDamageMitigation.test.ts` (new — first-ever incoming-damage assertions for either room): an unarmored player takes the enemy's real raw damage; a player with armor far exceeding any current enemy's damage value takes exactly the floor (1 HP), not 0.
  - These are the first tests to exercise either room's enemy-attack-landing tick at all. The tick runs on a real `setSimulationInterval` (50ms), not a mockable clock, so each test forces a landing on the very next tick by presetting the enemy's `attackLandingAtMs` to a past timestamp and co-locating the enemy with its target (and, for `TownRoom`, with its own spawn point, so the tick's aggro/leash-range re-validation trivially passes), then awaits one real tick interval before asserting.
- **Regression-check discipline** (per 0.9/0.10's established practice): both landing-site fixes were temporarily reverted to the raw, unmitigated damage value and the floor-case tests were confirmed to fail with the exact expected mismatch (`998` vs `999`) before restoring both fixes and re-verifying all 18 tests green. The unarmored-case tests correctly did *not* fail on revert — with zero armor, mitigated and unmitigated damage are identical, so that assertion doesn't distinguish the two paths; the floor-case tests are what actually catch this regression, and they did.

**Typecheck:** `pnpm -r typecheck` — 0 errors across all 6 workspace packages.

### Non-goals held

No death/respawn consequence changes, no `heavy_strike`/basic-attack-formula wiring, no loadout/build-choice system, no new enemy/AI/zone/class/skill/item content, no percentage-based or diminishing-returns mitigation formula, no rebalancing of enemy damage or armor item values, no PvP, no objectives/quest depth, and no live playtest of combined combat feel — all exactly as scoped in the plan.
