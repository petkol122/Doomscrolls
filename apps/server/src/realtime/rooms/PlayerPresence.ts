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
  @type("number") public level: number;
  @type("number") public xp: number;
  @type("string") public spawnPointId: SpawnPointId;
  @type("number") public hp: number;
  @type("number") public maxHp: number;
  @type("string") public lifeState: string;
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
  // Task 095 -- server-owned dodge cooldown timestamp (ms since epoch).
  // 0 means "no dodge in progress / ready".
  @type("number") public nextDodgeAt: number;

  // Task 096 -- server-owned basic healing flask state.
  // flaskCharges  : current number of usable charges (0..maxFlaskCharges).
  // maxFlaskCharges: total charges granted on respawn / join.
  // nextFlaskAt   : cooldown timestamp (ms since epoch). 0 = ready now.
  // The server is the sole authority for charge counts, cooldown and
  // heal amount; the client only reads these values for display.
  @type("number") public flaskCharges: number;
  @type("number") public maxFlaskCharges: number;
  @type("number") public nextFlaskAt: number;
  @type("number") public nextSkillSlotAt: number;
  @type("boolean") public hasObjective: boolean;
  @type("string") public objectiveId: string;
  @type("string") public objectiveLabel: string;
  @type("number") public objectiveCurrent: number;
  @type("number") public objectiveTarget: number;
  @type("boolean") public objectiveCompleted: boolean;

  constructor(
    sessionId: string,
    characterId: CharacterId,
    displayName: string,
    level: number,
    xp: number,
    spawnPointId: SpawnPointId,
    hp: number,
    maxHp: number,
    x: number,
    y: number,
    movementSpeed: number,
    attackCooldownMs: number,
  ) {
    super();
    this.sessionId = sessionId;
    this.characterId = characterId;
    this.displayName = displayName;
    this.level = level;
    this.xp = xp;
    this.spawnPointId = spawnPointId;
    this.hp = hp;
    this.maxHp = maxHp;
    this.lifeState = hp > 0 ? "alive" : "downed";
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
    this.nextDodgeAt = 0;
    // Task 096 -- initialize server-owned basic healing flask state
    // for a fresh presence entry. Respawn / join both go through this
    // constructor path, so the player always starts with a full
    // set of charges and a ready cooldown.
    this.flaskCharges = 0;
    this.maxFlaskCharges = 0;
    this.nextFlaskAt = 0;
    this.nextSkillSlotAt = 0;
    this.hasObjective = false;
    this.objectiveId = "";
    this.objectiveLabel = "";
    this.objectiveCurrent = 0;
    this.objectiveTarget = 0;
    this.objectiveCompleted = false;
  }
}
