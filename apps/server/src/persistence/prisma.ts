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

export const prisma = createPrismaClient();