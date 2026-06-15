-- Task 330 — character-scoped persistent waypoint activation foundation
CREATE TABLE "CharacterWaypointActivation" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "waypointId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterWaypointActivation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CharacterWaypointActivation_characterId_waypointId_key"
ON "CharacterWaypointActivation"("characterId", "waypointId");

CREATE INDEX "CharacterWaypointActivation_characterId_idx"
ON "CharacterWaypointActivation"("characterId");

CREATE INDEX "CharacterWaypointActivation_zoneId_idx"
ON "CharacterWaypointActivation"("zoneId");

ALTER TABLE "CharacterWaypointActivation"
ADD CONSTRAINT "CharacterWaypointActivation_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;