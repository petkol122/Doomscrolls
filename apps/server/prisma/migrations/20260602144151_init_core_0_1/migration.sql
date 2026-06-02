-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ItemLocationType" AS ENUM ('ROOM_LOOT', 'INVENTORY', 'EQUIPMENT', 'CORPSE_BOUND', 'DELETED');

-- CreateEnum
CREATE TYPE "CorpseStatus" AS ENUM ('ACTIVE', 'RECOVERED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "usernameNormalized" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "masterVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "musicVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "sfxVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "showFpsCounter" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterName" TEXT NOT NULL,
    "characterNameNormalized" TEXT NOT NULL,
    "originId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "currentZoneId" TEXT NOT NULL,
    "currentHp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastPlayedAt" TIMESTAMP(3),

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterStats" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "power" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "mind" INTEGER NOT NULL,
    "toughness" INTEGER NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "damage" INTEGER NOT NULL,
    "armor" INTEGER NOT NULL,
    "moveSpeed" DOUBLE PRECISION NOT NULL,
    "attackCooldownMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterPassive" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "passiveId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterPassive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "gridWidth" INTEGER NOT NULL DEFAULT 10,
    "gridHeight" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemInstance" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "ownerCharacterId" TEXT,
    "locationType" "ItemLocationType" NOT NULL,
    "inventoryPage" INTEGER,
    "inventoryX" INTEGER,
    "inventoryY" INTEGER,
    "equipmentSlot" TEXT,
    "roomId" TEXT,
    "zoneId" TEXT,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "corpseId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "durabilityCurrent" INTEGER,
    "durabilityMax" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Corpse" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "roomId" TEXT,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "status" "CorpseStatus" NOT NULL DEFAULT 'ACTIVE',
    "forcedRecovery" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recoveredAt" TIMESTAMP(3),

    CONSTRAINT "Corpse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_usernameNormalized_key" ON "User"("usernameNormalized");

-- CreateIndex
CREATE INDEX "User_usernameNormalized_idx" ON "User"("usernameNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_tokenHash_idx" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_status_idx" ON "Session"("status");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "Character_userId_idx" ON "Character"("userId");

-- CreateIndex
CREATE INDEX "Character_originId_idx" ON "Character"("originId");

-- CreateIndex
CREATE INDEX "Character_classId_idx" ON "Character"("classId");

-- CreateIndex
CREATE INDEX "Character_currentZoneId_idx" ON "Character"("currentZoneId");

-- CreateIndex
CREATE UNIQUE INDEX "Character_userId_characterNameNormalized_key" ON "Character"("userId", "characterNameNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterStats_characterId_key" ON "CharacterStats"("characterId");

-- CreateIndex
CREATE INDEX "CharacterPassive_characterId_idx" ON "CharacterPassive"("characterId");

-- CreateIndex
CREATE INDEX "CharacterPassive_passiveId_idx" ON "CharacterPassive"("passiveId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterPassive_characterId_passiveId_sourceType_sourceId_key" ON "CharacterPassive"("characterId", "passiveId", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_characterId_key" ON "Inventory"("characterId");

-- CreateIndex
CREATE INDEX "ItemInstance_ownerCharacterId_idx" ON "ItemInstance"("ownerCharacterId");

-- CreateIndex
CREATE INDEX "ItemInstance_definitionId_idx" ON "ItemInstance"("definitionId");

-- CreateIndex
CREATE INDEX "ItemInstance_locationType_idx" ON "ItemInstance"("locationType");

-- CreateIndex
CREATE INDEX "ItemInstance_roomId_idx" ON "ItemInstance"("roomId");

-- CreateIndex
CREATE INDEX "ItemInstance_zoneId_idx" ON "ItemInstance"("zoneId");

-- CreateIndex
CREATE INDEX "ItemInstance_corpseId_idx" ON "ItemInstance"("corpseId");

-- CreateIndex
CREATE INDEX "Corpse_characterId_idx" ON "Corpse"("characterId");

-- CreateIndex
CREATE INDEX "Corpse_status_idx" ON "Corpse"("status");

-- CreateIndex
CREATE INDEX "Corpse_zoneId_idx" ON "Corpse"("zoneId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterStats" ADD CONSTRAINT "CharacterStats_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterPassive" ADD CONSTRAINT "CharacterPassive_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemInstance" ADD CONSTRAINT "ItemInstance_ownerCharacterId_fkey" FOREIGN KEY ("ownerCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemInstance" ADD CONSTRAINT "ItemInstance_corpseId_fkey" FOREIGN KEY ("corpseId") REFERENCES "Corpse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Corpse" ADD CONSTRAINT "Corpse_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
