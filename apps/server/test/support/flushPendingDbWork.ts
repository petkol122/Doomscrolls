/**
 * Core investigation §10
 * (docs/PRISMA_WINDOWS_TEARDOWN_CRASH_INVESTIGATION.md) -- test-scope-only
 * helper to let a fire-and-forget background DB call finish before a
 * test's own teardown runs.
 *
 * `CombatRoom`'s enemy-kill handler fires XP granting as `void
 * grantEnemyDefeatXp(...)` -- never awaited by the room. §9.4 found 11
 * of 12 observed native-engine crashes landed immediately after one of
 * the 4 test files that trigger this path, regardless of what ran next,
 * suggesting the crash may correlate with that background call still
 * being in flight when the test's `afterEach` (`colyseus.cleanup()`)
 * tears the room down.
 *
 * There is no server message to await here instead: with these tests'
 * fixture character id (`TEST_CHARACTER_ID` = a literal string, not a
 * real row in the local dev Postgres -- `CharacterService` is mocked
 * and never actually inserts one), `CharacterRepository
 * .findProgressionContext` resolves to `null`, so
 * `applyProgressionUpdate` returns `{ ok: false }` and the XP-grant
 * path returns without ever sending `xp_gained` -- confirmed directly
 * by trying to await that message first, which timed out every time.
 * The fire-and-forget call still makes one real query before returning,
 * though, and that's the DB round-trip this waits out.
 *
 * Production code is unchanged by this -- `CombatRoom` still fires the
 * call with `void`; this just keeps these 4 tests from proceeding to
 * teardown before that call has had time to finish, to test whether
 * that in-flight race is what the crash correlates with.
 */
export async function flushPendingDbWork(delayMs = 250): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
