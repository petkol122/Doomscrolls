import { Schema, type } from "@colyseus/schema";
import type { CharacterId, SpawnPointId } from "@doomscrolls/shared";

/**
 * Minimal player presence entry for TownRoom.
 *
 * Contains only identity metadata plus the player's server-synced world
 * position and simple authoritative movement target state:
 *  - sessionId    (Colyseus client session id)
 *  - characterId  (the player's selected character)
 *  - displayName  (the player's public display name)
 *  - spawnPointId (the spawn point resolved from content for this join)
 *  - x, y         (server-owned synced position)
 *  - movementSpeed (server-owned runtime movement speed for tick stepping)
 *  - hasMovementTarget / targetX / targetY
 *                (simple server-owned click-move target state)
 *
 * No pathing, no movement simulation, no facing, no map, no combat,
 * no chat, no gameplay.
 *
 * Task 022.1 — Player Presence State Only.
 * Task 023.2 — Spawn Point Assignment Only.
 * Task 025   — Player Position Foundation Batch.
 */
export class PlayerPresence extends Schema {
  @type("string") public sessionId: string;
  @type("string") public characterId: CharacterId;
  @type("string") public displayName: string;
  @type("string") public spawnPointId: SpawnPointId;
  @type("number") public x: number;
  @type("number") public y: number;
  @type("number") public movementSpeed: number;
  @type("boolean") public hasMovementTarget: boolean;
  @type("number") public targetX: number;
  @type("number") public targetY: number;

  constructor(
    sessionId: string,
    characterId: CharacterId,
    displayName: string,
    spawnPointId: SpawnPointId,
    x: number,
    y: number,
    movementSpeed: number,
  ) {
    super();
    this.sessionId = sessionId;
    this.characterId = characterId;
    this.displayName = displayName;
    this.spawnPointId = spawnPointId;
    this.x = x;
    this.y = y;
    this.movementSpeed = movementSpeed;
    this.hasMovementTarget = false;
    this.targetX = x;
    this.targetY = y;
  }
}
