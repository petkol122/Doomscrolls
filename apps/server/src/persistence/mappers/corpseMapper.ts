import type { CharacterCorpseState, CharacterId, CorpseId, CorpseState, RoomId, ZoneId } from "@doomscrolls/shared";
import { CorpseStatus, type Corpse } from "@prisma/client";
import { requireString, toIsoDateTimeString } from "./dateMapper";

export function toCorpseDto(corpse: Corpse): CharacterCorpseState {
  const state: CorpseState = corpse.status === CorpseStatus.ACTIVE ? "active" : corpse.forcedRecovery ? "force_recovered" : "recovered";

  const dto = {
    corpseId: corpse.id as CorpseId,
    characterId: corpse.characterId as CharacterId,
    state,
    zoneId: corpse.zoneId as ZoneId,
    roomId: requireString(corpse.roomId, "Corpse.roomId") as RoomId,
    position: {
      x: corpse.positionX,
      y: corpse.positionY,
    },
    diedAt: toIsoDateTimeString(corpse.createdAt),
  };

  if (corpse.recoveredAt === null) {
    return dto;
  }

  return {
    ...dto,
    recoveredAt: toIsoDateTimeString(corpse.recoveredAt),
  };
}