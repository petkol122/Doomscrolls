import { Schema, type } from "@colyseus/schema";
import type { CharacterId, SpawnPointId } from "@doomscrolls/shared";

/**
 * Minimal player presence entry for TownRoom.
 *
 * Contains only identity metadata needed for presence tracking:
 *  - sessionId    (Colyseus client session id)
 *  - characterId  (the player's selected character)
 *  - displayName  (the player's public display name)
 *  - spawnPointId (the spawn point resolved from content for this join)
 *
 * No position, movement, map, combat, gameplay, or chat.
 * Task 022.1 — Player Presence State Only.
 * Task 023.2 — Spawn Point Assignment Only.
 */
export class PlayerPresence extends Schema {
  @type("string") public sessionId: string;
  @type("string") public characterId: CharacterId;
  @type("string") public displayName: string;
  @type("string") public spawnPointId: SpawnPointId;

  constructor(
    sessionId: string,
    characterId: CharacterId,
    displayName: string,
    spawnPointId: SpawnPointId,
  ) {
    super();
    this.sessionId = sessionId;
    this.characterId = characterId;
    this.displayName = displayName;
    this.spawnPointId = spawnPointId;
  }
}
