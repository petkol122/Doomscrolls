import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Shared Prisma client type accepted by repositories and services.
 * Allows repositories to operate with either a full PrismaClient
 * or a transaction-scoped Prisma.TransactionClient.
 */
export type PrismaDatabaseClient = PrismaClient | Prisma.TransactionClient;

export function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

let cachedSharedClient: PrismaClient | undefined;

/**
 * Lazily constructs (once) and returns the process-wide shared Prisma
 * client. Every repository/service constructor and DB-touching
 * function defaults its `db` parameter to a call to this function
 * instead of an eagerly-constructed module-level singleton, so merely
 * importing this module -- or any module that imports it -- never
 * constructs a real client. A real `PrismaClient`, with its native
 * query-engine process, is only ever created the first time a call
 * site actually needs one and doesn't supply its own override.
 *
 * This was previously `export const prisma = createPrismaClient()`,
 * a top-level side effect that ran on every import. Under Vitest's
 * default per-file module isolation, every test file that merely
 * imported a room class (which transitively imports a repository,
 * which imported that singleton) constructed and abandoned its own
 * real native query-engine instance -- 21 per full suite run,
 * regardless of whether that specific test ever touched the database
 * -- which was the root cause of the Windows-only teardown crash
 * documented in docs/PRISMA_WINDOWS_TEARDOWN_CRASH_INVESTIGATION.md.
 * See that doc's §8 for the fix verification (instance count and
 * crash-rate before/after).
 */
export function getSharedPrismaClient(): PrismaClient {
  if (cachedSharedClient === undefined) {
    cachedSharedClient = createPrismaClient();
  }
  return cachedSharedClient;
}