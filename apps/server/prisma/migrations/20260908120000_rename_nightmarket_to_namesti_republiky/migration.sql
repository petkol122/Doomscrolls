-- Data migration: the "nightmarket" hub zone is removed from content
-- (replaced by "namesti_republiky"). Rewrite every persisted reference
-- to the old zone id so nothing is left pointing at a zone that no
-- longer exists in the content registry.

UPDATE "Character"
SET "currentZoneId" = 'namesti_republiky'
WHERE "currentZoneId" = 'nightmarket';

UPDATE "Character"
SET "lastLocationZoneId" = 'namesti_republiky'
WHERE "lastLocationZoneId" = 'nightmarket';

UPDATE "CharacterWaypointActivation"
SET "zoneId" = 'namesti_republiky'
WHERE "zoneId" = 'nightmarket';

UPDATE "ItemInstance"
SET "zoneId" = 'namesti_republiky'
WHERE "zoneId" = 'nightmarket';

UPDATE "Corpse"
SET "zoneId" = 'namesti_republiky'
WHERE "zoneId" = 'nightmarket';
