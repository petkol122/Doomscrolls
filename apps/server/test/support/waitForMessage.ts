/**
 * Waits for the next message of `type` on `client`, or rejects after
 * `timeoutMs`. Used to prove a message handler is actually registered and
 * responds -- the Core 0.7 CombatRoom skill-slot bug meant the client
 * would simply never hear back, which a plain "did it throw" check would
 * not have caught.
 */
export function waitForMessage<T = unknown>(
  client: { onMessage: (type: string, cb: (payload: T) => void) => () => void },
  type: string,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for message "${type}" after ${timeoutMs}ms`));
    }, timeoutMs);

    const unsubscribe = client.onMessage(type, (payload) => {
      clearTimeout(timeout);
      unsubscribe();
      resolve(payload);
    });
  });
}
