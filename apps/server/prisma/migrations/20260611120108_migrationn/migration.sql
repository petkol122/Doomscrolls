-- AlterEnum
ALTER TYPE "ItemLocationType" ADD VALUE 'STASH';

-- AlterTable
ALTER TABLE "ItemInstance" ADD COLUMN     "stashPage" INTEGER,
ADD COLUMN     "stashX" INTEGER,
ADD COLUMN     "stashY" INTEGER;

-- CreateIndex
CREATE INDEX "ItemInstance_ownerCharacterId_locationType_idx" ON "ItemInstance"("ownerCharacterId", "locationType");

-- CreateIndex
CREATE INDEX "ItemInstance_ownerCharacterId_stashPage_idx" ON "ItemInstance"("ownerCharacterId", "stashPage");
