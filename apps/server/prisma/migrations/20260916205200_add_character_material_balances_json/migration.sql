-- Salvage-material currency balances (Iron Scrap / Arcane Dust), stored
-- as a JSON-encoded map like walletBalancesJson/professionsJson.
ALTER TABLE "Character" ADD COLUMN     "materialBalancesJson" TEXT NOT NULL DEFAULT '{}';
