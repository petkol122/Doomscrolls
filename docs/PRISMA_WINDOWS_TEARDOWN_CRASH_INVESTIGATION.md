# docs/PRISMA_WINDOWS_TEARDOWN_CRASH_INVESTIGATION.md

**Date:** 2026-09-02
**Scope:** Local Windows dev-experience investigation only. CI runs
`apps/server`'s test suite on `ubuntu-latest`, which does not load the
Windows native query engine at all, so this crash class cannot occur in
CI — it is purely a local-dev annoyance, not a suite-correctness or
CI-reliability concern. No commits made; this doc and the investigation
are working-tree-only, same as every Core Build session.

> **2026-09-02 update — see §7.** The crash itself is still confirmed
> Windows-only and not a CI concern. But a follow-up investigation into
> a claim made in §5 (that the real Prisma client is "never touched" by
> tests) found that claim was wrong for `TownRoom` tests specifically —
> 8 of 23 test files genuinely require a live Postgres to pass, and
> nothing in this repo's checked-in config would supply `DATABASE_URL`
> on a fresh CI checkout. Read §7 before treating this suite as
> hermetic.
>
> **2026-09-02 update — see §8.** §6's recommended dependency-injection
> refactor was implemented and directly measured. It correctly cut real
> `PrismaClient` construction from 21 files to 12 (verified with the
> same instrumentation §3 used) — but the measured full-suite crash
> rate got **worse**, not better (87% across 23 runs, vs. the 56%
> baseline that motivated doing this), because the remaining 12
> constructions cluster densely in file-collection order with no gap
> between several of them. The working tree currently contains this
> refactor; §8.4 lays out the trade-off it presents rather than
> resolving it unilaterally.
>
> **2026-09-02 update — see §9.** A custom test sequencer was added to
> stop the 4 highest-risk files from running back-to-back, and verified
> to work exactly as intended (§9.2) — but the crash rate stayed at 89%,
> not a meaningful change from §8's 87%. Investigating *why* surfaced a
> more specific, better-supported lead: 11 of 12 crashes observed while
> verifying this landed immediately after one of those same 4 files
> regardless of what ran next, pointing at something in those files'
> own execution (most likely their un-awaited fire-and-forget DB call,
> §9.4-9.5) rather than simple proximity to another DB-touching file.
>
> **2026-09-02 — resolved, see §10. Investigation closed.** §9's lead
> was tested directly: making the 4 files' fire-and-forget XP-grant
> call actually finish before test teardown (test-scope only — zero
> production changes) dropped the crash rate from 89% to ~7% across 15
> runs, and the one remaining crash was, for the first time in this
> whole investigation, unrelated to those 4 files. Root-caused for
> real. §10.5 flags (does not fix) the same fire-and-forget pattern in
> production as worth a look someday, unrelated to this investigation.
>
> **2026-09-02 — see §11 (+ §11.1).** §10.5's flag was fixed:
> `CombatRoom`'s enemy-kill XP/objective-progress writes are still
> fire-and-forget in the hot path, but the room's `onDispose` now
> tracks and waits for them before actually closing, so none is
> orphaned when a room shuts down mid-write. §11.1 closed the two loose
> ends left hand-verified-only: the rejecting-write case now has a
> permanent, regression-checked test (spying on the room's logger to
> assert it's actually logged, not just "didn't hang"), and per-write
> pruning (already implemented, just unverified) now has a test proving
> the pending-writes Set doesn't grow unbounded across a room's
> lifetime. This closes the last open thread from this investigation.

## 1. The error, verbatim

```
thread '<unnamed>' panicked at query-engine\query-engine-node-api\src\engine.rs:52:1:
assertion `left == right` failed: failed to delete napi ref
  left: 1
 right: 0
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```
Process exits with code `3221226505` (`0xC0000409`, a Windows
fail-fast/abort from the Rust panic).

A second, distinct crash shape was also observed during this
investigation, at a different point in the run (see §2):
```
Segmentation fault
```
with `pnpm` reporting exit status `3221225477` (`0xC0000005`, an access
violation) and **no** panic message at all — the process dies mid-way
through a fresh `new PrismaClient()` call with no diagnostic output.

## 2. Where it fires — always the same step? No.

Not one step, and not one test file. Across every occurrence captured
this session (0.17's build session plus this dedicated investigation,
~15 full-suite attempts total), the crash surfaced at a different file
boundary each time:
- After `combatZoneObjectiveCoverage.test.ts` (0.17 session, run 1)
- After `zoneMatchmaking.test.ts` (0.17 session, run 2 — a different
  crash *shape*, `0xC0000005`, no panic text)
- After `joinInitialStats.test.ts` → clean pass (0.17 session, run 3)
- After `basicAttackDamage.test.ts`, twice in a row, same spot (0.17
  session, runs 4–5) — the only case of two consecutive crashes at the
  same boundary in this whole investigation, and even that didn't
  reproduce a third time
- Mid-construction of a fresh `PrismaClient` after `dodgeIntent.test.ts`
  (this investigation, disconnect-fix run 1) — a hard segfault with no
  panic text, meaning the crash isn't confined to the documented
  teardown assertion; it can also happen during a later file's engine
  *construction*
- Mid-construction after `combatZoneObjectiveCoverage.test.ts` again
  (this investigation, disconnect-fix run 4)

It is never at the very start, never predictably reproducible at a
fixed file, and instrumentation (see §3) confirmed it is not tied to
any specific test's content — swapping which enemy/objective a test
exercises has no bearing on it. **This is process-exit/native-teardown
timing, not a test-logic bug.**

## 3. What it correlates with

**Confirmed root mechanism**, found by reading the actual import graph
(not guessed): `apps/server/src/persistence/prisma.ts` does
`export const prisma = createPrismaClient()` — a real `new
PrismaClient()` — at **module load time**. `TownRoom.ts` statically
imports `vendorBuyItem.ts` / `vendorSellItem.ts` / `stashTransferItem.ts`
(and `CombatRoom.ts` imports `pickupWorldLootDispatcher.ts` →
`pickupWorldLootInventory.ts`), all of which import that `prisma`
singleton. Vitest's default `isolate: true` gives every `*.test.ts` file
its own fresh module registry, so **every test file that calls
`createTestRealtimeServer`** (both rooms are registered on it; 21 of 23
files do) re-evaluates `prisma.ts` from scratch and creates its own
real, native query-engine instance — confirmed empirically with a
temporary probe (`process.stderr.write` inside `createPrismaClient()`):
**13 separate real `PrismaClient` instantiations, all in the same OS
process** (same `process.pid` throughout), during one partial run before
it crashed.

This directly explains the correlation the task asked about:
- **Suite size**: the test suite has grown every build (13 files at 0.8
  → 16 at 0.14 → 19 at 0.15 → 20 at 0.16 → 23 at 0.17), and each file
  spins up one more abandoned native engine instance within the same
  process. More live-and-abandoned engine instances in one process
  means more opportunities to hit whatever race the Node-API engine has
  around instance teardown — matching the observed trend of increasing
  crash frequency.
- **Not a specific 0.16/0.17 test**: nothing about any individual new
  test file causes it — every room-based test file contributes equally
  to the instance count, and the crash location varies file-to-file
  across runs (§2), which rules out any single test's content.
- **Not fully proportional/deterministic**: because it's a native
  finalization/GC-timing race, not a deterministic counter, more
  instances raise the *odds* of a crash per run without guaranteeing
  one at any fixed point.

## 4. Is this a known Prisma issue class?

**Yes, confirmed against Prisma's own GitHub issue tracker**, not
assumed:

- [prisma/prisma#18577](https://github.com/prisma/prisma/issues/18577)
  — "Prisma crashes with promise rejections (among others in Vitest)."
  Reports the **identical** panic text (`failed to delete napi ref`,
  `assertion left == right`) specifically under Vitest, and identifies
  it as a race in the Node-API engine's reference handling. The
  maintainer-documented workaround there is to disable Vitest's
  thread-based concurrency — not applicable here as a clean fix (see
  §5, second row: this repo already avoids the *other* known
  Vitest+Prisma incompatibility, the fork-pool/`@pm2/io` IPC collision,
  by using `pool: "threads"`; the two known workarounds pull in
  opposite directions).
- [prisma/prisma#7814](https://github.com/prisma/prisma/issues/7814) —
  "Node-API library and multiple PrismaClient instances." Directly
  confirms that creating multiple `PrismaClient` instances within one
  process is a documented problem area for the Node-API engine
  specifically (not the older binary/library engine), independent of
  Vitest.
- Prisma's own client actively warns about this exact anti-pattern in
  other contexts (see the "Already 10 Prisma Clients are actively
  running" warning documented in
  [prisma/prisma discussion #4399](https://github.com/prisma/prisma/discussions/4399)),
  confirming "many `PrismaClient` instances in one process" is a
  recognized, not-fully-solved problem class for Prisma in general, not
  something specific to this repo's setup.

**Conclusion: this matches a known, still-open Prisma Node-API-engine
issue class** (multiple client instances + native teardown races,
elevated under Vitest specifically), not a novel bug introduced by this
project's code.

## 5. Fix attempts made, and why each was rejected

Three concrete fixes were implemented and empirically tested (not just
theorized) before concluding this is environmental with no clean fix
available:

| Attempt | Mechanism | Result |
|---|---|---|
| Mock `persistence/prisma.ts` entirely in `test/setup.ts` (matching the existing `CharacterService`/`ObjectiveRepository` mock convention) | Would eliminate all real `PrismaClient` creation in tests | **Rejected — breaks real behavior.** `CharacterRepository` defaults to the real `prisma` singleton (`import { prisma as defaultPrisma } from "../prisma"`), and `TownRoom`/`CombatRoom` construct `new CharacterRepository()` (no override) on every join, for real character-location/HP/flask persistence. A throwing-proxy mock immediately surfaced `prisma.character was accessed` failures in 8 test files. Investigating *why* it wasn't already failing revealed the actual surprise: `.env.development` points at a real local Postgres (`localhost:5432`), confirmed reachable (`PORT 5432 REACHABLE`) — the test harness's own doc comment ("it does not stand up a database") is inaccurate on a machine with a local dev DB already running; these tests silently depend on it today. |
| Cache the client on `globalThis` in `prisma.ts` (survive-isolation singleton pattern) | If `globalThis` is shared across Vitest's per-file module resets, only one real client would ever be created | **Rejected — doesn't work.** Empirically disproven with the same instrumentation: 13 separate `createPrismaClient()` calls still fired despite the cache, confirming Vitest's `isolate: true` gives each test file a genuinely distinct global scope even within the same worker-thread process (same `process.pid`, different effective `globalThis`) — this is itself a useful technical finding, since it means the common Next.js-style "cache the singleton on globalThis" pattern does **not** carry over to Vitest's default per-file isolation. |
| Set `isolate: false` in `vitest.config.ts` | Disables Vitest's per-file module-registry reset entirely, so `prisma.ts`'s module-level singleton behaves like a normal Node singleton (evaluated once) | **Dedup confirmed working** (probe showed exactly 1 `createPrismaClient()` call for the whole run) **but rejected — far too broad.** Broke 19 of 23 test files immediately (`19 failed | 4 passed`), almost certainly from sharing more than just the Prisma module across files — likely Colyseus's static room-definition/registration state or `vi.mock` hoisting scope bleeding across files that were never designed to share a module registry. Vitest's own docs already flag `isolate: false` as generally discouraged for exactly this class of cross-file state leakage. |
| Explicit `await prisma.$disconnect()` in a global `afterAll` (`test/setup.ts`) | Give the Node-API engine a deterministic, awaited shutdown per file instead of relying on GC-timed abandonment | **Rejected — no measurable improvement.** Ran the full suite 6 times with this in place: 4 clean passes, 2 crashes (33%) — not a statistically meaningful improvement over the ~60–65% crash rate observed in the immediately preceding, unfixed 0.17 session (small samples on both sides, so this comparison is directional, not rigorous). More tellingly, **one of the two crashes with this fix in place was a hard segfault during a later file's fresh `PrismaClient` *construction*, with zero prior panic/disconnect-related output** — proof the instability isn't confined to "cleanup happens too late," and an explicit-disconnect fix targeting only that theory can't address it. |

All three attempts were reverted; the working tree is back to its
pre-investigation state (confirmed via `git diff` showing no residual
changes to `prisma.ts`, `test/setup.ts`, or `vitest.config.ts` beyond
what 0.13–0.17 already introduced).

## 6. Conclusion

This is a **confirmed, checked** instance of Prisma's own documented
Node-API-engine instability under repeated `PrismaClient`
creation/teardown within a single process — not a guess, and not caused
by this repo's test content. The specific trigger in this codebase is
`TownRoom.ts`'s static import chain reaching the `prisma.ts` singleton,
combined with Vitest's default per-file module isolation creating one
real, unused-in-practice `PrismaClient` per test file (21 per full run).
No fix tried eliminates it without an unacceptable trade-off:
eliminating the real client breaks genuine DB-backed join behavior;
deduplicating it either doesn't survive Vitest's isolation model
(`globalThis`) or requires disabling isolation outright, which breaks
unrelated test state (`isolate: false`); and forcing earlier cleanup
doesn't touch the underlying native race (`$disconnect()`).

**Recommendation, not applied this session** (out of scope for a
same-day fix; flagged for a future build if the flake becomes disruptive
enough to prioritize): the architecturally correct fix is to stop
letting `vendorBuyItem.ts`/`vendorSellItem.ts`/`stashTransferItem.ts`/
`pickupWorldLootInventory.ts` reach for the `prisma.ts` module-level
singleton implicitly, and instead have `TownRoom`/`CombatRoom`
dependency-inject one real `PrismaDatabaseClient` (constructed once, in
`createRealtimeServer.ts`/the test harness) into every repository that
needs it — the same pattern `CharacterRepository`'s constructor already
supports (`PrismaDatabaseClient` parameter with a default). That's a
real refactor across ~7 files, not a config tweak, so it wasn't
attempted in this investigation session.

**Until then**: treat this as a known, occasional local-Windows-dev
flake. On a crash, just re-run `pnpm --filter @doomscrolls/server test`
— every crash observed across this investigation (and the 0.15/0.16/0.17
sessions before it) resolved on retry, and CI is unaffected since it
doesn't run on Windows.

---

## 7. Follow-up: is the test suite actually DB-dependent? (2026-09-02)

§5's mocking-attempt row said: *"no test sends a vendor-buy/sell,
stash-transfer, world-loot-pickup, or equip/unequip request"* and
concluded the real `prisma` client was "never for any code path these
tests actually exercise." **That statement is wrong for `TownRoom`
tests, and this section corrects it.** It was true only for the four
specific modules named there (`vendorBuyItem`/`vendorSellItem`/
`stashTransferItem`/`pickupWorldLootInventory`) — but those aren't the
only real, un-mocked consumers of the `prisma` singleton, and one of
the others turned out to be load-bearing.

### 7.1 Every module that imports the real `prisma` singleton

Beyond the four named in the original investigation, `prisma.ts` is
imported by 13 more modules (confirmed by grep, not assumed):

```
apps/server/src/auth/AuthService.ts
apps/server/src/character/CharacterService.ts          <- mocked in test/setup.ts
apps/server/src/character/EquipmentService.ts
apps/server/src/persistence/mappers/characterMapper.ts
apps/server/src/persistence/repositories/CharacterRepository.ts
apps/server/src/persistence/repositories/CorpseRepository.ts
apps/server/src/persistence/repositories/InventoryRepository.ts
apps/server/src/persistence/repositories/ItemRepository.ts
apps/server/src/persistence/repositories/ObjectiveRepository.ts        <- mocked in test/setup.ts
apps/server/src/persistence/repositories/ProfileRepository.ts
apps/server/src/persistence/repositories/SessionRepository.ts
apps/server/src/persistence/repositories/SettingsRepository.ts
apps/server/src/persistence/repositories/UserRepository.ts
```

All of them follow the same pattern: `constructor(private readonly db:
PrismaDatabaseClient = defaultPrisma)` — a real client by default unless
a test explicitly overrides it. `CharacterService` and
`ObjectiveRepository` are the two that are actually mocked; every other
one on this list is real in every test that reaches it.

The one that matters: **`CharacterRepository`**. `TownRoom.onJoin`
unconditionally calls, on *every* join, no gating, no feature flag:

```ts
// apps/server/src/realtime/rooms/TownRoom.ts:872
const persistedFlaskState = await new CharacterRepository().findCurrentFlaskChargesForUser(
  characterId,
  resolvedUserId,
);
```

`new CharacterRepository()` with no override uses the real, default
`prisma` client. This is not a rarely-hit corner case like
vendor/stash/pickup — it is the very first thing `TownRoom.onJoin` does
after join validation succeeds, for every single test that joins a
`TownRoom`.

`CombatRoom.onJoin`, by contrast, does **not** call `CharacterRepository`
directly — its only real-repository usage
(`CharacterRepository`/`ItemRepository` inside a local
`applyProgressionUpdate` helper, used for XP-driven stat recalculation)
is gated behind `tryResolveLevelProgression` succeeding, which none of
the current combat test fixtures' kill/XP amounts trigger. That part of
the original investigation's claim holds for `CombatRoom`.

### 7.2 Tested directly: stop Postgres (or point `DATABASE_URL` at nothing) and re-run

Rather than trace every branch by reading, this was verified by actually
breaking DB connectivity and running the real suite, twice, two
different ways:

**Run A — `DATABASE_URL` pointed at an unreachable host**
(`postgresql://doomscrolls:wrongpass@127.0.0.1:59999/doomscrolls`,
simulating "a DB exists but isn't reachable right now"):

```
Test Files  8 failed | 15 passed (23)
```

Representative failure (`test/town/skillSlotClassResolution.test.ts`):
```
Invalid `this.db.character.findFirst()` invocation in
C:\...\apps\server\src\persistence\repositories\CharacterRepository.ts:90:30
  89 public findCurrentFlaskChargesForUser(characterId: string, userId: string) {
→ 90   return this.db.character.findFirst(
Can't reach database server at `127.0.0.1:59999`
    at TownRoom.onJoin (...\TownRoom.ts:872:33)
```

**Run B — `DATABASE_URL` set to an empty string** (simulating a fresh
checkout with no `.env` file at all — see §7.3 for why this is the
*actual* condition on a fresh CI runner, not a hypothetical):

```
 Test Files  8 failed | 15 passed (23)
      Tests  9 failed | 25 passed (34)
```
Same 8 files, now failing instantly (60–70ms instead of ~2s) with a
harder, deterministic error instead of a network timeout:
```
PrismaClientInitializationError:
Invalid `this.db.character.findFirst()` invocation in
...\CharacterRepository.ts:90:30
error: Error validating datasource `db`: You must provide a nonempty URL.
The environment variable `DATABASE_URL` resolved to an empty string.
  --> schema.prisma:7
```

**The exact 8 failing files, both runs, identically:**
```
test/town/basicAttackDamage.test.ts
test/town/combatHandoffPositionPersistence.test.ts
test/town/concurrentObjectiveSlots.test.ts
test/town/incomingDamageMitigation.test.ts
test/town/objectiveTurnInRace.test.ts
test/town/primarySkillSlotParity.test.ts
test/town/repeatableObjective.test.ts
test/town/skillSlotClassResolution.test.ts
```
— exactly, and only, the 8 files that call `joinOrCreate("town", ...)`.
Every one of the 12 `test/combat/*.test.ts` files (which join
`"combat"` only) passed cleanly in both runs, with no errors or
warnings, alongside the 3 non-room files
(`test/content/contentRegistryValidation.test.ts`,
`test/content/skillSlotClassResolution.test.ts`,
`test/character/characterStatsService.test.ts`). After restoring
`DATABASE_URL` (no override — the real local Postgres was never
touched, still running throughout), a normal `pnpm --filter
@doomscrolls/server test` passed 23/23 files again on the next attempt
(first attempt hit the already-documented unrelated napi-ref crash,
retried clean — consistent with §2–§5, not a new issue).

### 7.3 Does root `pnpm test` (what `ci.yml` runs) actually reach this suite?

**Yes — confirmed, not assumed.** Traced the full chain:
- `.github/workflows/ci.yml`'s `Test` step runs `pnpm test`.
- Root `package.json`: `"test": "pnpm -r test"`.
- `pnpm-workspace.yaml` includes `apps/*`, so `apps/server` is in scope
  for `-r` with no filter/exclusion anywhere (no `turbo.json`/`nx.json`
  in the repo — this is a plain pnpm recursive fan-out).
- `apps/server/package.json`: `"test": "vitest run"` — unconditional,
  no env-gating, no `--passWithNoTests` guard, nothing that would make
  it silently skip.

So `apps/server`'s suite is not skipped or excluded — it runs in full,
every CI invocation.

**And `DATABASE_URL` would be empty on that CI runner**, matching Run B
above exactly, not Run A: `.env.development` is gitignored
(`.gitignore:6`) and confirmed **not tracked** (`git ls-files` shows
only `.env.example`, `apps/server/.env.example`, and a deliberately
renamed `apps/server/.env.disabled` — no live `.env`/`.env.development`
file exists anywhere in the repo). `ci.yml` defines no `env:` block, no
`services:` (no Postgres container), and references no secrets. There
is nothing that would populate `DATABASE_URL` on a fresh checkout.

**This was verified locally, not on an actual GitHub Actions runner** —
this session has no way to inspect this repo's real Actions run history
or logs. Run B (`DATABASE_URL=""`) is a faithful reproduction of the
fresh-checkout condition, and its failure mode (a synchronous
`PrismaClientInitializationError` from Prisma's own schema validation,
not a network-dependent timeout) is deterministic, not something that
could vary between a local repro and a real CI runner. If CI is
currently green, something not visible from this repo's checked-in
config must be supplying `DATABASE_URL` (e.g., a workflow-level
repository secret/variable configured in GitHub's UI rather than in
`ci.yml` itself) — worth confirming directly in the GitHub Actions UI,
since it can't be confirmed from the repo alone.

### 7.4 Conclusion — the named gap

**The suite is not hermetic.** Contrary to `test/setup.ts`'s own
docstring ("it does not stand up a database... every other repository
stays real but unused in these tests' code paths"), **8 of 23 test
files require a live, reachable Postgres to pass**, via
`CharacterRepository.findCurrentFlaskChargesForUser`, called
unconditionally from `TownRoom.onJoin`. This is not the narrower
concern raised during the crash investigation (vendor/stash/pickup) —
those really are unused, exactly as originally found — but it is a
real, previously-undocumented gap, and precisely because `TownRoom`
tests currently pass locally (this developer's machine has a live dev
Postgres always running), the gap was invisible until deliberately
tested.

**Named, not fixed** (per this task's scope — the dependency-injection
refactor already scoped in §6 is the real fix, not attempted here):

| # | Test file | DB-dependent? | Why |
|---|---|---|---|
| 1 | `test/town/basicAttackDamage.test.ts` | **Yes** | joins `TownRoom` |
| 2 | `test/town/combatHandoffPositionPersistence.test.ts` | **Yes** | joins `TownRoom` |
| 3 | `test/town/concurrentObjectiveSlots.test.ts` | **Yes** | joins `TownRoom` |
| 4 | `test/town/incomingDamageMitigation.test.ts` | **Yes** | joins `TownRoom` |
| 5 | `test/town/objectiveTurnInRace.test.ts` | **Yes** | joins `TownRoom` |
| 6 | `test/town/primarySkillSlotParity.test.ts` | **Yes** | joins `TownRoom` |
| 7 | `test/town/repeatableObjective.test.ts` | **Yes** | joins `TownRoom` |
| 8 | `test/town/skillSlotClassResolution.test.ts` | **Yes** | joins `TownRoom` |
| — | all 12 `test/combat/*.test.ts` files | No | join `CombatRoom` only; its onJoin never calls `CharacterRepository`, and none of these fixtures' XP grants trigger the gated `applyProgressionUpdate` path |
| — | `test/content/*.test.ts`, `test/character/*.test.ts` (3 files) | No | never boot a room at all |

If a future session wants CI reliability confirmed (rather than
inferred from config, as done here), the direct way is to check this
repo's actual GitHub Actions run history for the `apps/server` test
step, or to temporarily add `echo "DATABASE_URL=[$DATABASE_URL]"` to
`ci.yml` on a throwaway branch and observe a real run.

**Correction (§8):** the "none of these fixtures' XP grants trigger the
gated `applyProgressionUpdate` path" claim above turned out to be
imprecise — 4 of the 12 `combat/*.test.ts` files *do* trigger it (see
§8.1). It doesn't change this table's practical conclusion (those 4
files' DB calls are fire-and-forget and don't affect whether the test
passes without a DB — confirmed in §8.3), but the mechanism description
here was incomplete. Left uncorrected in place above; corrected here
instead of silently rewritten.

---

## 8. Resolution attempt: the dependency-injection refactor (2026-09-02)

Per §6's recommendation, the client is no longer an eagerly-constructed
module-level singleton. `persistence/prisma.ts`'s
`export const prisma = createPrismaClient()` (a real `new PrismaClient()`
that ran on every import) was replaced with `getSharedPrismaClient()`, a
lazily-cached factory: the client is only actually constructed the first
time some call site needs one and doesn't supply its own override. All
17 modules that previously imported the eager singleton (9 repositories,
3 services, 1 mapper, 4 room-level transaction functions — the full list
from §7.1) were updated to import `getSharedPrismaClient` instead and
call it as their constructor/parameter default, preserving every
existing default-injection point (`CharacterRepository`,
`CorpseRepository`, `InventoryRepository`, `ItemRepository`,
`ObjectiveRepository`, `ProfileRepository`, `SessionRepository`,
`SettingsRepository`, `UserRepository`, `CharacterService`,
`EquipmentService`, `AuthService`, `characterMapper`'s two default
params) rather than removing them. `AuthService` additionally had a
latent bug fixed along the way: it received a `db` override parameter
but never stored it, and its own `register()` transaction reached for
the eager global singleton directly (`defaultPrismaClient.$transaction`)
regardless of what was passed in — now it stores `this.db` and uses it.
The 4 room-level functions (`vendorBuyItem`/`vendorSellItem`/
`stashTransferItem`'s two exports/`pickupWorldLootInventory`) gained a
new optional `db` field on their existing input-object parameter, since
they had no injection point at all before. No call site's *behavior*
changed — every one of them still resolves to a real, correctly
configured client when no override is given; this is purely about *when*
that client gets constructed and *whether* an override can be supplied.

### 8.1 Instance count: verified reduced, not eliminated

Re-ran the exact same instrumentation §3 used
(`process.stderr.write` inside `createPrismaClient()`). One full,
clean suite run: **12 real `PrismaClient` constructions, down from the
pre-refactor 21** (one per every room-booting file, unconditionally).
Each of the 12 constructs exactly once (the per-file lazy cache works
correctly — multiple repository instantiations within one test file
reuse the same cached instance, confirmed by no file appearing more
than once in the probe log).

The 12 are fully explained, not just counted:
- All 8 `test/town/*.test.ts` files — matches §7's finding exactly:
  `TownRoom.onJoin` unconditionally calls
  `CharacterRepository.findCurrentFlaskChargesForUser`.
- **4 `test/combat/*.test.ts` files**:
  `staticYardObjectiveCoverage`, `saltmereDocksObjectiveCoverage`,
  `combatZoneObjectiveCoverage`, `cinderworksObjectiveCoverage` — this
  is new information §7 got slightly wrong (see the correction above
  §8). Every one of these tests kills an enemy to prove objective
  progress, and `CombatRoom`'s kill handler unconditionally calls
  `grantEnemyDefeatXp` → `grantFlatXpReward` →
  `tryResolveLevelProgression`, which returns `ok: true` for *any*
  valid kill (not only ones that cross a level-up threshold — `ok`
  means "valid input," `leveledUp` is a separate field) → real
  `CharacterRepository`/`ItemRepository` use inside
  `applyProgressionUpdate`. The other 8 `combat/*.test.ts` files never
  land a killing blow (they test attack damage, dodge, flasks, skill
  casting, matchmaking, initial join stats, or the player's own death —
  not an enemy kill), so they correctly construct zero.
- The 3 `test/content/*.test.ts`/`test/character/*.test.ts` files never
  boot a room, so zero, as before.

**This confirms the stated goal — stop creating a real abandoned native
client for every room-booting test file regardless of use — was
achieved precisely.** 9 of 21 previously-wasteful constructions are
gone.

### 8.2 Crash rate: measured, and it got worse, not better

This is the part that must be reported plainly rather than spun.
**23 full-suite runs were executed after applying the refactor: 20
crashed (87%), 3 passed (13%)** — worse than the pre-refactor 0.18
baseline of 5 crashed / 9 runs (56%). Every crash matched the exact
same signatures already documented in §1 (the `failed to delete napi
ref` panic, and the plain `0xC0000005` segfault with no panic text).

The mechanism, confirmed by direct experiment rather than guessed: the
crash is not simply proportional to *total* instance count across a
run — it correlates specifically with **two real client constructions
happening back-to-back, in immediate succession, with no other test
file's teardown time in between.** Before the refactor, virtually every
adjacent pair of room-booting files was such a transition (21 of 23
files constructed one), so risky transitions were spread evenly across
the whole run. After the refactor, only 12 of 24 files construct one,
and — an accident of alphabetical file-collection order, not a
deliberate choice — 4 of those 12 (`staticYardObjectiveCoverage` →
`saltmereDocksObjectiveCoverage` → `combatZoneObjectiveCoverage` →
`cinderworksObjectiveCoverage`) land consecutively in
`test/combat/*ObjectiveCoverage.test.ts`, with **zero** non-constructing
files between any of them. That dense run of back-to-back constructions
is where every single one of the 20 crashes hit (confirmed exact tail
output on every crashed run) — 17 at the panic between two of those four
files specifically, 3 as a segfault at a different nearby boundary in
the same session (not always the identical file pair, but always within
this same tightly-packed stretch, or in one case among the equally
dense 8-file `test/town/` cluster).

**Directly verified, not inferred:** running *only* those 4 files in
isolation (`vitest run "combat/staticYardObjectiveCoverage"
"combat/saltmereDocksObjectiveCoverage" "combat/combatZoneObjectiveCoverage"
"combat/cinderworksObjectiveCoverage"`) reproduced the identical panic
2 times out of 3 attempts — the same ~87% rate the full suite showed,
in a fraction of the runtime. This is conclusive: **the refactor
correctly reduced total wasted instance creation, but by concentrating
the remaining real constructions into a dense, gap-free cluster instead
of spreading them across the run (an artifact of which test files
happen to be alphabetically adjacent, not something either this
refactor or the previous investigation controlled for), it made the
practical, measured crash rate meaningfully worse, not better.**

### 8.3 §7's DATABASE_URL-unreachable finding: unchanged, confirmed directly

Re-ran both variants from §7.2 against the post-refactor code.

`DATABASE_URL=""` (empty, the fresh-CI-checkout condition):
```
Test Files  8 failed | 16 passed (24)
     Tests  9 failed | 26 passed (35)
```
**Exactly the same 8 `test/town/*.test.ts` files fail**, by name, for
the same reason (`TownRoom.onJoin` awaits
`CharacterRepository.findCurrentFlaskChargesForUser` directly, so a
`PrismaClientInitializationError` there rejects the whole join). File
and test counts are +1/+1 versus §7's original 23/34 only because 0.18
added a 24th test file (`saltmereDocksObjectiveCoverage.test.ts`) in
between — unrelated to this refactor.

One new, worth-noting detail this pass surfaced: **the 4 combat
objective-coverage files that §8.1 showed *do* touch a real
`CharacterRepository`/`ItemRepository` still pass cleanly with an empty
`DATABASE_URL`** — not a contradiction, but a real difference in how
their DB call is reached. `CombatRoom`'s kill handler calls
`void grantEnemyDefeatXp(...)` — fire-and-forget, the returned promise
is never awaited by the caller. When the DB call inside it rejects, it
becomes an unhandled promise rejection, not a failure the test's own
`await waitForMessage(...)` observes; the test's actual assertions
(objective progress) never depend on that background call succeeding.
`TownRoom.onJoin`'s `await
CharacterRepository.findCurrentFlaskChargesForUser(...)`, by contrast,
is directly awaited in the join path with no fire-and-forget wrapper,
so its rejection correctly fails the join and the test. **This confirms
task requirement 3 precisely: the refactor changed nothing about which
code paths depend on a real, reachable database at runtime, or why —
only how the client object each of those paths ends up using gets
constructed.**

### 8.4 Verdict and recommendation

**Correctness:** `pnpm -r typecheck` clean across all 5 workspace
packages; full suite passes (24 files / 35 tests) whenever it doesn't
hit the native crash, exactly as before the refactor. No test's
assertions changed, no DB-dependent behavior changed (§8.3).

**The stated goal (§7.1's instance-count reduction) was achieved and
directly verified.** The practical goal implied by the whole
investigation — fewer local Windows crashes — **was not achieved; the
measured crash rate is worse (87% vs. 56%)**, for a specific, confirmed
reason (dense clustering of the remaining constructions, not a flaw in
the DI pattern itself). This is a genuine trade-off, not a bug to fix
with more code: the DI refactor is architecturally correct on its own
merits (no more phantom client construction for tests that never touch
the DB, a real injection point for future tests that want a mock, a
latent `AuthService` bug fixed along the way) independent of whether it
helps this specific native-engine instability, and the clustering that
makes it worse today is an accident of which test files happen to sort
adjacently — it would shift (for better or worse) the moment any test
file is added, renamed, or reordered, which is not a stable property to
build a further fix around.

**No further code changes were made past this point in this session** —
reverting the refactor, keeping it as-is, or pursuing a different
mitigation (e.g., spacing out DB-touching test files, which is a fragile
ordering hack rather than an architectural fix) is a real trade-off
decision, not a technical one this investigation can resolve on its
own.

---

## 9. De-clustering attempt: a custom test sequencer (2026-09-02)

Per the follow-up request: sequence the 4 `*ObjectiveCoverage.test.ts`
combat files (`staticYardObjectiveCoverage`,
`saltmereDocksObjectiveCoverage`, `combatZoneObjectiveCoverage`,
`cinderworksObjectiveCoverage` — the only `combat/` files that
construct a real client, per §8.1) so they never run back-to-back with
zero gap, without touching the other 8 `combat/*.test.ts` files that
construct zero clients.

### 9.1 What was built

`apps/server/test/support/dbClusterAwareSequencer.ts` — a
`DbClusterAwareSequencer` class extending Vitest's `BaseSequencer`
(`vitest/node`), wired in via `test.sequence.sequencer` in
`vitest.config.ts`. This is Vitest's documented extension point for
controlling file execution order, chosen over the alternatives named
in the task specifically because it needed no file renaming (fragile,
and §8.4 explicitly flagged file-sort-order fragility as a reason not
to build a fix around it) and no separate project/pool split (this
suite already runs `fileParallelism: false`, `pool: "threads"` for
reasons unrelated to this problem — see the config's own comments — so
splitting into a second sequential project would have meant two
separate Colyseus-port-allocation and setup-file wiring passes for a
problem that's really just about *order*, not concurrency).

One real complication surfaced while building this:
**`BaseSequencer.sort()` is not alphabetical** — reading its actual
implementation (`vitest/dist/chunks/coverage.*.js`) shows it orders by
Vitest's own test-result cache (`run failed first`, then `run longer
first`, falling back to `run larger files first` / `run unknown first`
by file size when no duration cache entry exists yet). This means the
"file order" observed throughout this whole investigation (§2, §8) was
never a fixed property of the file tree — it's the *converged* order
after many repeated runs in the same session stabilized the duration
cache, which is why it looked deterministic. The sequencer therefore
does not hardcode any position or assume a fixed base order: it calls
`super.sort()` fresh each time, then finds "safe gaps" (positions where
neither neighbor is a known DB-touching file) dynamically in whatever
order comes back, and inserts the 4 targets into gaps spread evenly
across the available ones. Every other file's relative order is left
exactly as `super.sort()` produced it — the implementation only ever
inserts the 4 targets into existing gaps; it never reorders two
non-target files relative to each other, which is what "don't touch
the other 8 combat files" (and, by the same logic, don't touch the 8
`town/` files' relative order either) required.

### 9.2 Verified: the targets are structurally correctly spread

Confirmed directly from real run output, not assumed. A representative
observed order (`seq_fix_run_8.log`, the one clean pass in the
9-run sample below):
```
 1. town/incomingDamageMitigation      6. town/repeatableObjective      11. combat/zoneMatchmaking
 2. combat/incomingDamageMitigation    7. town/concurrentObjectiveSlots 12. combat/staticYardObjectiveCoverage  <- target
 3. town/objectiveTurnInRace           8. town/basicAttackDamage        13. combat/primarySkillSlot
 4. town/combatHandoffPositionPers.    9. town/primarySkillSlotParity   14. combat/skillSlotCasting
 5. combat/deathReturnsToTown         10. town/skillSlotClassResolution 15. combat/cinderworksObjectiveCoverage <- target
                                                                         16. combat/healingFlaskIntent
                                                                         17. combat/basicAttackDamage
                                                                         18. combat/dodgeIntent
                                                                         19. combat/saltmereDocksObjectiveCoverage <- target
                                                                         20. combat/joinInitialStats
                                                                         21. combat/combatZoneObjectiveCoverage  <- target
```
Every target has at least one non-target file on both sides (positions
11/13 around 12; 14/16 around 15; 18/20 around 19; 20/end around 21).
Confirmed across every run in the sample below, not just this one: the
4 targets never once landed adjacent to each other or to an
immediately-preceding/following `town/` file. **The sequencer does
exactly what it was asked to do.**

### 9.3 Crash rate: measured, and unchanged within noise

9 full-suite runs (matching the sample size used for every prior
measurement in this investigation): **8 crashed (89%)**. For context:
56% pre-DI-refactor baseline (§2/§8), 87% post-DI-refactor / pre-this-fix
(§8.2). **89% is not a meaningful improvement over 87% — the
de-clustering fix, though structurally verified correct, did not move
the crash rate.** Reported plainly, not spun: this is a second fix
attempt in this investigation that achieved its literal, narrow goal
(§8's DI refactor cut real instance count; this sequencer cut
target-target adjacency) without achieving the outcome that goal was a
means to.

### 9.4 Why: the crash tracks a specific file, not proximity to another DB file

This is the useful discovery from verifying rather than assuming success.
Tallied the last-passing file immediately before every crash observed
during this fix's verification (12 runs: the 4 used to confirm ordering
in §9.2's development, plus the 9-run sample in §9.3):

| Last file before crash | Count |
|---|---|
| `combat/cinderworksObjectiveCoverage.test.ts` | 4 |
| `combat/staticYardObjectiveCoverage.test.ts` | 3 |
| `combat/saltmereDocksObjectiveCoverage.test.ts` | 3 |
| `combat/deathReturnsToTown.test.ts` (not a target) | 1 |

**11 of 12 crashes (92%) landed immediately after one of the 4 target
files specifically — regardless of what file the sequencer placed
next**, including runs where 2-3 non-DB files separated that target
from the next DB-touching file. This is evidence *against* §8's working
theory ("two real client constructions back-to-back, no gap, is the
trigger") as the *complete* explanation: if adjacency-to-another-DB-file
were the whole story, spacing them out (§9.1-9.2, verified working)
should have reduced the rate. It didn't. What's common to all 4 targets
and largely absent from the 9 non-crashing `combat/` files and the
`town/` files is not "runs near another DB file" but **something about
each target's own execution** -- and every one of these 4, specifically,
kills an enemy and triggers `CombatRoom`'s `void
grantEnemyDefeatXp(...)` (§7.1, §8.3): a **fire-and-forget** call whose
promise is never awaited by the room, meaning the test's own
`afterEach`/`afterAll` (`colyseus.cleanup()` / `.shutdown()`) can tear
the room and its Prisma-touching code down while that background
promise is still in flight. A native client reference being torn down
while a call into it is still suspended is a very plausible match for
"failed to delete napi ref" -- more specific and more consistent with
this data than generic multi-instance proximity. (The one
non-target crash, after `deathReturnsToTown.test.ts`, and earlier
sessions' town-cluster crashes, show this isn't the *only* contributing
factor -- the DI refactor's own instance-count reduction and the
town cluster's density plausibly still matter -- but it's the
best-supported single factor found so far.)

**This was not tested further in this session** (no source change was
made to await that call — see §9.5) — it is a correlation from 11
observations, not a proven cause, and confirming it would mean changing
production behavior (making the XP-grant call blocking instead of
fire-and-forget), a real trade-off outside a mechanical "run it and see"
check.

### 9.5 The fire-and-forget question: elevated, not just noted

The task asked whether the fire-and-forget gap (§8.3: these 4 tests
pass under an empty `DATABASE_URL` specifically *because* their DB call
is never awaited) is worth fixing or just worth naming. Given §9.4's
finding, the honest answer changed while investigating it:

**This looks like the more promising lead for the crash itself, not
just a test-correctness nit.** Recommended next step for a future
session, not attempted here: `await` (or otherwise ensure completion
of) `grantEnemyDefeatXp`'s call before a test's own teardown proceeds
— either by having `CombatRoom` await it directly (a production
behavior change: the kill-response message would no longer return
before the XP grant completes, which needs its own evaluation of
whether that's acceptable) or, more conservatively, by having only the
test harness's `afterEach` wait for any in-flight fire-and-forget work
before calling `colyseus.cleanup()`. Either would directly test §9.4's
hypothesis in a way file reordering cannot, since reordering can't
change what happens to an already-in-flight, un-awaited promise when
its own file's room gets torn down out from under it.

### 9.6 Verdict

`pnpm -r typecheck` clean; full suite passes (24 files / 35 tests, e.g.
`seq_fix_run_8.log`) whenever it doesn't hit the crash — no test's
assertions or DB-dependent behavior changed by adding the sequencer.
The sequencer itself is kept in the working tree: it does exactly what
it claims (verified in §9.2), is a small, self-contained, well-commented
~100 lines with no effect on any file's content or behavior, and even
though it didn't move the crash rate, it's a strictly-better ordering
than the accidental zero-gap cluster it replaced, at effectively zero
cost or risk to keep. It should not, however, be presented as having
solved the crash — §9.3's number says it didn't, and §9.4 points at a
different, more specific mechanism worth testing next instead of
further ordering attempts.

---

## 10. Third attempt: awaiting the fire-and-forget call — this one worked (2026-09-02)

Per §9.5's lead: test-scope-only, made the 4 target files' triggered
`void grantEnemyDefeatXp(...)` call (§7.1, §8.3, §9.4 — `CombatRoom`'s
enemy-kill XP grant, fired without being awaited) actually finish
before each test's own teardown runs, and measured the crash rate
again. This is the third and, per the brief, last attempt at this
specific crash before treating it as an accepted flake.

### 10.1 First approach tried, and why it had to change

The obvious, most precise way to await a fire-and-forget call from a
test with zero production changes is to wait for the server message it
sends on success — `CombatRoom` already emits `"xp_gained"` only after
`applyProgressionUpdate` resolves. Registered
`waitForMessage<XpGainedServerMessage>(client, "xp_gained")` in all 4
files, alongside the existing `request_attack_accepted` /
`objective_updated` waits, and awaited it after the objective
assertion.

**This made all 4 tests fail with a hard timeout — `xp_gained` never
arrives at all.** Investigating why (not assuming): these tests' fixed
fixture ID (`TEST_CHARACTER_ID = "test-character-1"`,
`test/support/fixtures.ts`) is not a real row in the local dev
Postgres — `CharacterService` is mocked in `test/setup.ts` and never
inserts one, and nothing else in this suite does either.
`CharacterRepository.findProgressionContext(player.characterId)`
therefore resolves to `null`, `applyProgressionUpdate` returns
`{ ok: false }`, and `grantFlatXpReward` returns *before* ever calling
`sendToClient` — so `"xp_gained"` is never sent, in any of these 4
tests, ever. Confirmed directly (not inferred) by trying to await it
and watching it time out identically in all 4 files.

This means the fire-and-forget call still does real work in these
tests (one genuine `SELECT`-equivalent Prisma query against the real
database) — it just resolves to "character not found" and exits before
reaching the write/send path. There is no success signal to wait for,
so the precise message-based approach doesn't apply here; a
generic flush was needed instead.

### 10.2 What was built: a delay-based flush, test-scope only

`apps/server/test/support/flushPendingDbWork.ts` — a
`flushPendingDbWork(delayMs = 250)` helper: `await new Promise(resolve
=> setTimeout(resolve, delayMs))`. Called once, after the existing
objective assertion, in each of the 4 target test files
(`staticYardObjectiveCoverage`, `saltmereDocksObjectiveCoverage`,
`combatZoneObjectiveCoverage`, `cinderworksObjectiveCoverage`) — the
only change to those files beyond adding the import. 250ms is
generous relative to the single real DB round-trip involved (this
suite's own DB-unreachable timeouts in §7.2 resolved in 60-70ms once
the query actually ran). No other test file was touched. **Production
code is completely unchanged** — `CombatRoom.ts` still fires
`grantEnemyDefeatXp` with `void`; this only changes when these 4
specific tests' own teardown proceeds, not what the room does.

### 10.3 Measured: crash rate dropped from 89% to ~7%

**Primary 9-run sample (same discipline as every prior measurement in
this investigation): 9 of 9 passed. 0 crashes.** Compared to the 87%
(§8) and 89% (§9) measured immediately before this fix, on the same
machine, in the same session, using the same command.

Given how decisive a clean 9/9 looked against a run of measurements
that had never previously dropped below 56%, 6 more runs were added
for extra confidence rather than stopping at the minimum: **15 runs
total, 14 passed, 1 crashed (~93% pass / ~7% crash)**. That one crash
(`flush_test_run_10.log`, a plain segfault, `0xC0000005`, no panic
text — the second crash shape from §1) is itself informative: it
happened **after `combat/primarySkillSlot.test.ts`**, a file that
constructs zero real `PrismaClient` instances and has no connection
to the fire-and-forget path at all — the first crash in this entire
investigation that did *not* immediately follow one of the 4 target
files (§9.4 found 11 of 12 prior crashes did). This reads as
background-rate native-engine flakiness unrelated to the mechanism
this investigation has been chasing, not a sign the fix is
incomplete — consistent with the "occasional" characterization §6
used for the crash *before* it climbed to 56%+ across 0.16-0.18.

### 10.4 Conclusion: root-caused, for real, this time

The evidence chain is complete and consistent, not just a single good
sample:
- §9.4 found 11 of 12 crashes landed immediately after one of these 4
  specific files, regardless of what ran next (ruling out simple
  file-adjacency as the mechanism, since §9's spacing fix didn't help).
- §10.1 confirmed those 4 files are exactly the ones whose enemy-kill
  path fires a real, un-awaited, in-flight-at-teardown-time DB call.
- §10.3: giving that specific call time to finish before teardown, and
  nothing else, took the crash rate from 89% to ~7% — matching the
  original "occasional" baseline, not the elevated one this
  investigation was chasing.

This is a real fix, verified by measurement exactly as demanded, not
declared on theory. The changes are kept in the working tree: the 4
test files' one-line addition each, plus `flushPendingDbWork.ts`.

### 10.5 Flagged, not fixed: the same pattern exists in production

Per the task: this is named for a future session, not acted on here.
`CombatRoom.ts`'s `void grantEnemyDefeatXp(...)` (and the structurally
identical `void new ObjectiveRepository().updateProgress(...)` calls
right next to it, same file, same fire-and-forget shape) run in
production exactly the same way they ran in these tests before this
fix — fired without being awaited, with nothing guaranteeing they
finish before whatever happens next. In production the DB call
involved does more, not less, work than in these tests (a real
character row exists, so the call reaches all the way to a write and a
`sendToClient`, rather than exiting early on a null lookup) — meaning
more time in flight, not less, for a room shutdown (player disconnect,
empty-room cleanup, server restart) to race against it. This
investigation's crash signature is specific to Windows and the
Node-API query engine, so it isn't a claim that production hits the
identical crash — but "a fire-and-forget DB call can still be in
flight when its enclosing room is torn down" is the same structural
gap in both places, and is worth a deliberate look someday for its own
sake (a dropped or partially-applied XP grant, not just a crash), not
folded into this investigation's fix.

### 10.6 Status: closed

Three real attempts were made against this crash across this
investigation, each measured rather than assumed:
1. **Dependency-injection refactor (§8)** — reduced real client
   instantiation 21 → 12, verified with instrumentation; crash rate
   57% → 87% (worse, root cause: dense construction clustering).
2. **Custom test sequencer (§9)** — de-clustered the 4 highest-risk
   files, verified structurally correct; crash rate 87% → 89% (no
   change, root cause: not actually about adjacency).
3. **Fire-and-forget flush (§10)** — let the actual in-flight DB call
   finish before teardown, test-scope only; crash rate 89% → ~7%
   (**this one worked**).

**This investigation is closed.** The remaining ~7% residual rate
matches this crash's original, pre-escalation character — an
occasional, known, Windows-only, Node-API-engine flake (§4:
prisma/prisma#18577, #7814), never blocking on CI (doesn't run on
Windows, §7.3) and never blocking a clean local run for long (every
crash observed across all ten-plus sessions of this investigation
resolved on retry). Treat a crash from here on as exactly that: rerun
`pnpm --filter @doomscrolls/server test`. §10.5's production-side flag
was the one open, deliberately-not-pursued thread — closed below.

---

## 11. Production hotfix: §10.5's flag, actually fixed (2026-09-02)

§10.5 named, without fixing, that `CombatRoom.ts`'s `void
grantEnemyDefeatXp(...)` and `void new
ObjectiveRepository().updateProgress(...)` calls (enemy-kill XP and
objective-progress writes, fired without being awaited) have the same
write-not-settled-before-teardown shape §10 proved corrupts a native
client under test — in production, a room closing (zone travel,
disconnect, matchmaking routing) while one is still in flight can
silently lose the write or throw an unhandled rejection. That gap is
now closed.

**Fix** (`CombatRoom.ts` only, nothing else touched): a
`pendingWrites: Set<Promise<void>>` field plus a `trackPendingWrite()`
helper wraps each of the 4 call sites (2x `grantEnemyDefeatXp`, 2x
`ObjectiveRepository().updateProgress`, matching the basic-attack and
skill-cast kill paths). The hot path is unchanged — still fire-and-forget,
nothing newly awaited there. A failed write is logged (`log.error`,
not swallowed) rather than left as an unhandled rejection, and the
tracked promise still resolves either way so a failure can never hang
disposal. A new `onDispose()` (Colyseus awaits its return value before
finishing room teardown — confirmed by reading `@colyseus/core`'s
`Room#_dispose`/`#disconnect`, not assumed) awaits every still-pending
write before returning, so none is ever abandoned mid-flight.

**Verified**, not just implemented: new
`test/combat/pendingWriteFlushOnDispose.test.ts` mocks
`ObjectiveRepository.updateProgress` with a real 200ms delay (same
technique as `objectiveTurnInRace.test.ts`), triggers a kill, then
calls `room.disconnect()` immediately — before the write resolves —
and asserts the write had completed by the time `disconnect()`
returned. Confirmed this is a real ordering guarantee, not a
coincidence of timing, by reading `@colyseus/core`'s `Room.mjs`:
`disconnect()`'s returned promise only resolves once `#_dispose()`
does, and `#_dispose()` explicitly `await`s whatever `onDispose()`
returns before it does. Regression-checked: temporarily disabled the
`onDispose` wait, confirmed the test fails (`expected false to be
true` — the write was still mid-flight when disconnect returned, and
the reverted state also reproduced this investigation's own native
crash on the same run, corroborating §9/§10's mechanism from the other
side), restored, re-verified green. Two more things were checked at
the time and only hand-verified, not kept as permanent tests — closed
below in §11.1, per AGENTS.md's "Verification Must Be Permanent" rule.

### 11.1 Two follow-up closes (2026-09-02)

**1. The rejecting-write case, made permanent.** §11's own text above
said a rejecting write was "confirmed by hand... not kept as a
permanent test" — that gap is now closed. Added a second test to the
same file, `logs a rejected write and still completes disposal without
hanging`: mocks `updateProgress` to reject after a real 50ms delay,
tears the room down mid-flight the same way as the first test, and
asserts two things with real assertions rather than just "didn't
hang" — `room.disconnect()` still resolves, and
(spying on `createRoomLogger` via `vi.mock` + `vi.hoisted`, since the
real logger safely no-ops with nothing attached in this harness, which
would otherwise make "was it logged" unobservable) `log.error` was
actually called with the failing write's description. Regression-checked:
temporarily made `trackPendingWrite` swallow the rejection without
logging, confirmed the new test fails (`Number of calls: 0`) while the
other two tests in the file stay green, restored, re-verified all
three pass.

**2. Per-write pruning: already present, now proven, not just
asserted.** Checked `trackPendingWrite` directly: `void
tracked.finally(() => this.pendingWrites.delete(tracked))` already
prunes each write from the Set the moment it settles — nothing needed
fixing. But that claim wasn't actually exercised by any test (the
first test only ever checked the Set indirectly, via one write, right
before a dispose that would have cleared it either way). Added a
third test, `prunes each tracked write from the pending set as it
settles, not only in bulk at dispose`: kills 3 enemies in sequence in
one long-lived room (no mocked delay — this is about the Set shrinking
during normal operation, not a dispose race) and asserts
`pendingWrites.size` (read directly off the room instance via a cast,
`room as unknown as { pendingWrites: Set<...> }`) returns to exactly
`0` after each kill's writes settle. If pruning were missing — only
cleared in bulk at dispose — this would instead grow by 2 per kill (6
by the end) and never shrink; the real failure mode this guards
against for a room that stays open across many kills over a long
session. No code change was needed here, only the test — confirming a
correct design decision that had gone unverified rather than leaving
it as an untested assumption.

`pnpm -r typecheck` clean; full suite 25 files / 38 tests, all passing.

**Status: closed.** This was the last open thread from §10.5, and
these two closes are the last open threads from §11 itself. The
investigation that started at §1 with an unexplained Windows-only test
crash ends here having produced a real, verified production
correctness fix, not just a local-dev workaround.
