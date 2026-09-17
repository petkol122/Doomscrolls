-- CreateTable
CREATE TABLE "StashItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "slotIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StashItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StashItem_userId_idx" ON "StashItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StashItem_userId_slotIndex_key" ON "StashItem"("userId", "slotIndex");

-- CreateIndex
CREATE UNIQUE INDEX "StashItem_userId_definitionId_key" ON "StashItem"("userId", "definitionId");

-- AddForeignKey
ALTER TABLE "StashItem" ADD CONSTRAINT "StashItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
