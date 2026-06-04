import type { ServerLogger } from "../../config/logger";

/**
 * Minimal log surface used by room lifecycle handlers.
 *
 * Colyseus does not guarantee a logger is attached to a `Room` instance,
 * and the ambient `this.logger` is typed as `any` in the Colyseus types
 * we depend on. This helper narrows that to a small, callable surface
 * and silently no-ops when the underlying logger (or any specific
 * method on it) is missing.
 */
export type RoomLogger = Pick<ServerLogger, "debug" | "info" | "warn" | "error">;

/**
 * Wrap the optional, loosely-typed `this.logger` exposed on a Colyseus
 * `Room` into a small, safe-to-call surface. Returns an object whose
 * methods forward to the underlying logger when present and are
 * otherwise no-ops. Each method is independently guarded so a
 * partially-implemented logger (e.g. one missing `debug` in tests)
 * still works.
 */
export function createRoomLogger(rawLogger: unknown): RoomLogger {
  const logger = rawLogger as Partial<ServerLogger> | undefined;

  const forward =
    (level: "debug" | "info" | "warn" | "error") =>
    (obj: unknown, msg?: string): void => {
      const fn = logger?.[level];
      if (typeof fn === "function") {
        (fn as (o: unknown, m?: string) => void).call(logger, obj, msg);
      }
    };

  return {
    debug: forward("debug"),
    info: forward("info"),
    warn: forward("warn"),
    error: forward("error"),
  };
}
