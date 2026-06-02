import { PrismaClient } from "@prisma/client";

export type PrismaDatabaseClient = PrismaClient;

export function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

export const prisma = createPrismaClient();