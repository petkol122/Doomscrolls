# docs/CORE_BUILD_0_8_RELEASE_NOTES.md — Core Build 0.8 Release Notes

---

## Task 362 — Persistent Server Regression-Test Harness

**Date:** 2026-09-01
**Status:** Implemented and verified

### Summary

0.7's hotfix (Task 360/361, see `docs/CORE_BUILD_0_7_RELEASE_NOTES.md`) was verified live with a scripted Colyseus client that was written, run, and discarded. That proved the fix once but left nothing behind to catch a regression later. This task replaces that pattern with a real, persistent test suite in `apps/server`, whose "test" script previously only ran `tsc --noEmit` (no actual test runner existed).

### What changed

- **`apps/server/package.json`**: added `vitest`, `@colyseus/testing`, `@colyseus/sdk`, `@colyseus/tools` as devDependencies; `"test"` now runs `vitest run` instead of `tsc --noEmit`. Also added the missing `@doomscrolls/localization` runtime dependency — `TownRoom.ts` has imported `t` from it for several builds, but it was never declared as a dependency of `@doomscrolls/server`, so it resolved only through `tsc`'s path-mapped typecheck, not through real Node module resolution (`tsx watch` / the new test harness both need the latter). Found while wiring the harness; fixed as part of this task since the harness could not otherwise load the real room modules.
- **`apps/server/vitest.config.ts`** (new): node environment, `test/**/*.test.ts`, `pool: "threads"` (`@colyseus/core` peer-depends on `@pm2/io`, which auto-activates its IPC transport whenever `process.send` exists — true under vitest's default forked-process pool — and crashes the worker; worker threads have no `process.send`, so it stays dormant), and `fileParallelism: false` (each test file boots its own in-process Colyseus server on a fixed port).
- **`apps/server/test/setup.ts`** (new): mocks `CharacterService` and `ObjectiveRepository` — the two persistence entry points every room join goes through — with an in-memory fixture, so room joins run for real with no live database or throwaway accounts.
- **`apps/server/test/support/`** (new): `testRealtimeServer.ts` boots a bare `colyseus.Server` with `TownRoom`/`CombatRoom` registered exactly as `createRealtimeServer.ts` does (including the Task 361 `.filterBy(["requestedZoneId"])`), via `@colyseus/testing`'s `boot()`; `fixtures.ts` provides a realistic (non-fallback) character stats fixture; `waitForMessage.ts` is a small helper for asserting a client actually receives a given message within a timeout.
- **`apps/server/test/combat/`** (new): three regression tests, one per bug found during 0.7's live verification:
  - `skillSlotCasting.test.ts` — `CombatRoom` actually handles `request_use_skill_slot` (it was previously registered only in `TownRoom`).
  - `joinInitialStats.test.ts` — `CombatRoom.onJoin` derives real hp/maxHp/moveSpeed/attackCooldownMs from the character's stats, not hardcoded zero.
  - `zoneMatchmaking.test.ts` — concurrent `joinOrCreate` calls for different combat zones land in distinct rooms with the correct zone-matched state; a same-zone call still reuses the existing room.
- **`apps/server/tsconfig.json`**: added `"test"` to `include` so the suite is typechecked, not just executed.
- **`AGENTS.md`**: added a "Verification Must Be Permanent" rule — live verification of server-authoritative logic must land as a real test in this suite going forward, not a throwaway scripted-client file.

### Verification

- Each of the three new tests was confirmed to actually catch its regression: temporarily reverting the fix it covers (commenting out the skill-slot handler registration; reverting the CombatRoom join stats to hardcoded 0; removing `.filterBy(["requestedZoneId"])` from the test harness's room registration) reproduced the original failure in each case — a timeout waiting for the skill-slot response, a `0` where `120` was expected, and two concurrent joins landing in the same room — then each was restored and reverified green.
- `pnpm --filter @doomscrolls/server test` — 3 passed.
- `pnpm -r typecheck` — 0 errors across all 6 workspace packages.
