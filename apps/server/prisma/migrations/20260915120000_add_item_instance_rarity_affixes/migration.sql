-- Milestone 0.3 -- Server-Authoritative Item Rarity & Random Affix Engine
-- AlterTable
ALTER TABLE "ItemInstance" ADD COLUMN     "rarityTier" TEXT NOT NULL DEFAULT 'normal',
ADD COLUMN     "rolledAffixes" TEXT NOT NULL DEFAULT '[]';
