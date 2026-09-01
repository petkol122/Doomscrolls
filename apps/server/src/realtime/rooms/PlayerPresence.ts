import { Schema, type } from "@colyseus/schema";
import type { CharacterClassKey, CharacterId, SpawnPointId } from "@doomscrolls/shared";

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
  // Core 0.9 -- the joined character's class, used by
  // `resolveSkillSlotDefinition` so a player's secondary/tertiary skill
  // slots resolve to their own class's skills, not a hardcoded default.
  @type("string") public classKey: CharacterClassKey;
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
  // Core 0.10 -- the joined character's real derived combat damage
  // (base + power stat + equipped weapon statModifiers), so basic
  // attacks and skill casts deal a real, character-derived number
  // instead of a hardcoded literal. Populated identically to
  // `movementSpeed`/`attackCooldownMs`: at join, and again whenever
  // progression recalculates equipped stats (level-up, equip change).
  @type("number") public damage: number;
  // Core 0.11 -- the joined character's real derived armor (base 0 +
  // equipped statModifiers), consulted when an enemy attack lands so a
  // hit is mitigated by a real, character-derived number instead of
  // being applied to `hp` at its raw content value. Populated
  // identically to `damage`: at join, and again whenever progression
  // recalculates equipped stats (level-up, equip change).
  @type("number") public armor: number;
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
  // Core 0.7 -- independent cooldown for the new tertiary skill slot
  // (Bone Splinter), separate from nextSkillSlotAt (secondary/Grave Spark).
  @type("number") public nextTertiarySkillSlotAt: number;
  @type("boolean") public hasObjective: boolean;
  @type("string") public objectiveId: string;
  @type("string") public objectiveLabel: string;
  @type("string") public objectiveDescriptionKey: string;
  @type("number") public objectiveCurrent: number;
  @type("number") public objectiveTarget: number;
  @type("boolean") public objectiveCompleted: boolean;
  @type("boolean") public objectiveRewardGranted: boolean;
  @type("string") public completedObjectiveIds: string;
  @type("string") public completedObjectiveTitles: string;
  @type("boolean") public hasCorpse: boolean;
  @type("number") public corpseX: number;
  @type("number") public corpseY: number;

  constructor(
    sessionId: string,
    characterId: CharacterId,
    displayName: string,
    classKey: CharacterClassKey,
    level: number,
    xp: number,
    spawnPointId: SpawnPointId,
    hp: number,
    maxHp: number,
    x: number,
    y: number,
    movementSpeed: number,
    attackCooldownMs: number,
    damage: number,
    armor: number,
  ) {
    super();
    this.sessionId = sessionId;
    this.characterId = characterId;
    this.displayName = displayName;
    this.classKey = classKey;
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
    this.damage = damage;
    this.armor = armor;
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
    this.nextTertiarySkillSlotAt = 0;
    this.hasObjective = false;
    this.objectiveId = "";
    this.objectiveLabel = "";
    this.objectiveDescriptionKey = "";
    this.objectiveCurrent = 0;
    this.objectiveTarget = 0;
    this.objectiveCompleted = false;
    this.objectiveRewardGranted = false;
    this.completedObjectiveIds = "";
    this.completedObjectiveTitles = "";
    this.hasCorpse = false;
    this.corpseX = 0;
    this.corpseY = 0;
  }
}
