import type { RoomKind, ZoneId } from "@doomscrolls/shared";
import { CharacterError, CharacterErrorCode, CharacterService } from "../character";
import type {
  RoomJoinValidationInput,
  RoomJoinValidationResult,
} from "./RoomJoinValidationTypes";
import { contentRegistry } from "@doomscrolls/content";
import { NIGHTMARKET_DEFAULT_SPAWN_POINT_ID } from "./rooms/resolveTownSpawnPoint";

const ALLOWED_ROOM_KINDS: ReadonlySet<RoomKind> = new Set<RoomKind>(["town", "combat"]);

const SAFE_FALLBACK_TOWN_ZONE_ID = "nightmarket" as ZoneId;

function resolveRoomKindForZone(zoneId: ZoneId | undefined): RoomKind | null {
  if (zoneId === undefined || zoneId.length === 0) {
    return null;
  }

  const zone = contentRegistry.zones.get(zoneId as never);
  if (zone === undefined) {
    return null;
  }

  if (zone.roomType === "town" || zone.roomType === "combat") {
    return zone.roomType;
  }

  return null;
}

function resolveSafeFallbackTownZoneId(): ZoneId {
  const fallbackSpawn = contentRegistry.spawnPoints.get(NIGHTMARKET_DEFAULT_SPAWN_POINT_ID as never);
  if (fallbackSpawn !== undefined && typeof fallbackSpawn.zoneId === "string" && fallbackSpawn.zoneId.length > 0) {
    return fallbackSpawn.zoneId as ZoneId;
  }

  return SAFE_FALLBACK_TOWN_ZONE_ID;
}

/**
 * Server-side validation helper for a future room join.
 *
 * Task 017.3 scope:
 *  - verify the character belongs to the authenticated user via CharacterService
 *  - validate the requested room kind and zone
 *  - return a safe success/failure result
 *
 * Explicitly out of scope (deferred to later tasks):
 *  - Colyseus room registration
 *  - actual room join / seat assignment
 *  - gameplay state, movement, combat
 */
export class RoomJoinValidationService {
  public constructor(
    private readonly characterService: CharacterService = new CharacterService(),
  ) {}

  public async validateJoin(input: RoomJoinValidationInput): Promise<RoomJoinValidationResult> {
    if (!ALLOWED_ROOM_KINDS.has(input.requestedRoomKind)) {
      return { success: false, reason: "invalid_room_kind" };
    }

    if (input.requestedZoneId !== undefined && input.requestedZoneId.length === 0) {
      return { success: false, reason: "invalid_zone" };
    }

    try {
      const character = await this.characterService.getCharacterForUser(
        input.characterId,
        input.userId,
      );

      const persistedZoneId = character.currentZoneId as ZoneId;
      const persistedRoomKind = resolveRoomKindForZone(persistedZoneId);
      const requestedZoneId = input.requestedZoneId;
      const requestedZoneRoomKind = resolveRoomKindForZone(requestedZoneId);

      let resolvedZoneId: ZoneId;

      if (requestedZoneId !== undefined) {
        if (requestedZoneRoomKind === input.requestedRoomKind) {
          resolvedZoneId = requestedZoneId;
        } else {
          const fallbackZoneId = resolveSafeFallbackTownZoneId();
          resolvedZoneId = fallbackZoneId;
          if (persistedZoneId !== fallbackZoneId) {
            await this.characterService.updateCharacterRoomIntent(
              input.characterId,
              fallbackZoneId,
              character.lastLocationX ?? 0,
              character.lastLocationY ?? 0,
              character.stats.currentHp,
            );
          }
        }
      } else if (persistedRoomKind === input.requestedRoomKind) {
        resolvedZoneId = persistedZoneId;
      } else if (persistedRoomKind === null) {
        const fallbackZoneId = resolveSafeFallbackTownZoneId();
        resolvedZoneId = input.requestedRoomKind === "town"
          ? fallbackZoneId
          : fallbackZoneId;
        if (persistedZoneId !== fallbackZoneId) {
          await this.characterService.updateCharacterRoomIntent(
            input.characterId,
            fallbackZoneId,
            character.lastLocationX ?? 0,
            character.lastLocationY ?? 0,
            character.stats.currentHp,
          );
        }
      } else {
        return { success: false, reason: "invalid_zone" };
      }

      return {
        success: true,
        character,
        resolvedRoomKind: input.requestedRoomKind,
        resolvedZoneId,
      };
    } catch (error: unknown) {
      if (error instanceof CharacterError) {
        if (error.code === CharacterErrorCode.CHARACTER_NOT_FOUND) {
          // Ownership check: a character that does not belong to this user
          // is reported as not_found to avoid leaking existence.
          return { success: false, reason: "character_not_owned" };
        }

        return { success: false, reason: "character_not_found" };
      }

      // Unknown failure: keep result safe and generic.
      return { success: false, reason: "room_unavailable" };
    }
  }
}
