# docs/CORE_BUILD_0_31_RELEASE_NOTES.md — Core Build 0.31 Release Notes

---

## Task — movementSpeed/attackCooldownMs Join the Live Combat-Stats Push

**Date:** 2026-09-07
**Build:** Core Build 0.31
**Status:** Implemented, regression-tested (revert/confirm/restore discipline), live-verified. Working-tree only — nothing committed.

### Summary

Core 0.23's "Follow-up 2" fixed a live-desync bug for `damage`/`armor`: equipping gear mid-session updated the database and (after that build's own earlier fix) the equipment panel, but combat resolution reads `player.damage`/`.armor` directly off the live synced `PlayerPresence` schema instance, not the database — so the actual damage dealt and mitigation applied stayed stale until the player left and rejoined the room. That release note named, explicitly, that `movementSpeed` and `attackCooldownMs` had the *identical* gap and were left unfixed: "attackCooldownMs is a trivial, same-shape addition... held back anyway because this build's verification and regression test were scoped to damage/armor specifically" and "moveSpeed/movementSpeed is not trivial: `PlayerPresence.movementSpeed` is the *converted* runtime value... not a direct pass-through... Reusing it correctly needs either wrapping the recalculated stats in a fake `CharacterDetails` shape or a small refactor."

This build closes both. Pure reuse of the exact mechanism 0.23 already built (`connectedPlayerRegistry.ts`'s `updateConnectedPlayerLiveCombatStats`, called from `EquipmentService.recalculateEquippedCharacterStats`) — no second pattern for the same problem.

### Investigation: did this need new wiring, or was it already there and just unverified?

Confirmed by reading the code, not assumed: the existing push (`{ damage, armor }`) never touched `movementSpeed`/`attackCooldownMs` at all — this was a real, unclosed gap, not an already-working path missing a test. `EquipmentService.recalculateEquippedCharacterStats` already *computes* both fields as part of the same `CharacterStatsService.calculateEquippedStats` call (`recalculatedStats.derived.moveSpeed`, `.attackCooldownMs` both exist on the object already in scope) — they were simply never extracted and pushed alongside damage/armor.

### The unit-conversion decision (investigated and resolved, not deferred again)

0.23 flagged this as an open design question: whether Town and Combat should even share the same movement-speed conversion constant. Tracing every call site of `resolvePlayerMovementSpeed` found the answer was already settled, just not stated: **`TownRoom.onJoin` and `CombatRoom.onJoin` already call the identical function with the identical `TOWN_MOVEMENT_SPEED_UNITS_PER_SECOND_MULTIPLIER = 220` constant** — there was never a second, divergent scale to reconcile; both rooms already share one.

Separately checked whether this is the same tile-scalar bug Core 0.24 found and fixed for *enemy* movement speed (`toWorldUnits`, a x24 tile-to-pixel conversion, was mistakenly applied to enemy `moveSpeed` before 0.24's port). Confirmed it is not, and was never at risk of being: `toWorldUnits` is used *only* for `aggroRange`/`leashRange` in both `TownRoom.ts` and `CombatRoom.ts` (grepped every call site) — player `movementSpeed` has only ever gone through `resolvePlayerMovementSpeed`'s dedicated x220 constant, never `toWorldUnits`. The two conversions solve different problems (spatial ranges vs. a per-second rate) and were never actually conflated for players, only for the enemy port 0.24 fixed.

**Resolution**: `resolvePlayerMovementSpeed` was refactored (0.23's second anticipated option — "a small refactor") from `(character: Pick<CharacterDetails, "stats">) => number` to `(moveSpeedStat: number | null | undefined) => number`, taking the raw stat value directly rather than a full character object. This is a pure signature narrowing — the constant, the conversion, and the fallback logic are all unchanged — and it lets `EquipmentService` call the exact same function `TownRoom`/`CombatRoom` already call at join, with the freshly recalculated `moveSpeed` stat it actually has, instead of needing to fabricate a fake `CharacterDetails` object. Both existing call sites (`TownRoom.ts`, `CombatRoom.ts`) updated to pass `result.character.stats?.derived.moveSpeed` instead of `result.character` — same value, same optional-chaining convention already used for every other stat read at those two sites.

### What changed

- **`apps/server/src/realtime/rooms/resolvePlayerMovementSpeed.ts`**: signature narrowed to accept the raw `moveSpeed` stat directly (see above). No behavior change for existing callers — same constant, same conversion, same fallback.
- **`apps/server/src/realtime/rooms/TownRoom.ts`** / **`CombatRoom.ts`**: updated their one call site each to pass `result.character.stats?.derived.moveSpeed` instead of `result.character`.
- **`apps/server/src/realtime/rooms/connectedPlayerRegistry.ts`**: `LivePlayerCombatStats` gains `movementSpeed`/`attackCooldownMs`; `updateConnectedPlayerLiveCombatStats` now writes all four fields (`damage`, `armor`, `movementSpeed`, `attackCooldownMs`) onto the live `PlayerPresence` instance in one call, same as before.
- **`apps/server/src/character/EquipmentService.ts`**: `recalculateEquippedCharacterStats`'s existing push call extended with `movementSpeed: resolvePlayerMovementSpeed(recalculatedStats.derived.moveSpeed)` and `attackCooldownMs: recalculatedStats.derived.attackCooldownMs` (pushed as a direct value, no `resolveAttackCooldownMs` wrapper — matching how `damage`/`armor` already skip their own resolve-with-fallback wrappers, since `recalculatedStats` is a freshly computed, always-finite number, not a possibly-corrupt DB read; the wrapper's guard would be a no-op here, same reasoning 0.23 already relied on for damage/armor).

### Regression tests

`apps/server/test/character/equipmentService.test.ts` — the existing "EquipmentService live combat stats" block's two tests (equip/unequip the Starter Pipe) updated to assert the full four-field push shape (previously `{ damage, armor }` only). Two new tests added, using real, pre-existing content items that actually modify these fields (`sewer_treads`: `moveSpeed +0.15`; `wraptape_gloves`: `attackCooldownMs -40` — both already exist in `packages/content/src/data/items.ts`, confirmed real, not invented for this test):

- Equipping `sewer_treads` pushes `movementSpeed = (1.06 + 0.15) * 220 = 266.2` — the *converted* runtime value, not the raw `1.21` stat.
- Equipping `wraptape_gloves` pushes `attackCooldownMs = 925 - 40 = 885`.

**Regression-check discipline**: temporarily reverted the fix (replaced the two new pushed fields with sentinel `-1` values in `EquipmentService.ts`), re-ran the suite — all 4 assertions touching `movementSpeed`/`attackCooldownMs` failed exactly as expected (`expected -1 to be 266.2`, etc.), while the two unrelated `equipment_updated` broadcast tests stayed green, confirming the two concerns are properly independent. Restored the real fix, reconfirmed all 6 tests green.

Full suite: 40 files / 73 tests, all passing. `pnpm -r typecheck` clean across all 5 workspace packages.

### Live verification

Against the real running dev stack (Fastify/Colyseus server, Postgres/Redis, Vite client) — a real account/character, real HTTP registration, real `sewer_treads`/`wraptape_gloves` seeded as real `ItemInstance` rows, driven with Playwright through the real Inventory panel UI for both equips (no relog at any point). A one-line, throwaway `window.__debugRoom` exposure was added to `WorldSessionScene.init()` to read live `PlayerPresence` fields directly (mirroring 0.23's own precedent for this exact kind of check) and reverted immediately after — confirmed via `git diff` showing no residual change to that file.

**Baseline** (before either equip): `movementSpeed = 233.1999969482422` (≈233.2, matching `1.06 * 220` exactly), `attackCooldownMs = 925`. Both match the hand-computed base values exactly.

**Movement — real gameplay effect, not just the field**: a fixed 200-world-unit move (sent as a real `request_move`, timed by polling the live synced position until it stopped changing) took **1184ms** before equipping. Equipped `sewer_treads` mid-session: `movementSpeed` live-updated immediately to **266.20001220703125** (≈266.2, exactly matching `1.21 * 220`). The identical 200-unit move afterward took **1011ms** — measurably shorter, in the predicted range (the speed ratio predicts ~1037ms; 1011ms observed, real-world timing noise accounted for).

**Attack cadence — real gameplay effect, not just the field**: a real, accepted `request_attack` before equipping showed `nextAttackAt - lastAttackAt = 925ms` exactly. Equipped `wraptape_gloves` mid-session: `attackCooldownMs` live-updated immediately to **885**. A second real, accepted attack afterward showed `nextAttackAt - lastAttackAt = 885ms` exactly — the new value governing a real attack's actual cooldown window, not just sitting in an unread field.

Zero browser console errors and zero server-side errors observed throughout. Test account, character, and all 6 seeded item rows (across every script iteration, including three earlier attempts that failed on script bugs unrelated to the fix itself) deleted from the database afterward; confirmed zero matching rows remain.

### Non-goals held (unchanged from 0.23's own scope calls, not revisited here)

- **`maxHp`/`hp` live-desync**: 0.23 named this as a separate, non-trivial gap (the level-up path's "preserve missing HP, clamp overflow" reconciliation raises a gameplay-balance question, not a bug fix) and explicitly did not fix it. Not touched by this build either — out of scope, still open, still a real gap if the same rigor is ever applied to it.
- No new content, no new items, no balance changes — `sewer_treads`/`wraptape_gloves` already existed with these exact modifiers before this build.

### Validation

```bash
pnpm --filter @doomscrolls/server typecheck
pnpm -r typecheck
pnpm --filter @doomscrolls/server test
```

No commit made yet — pending this document's completion and the user's own commit trigger, per standing rule (tree stays uncommitted unless already clean when asked).
