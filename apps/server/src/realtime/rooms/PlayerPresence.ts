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
 *  - attackCooldownMs / lastAttackAt / nextAttackAt
 *                (server-owned basic attack timing state)
 *  - hasPendingAction / pendingActionType / pendingTargetId / pendingTargetX / pendingTargetY
 *                (server-owned deferred action target state)
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
  @type("number") public attackCooldownMs: number;
  @type("number") public lastAttackAt: number;
  @type("number") public nextAttackAt: number;
  @type("boolean") public hasMovementTarget: boolean;
  @type("number") public targetX: number;
  @type("number") public targetY: number;
  @type("boolean") public hasPendingAction: boolean;
  @type("string") public pendingActionType: string;
  @type("string") public pendingTargetId: string;
  @type("number") public pendingTargetX: number;
  @type("number") public pendingTargetY: number;

  constructor(
    sessionId: string,
    characterId: CharacterId,
    displayName: string,
    spawnPointId: SpawnPointId,
    x: number,
    y: number,
    movementSpeed: number,
    attackCooldownMs: number,
  ) {
    super();
    this.sessionId = sessionId;
    this.characterId = characterId;
    this.displayName = displayName;
    this.spawnPointId = spawnPointId;
    this.x = x;
    this.y = y;
    this.movementSpeed = movementSpeed;
    this.attackCooldownMs = attackCooldownMs;
    this.lastAttackAt = 0;
    this.nextAttackAt = 0;
    this.hasMovementTarget = false;
    this.targetX = x;
    this.targetY = y;
    this.hasPendingAction = false;
    this.pendingActionType = "";
    this.pendingTargetId = "";
    this.pendingTargetX = x;
    this.pendingTargetY = y;
  }
}
