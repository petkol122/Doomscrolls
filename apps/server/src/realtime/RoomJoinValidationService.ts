import type { RoomKind, ZoneId } from "@doomscrolls/shared";
import { CharacterError, CharacterErrorCode, CharacterService } from "../character";
import type {
  RoomJoinValidationInput,
  RoomJoinValidationResult,
} from "./RoomJoinValidationTypes";

const ALLOWED_ROOM_KINDS: ReadonlySet<RoomKind> = new Set<RoomKind>(["town", "combat"]);

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

      const resolvedZoneId: ZoneId = input.requestedZoneId ?? (character.currentZoneId as ZoneId);

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
