-- Milestone 0.3 -- Multi-Currency Wallet Engine
-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "walletBalancesJson" TEXT NOT NULL DEFAULT '{}';
