-- AlterTable
ALTER TABLE "Character" ADD COLUMN "flaskChargesJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Character" DROP COLUMN "currentFlaskCharges";
