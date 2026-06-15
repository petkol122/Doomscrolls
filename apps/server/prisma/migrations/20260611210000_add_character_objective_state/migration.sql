-- Task 333D — persistent character-scoped objective state foundation
--
-- This table stores the current progress, completion and reward-granted
-- status for a single notice board objective per character. It is NOT
-- a full quest journal; it is a targeted persistence layer for the
-- single Nightmarket notice board objective flow from Tasks 333A–333C.
--
-- Once a proper quest journal system is implemented, this model should
-- be replaced or extended to support multiple concurrent objectives,
-- quest chains, dynamic conditions, etc.

CREATE TABLE "CharacterObjective" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "currentProgress" INTEGER NOT NULL DEFAULT 0,
    "requiredProgress" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "rewardGranted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterObjective_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CharacterObjective_characterId_objectiveId_key"
ON "CharacterObjective"("characterId", "objectiveId");

CREATE INDEX "CharacterObjective_characterId_idx"
ON "CharacterObjective"("characterId");

ALTER TABLE "CharacterObjective"
ADD CONSTRAINT "CharacterObjective_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;