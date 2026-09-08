/**
 * Polls `predicate` until it returns true, or throws after `timeoutMs`.
 *
 * Used for asserting eventual consistency of a client's replicated
 * schema state (e.g. "another session's presence has arrived over the
 * wire"), where the exact patch-arrival timing isn't worth pinning to a
 * specific event -- a poll is simpler and more robust than racing a
 * one-shot `onStateChange` subscription against a snapshot that may
 * already have arrived before the subscription was attached.
 */
export async function waitUntil(
  predicate: () => boolean,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const { timeoutMs = 3000, intervalMs = 20 } = options;
  const deadline = Date.now() + timeoutMs;

  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for condition to become true`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
