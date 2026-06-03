import { Schema, type } from "@colyseus/schema";
import type { CharacterId } from "@doomscrolls/shared";

/**
 * Minimal player presence entry for TownRoom.
 *
 * Contains only identity metadata needed for presence tracking:
 *  - sessionId    (Colyseus client session id)
 *  - characterId  (the player's selected character)
 *  - displayName  (the player's public display name)
 *
 * No position, movement, map, combat, gameplay, or chat.
 * Task 022.1 — Player Presence State Only.
 */
export class PlayerPresence extends Schema {
  @type("string") public sessionId: string;
  @type("string") public characterId: CharacterId;
  @type("string") public displayName: string;

  constructor(sessionId: string, characterId: CharacterId, displayName: string) {
    super();
    this.sessionId = sessionId;
    this.characterId = characterId;
    this.displayName = displayName;
  }
}