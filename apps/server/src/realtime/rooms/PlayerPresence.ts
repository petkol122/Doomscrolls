import { Schema, type } from "@colyseus/schema";
import type { CharacterClassKey, CharacterId, SpawnPointId } from "@doomscrolls/shared";
import { EMPTY_FLASK_BELT } from "./flaskBeltConfig";

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
  // Core 0.4x -- remaining building-avoidance waypoints beyond the
  // current targetX/targetY, flattened as "x1,y1,x2,y2,...". Populated
  // by `computeBuildingAvoidancePath` via `applyMovementIntent` when a
  // click-to-move target isn't directly reachable in a straight line;
  // `stepTownRoomMovement` advances through them one at a time as each
  // is reached. Empty string = no further waypoints queued.
  @type("string") public pathWaypoints: string;
  @type("boolean") public hasPendingAction: boolean;
  @type("string") public pendingActionType: string;
  @type("string") public pendingTargetId: string;
  @type("number") public pendingTargetX: number;
  @type("number") public pendingTargetY: number;
  // Task 095 -- server-owned dodge cooldown timestamp (ms since epoch).
  // 0 means "no dodge in progress / ready".
  @type("number") public nextDodgeAt: number;

  // Milestone 0.3 -- 4-Slot Flask Belt. Colyseus schema instances are
  // capped at 64 `@type` fields (this class was already at 63 before
  // this feature); one flat field per belt-slot property (as the
  // primary/secondary/tertiary skill cooldowns and two-objective-slot
  // fields above do) would need ~20 fields and blow the cap. Instead
  // all 4 slots are packed into this single flattened string, one
  // "effectType,effectValue,charges,maxCharges,nextReadyAt" segment
  // per slot joined by "|" -- same idiom `statusEffects` already uses
  // for a variable-length collection of per-entry fields. Read/write
  // through `flaskBeltConfig.ts`'s accessors, never parsed by hand
  // elsewhere. Empty string segments (effectType "") mean "no flask
  // equipped in this slot".
  @type("string") public flaskBelt: string;
  // Core 0.1 Foundation -- Mana/Resource System. Always resets to full
  // on join/respawn (never persisted); regenerates passively on the
  // room's simulation tick (see `regenerateMana`) and is deducted by
  // `resolveSkillSlotDefinition`'s `manaCost` before a skill cast is
  // accepted.
  @type("number") public mana: number;
  @type("number") public maxMana: number;
  // Core 0.1 Foundation -- Skill Point Allocation. `skillPoints` is the
  // unallocated total (1 gained per level); the three `*SkillRank`
  // fields are the persisted rank of each of the player's class's
  // skill slots (every skill starts at rank 1, already castable).
  @type("number") public skillPoints: number;
  @type("number") public primarySkillRank: number;
  @type("number") public secondarySkillRank: number;
  @type("number") public tertiarySkillRank: number;
  @type("number") public nextSkillSlotAt: number;
  // Core 0.7 -- independent cooldown for the new tertiary skill slot
  // (Bone Splinter), separate from nextSkillSlotAt (secondary/Grave Spark).
  @type("number") public nextTertiarySkillSlotAt: number;
  // Core 0.14 -- independent cooldown for the primary skill slot
  // (heavy_strike / startingSkillId), separate from the secondary and
  // tertiary cooldowns above.
  @type("number") public nextPrimarySkillSlotAt: number;
  @type("boolean") public hasObjective: boolean;
  @type("string") public objectiveId: string;
  @type("string") public objectiveLabel: string;
  @type("string") public objectiveDescriptionKey: string;
  @type("number") public objectiveCurrent: number;
  @type("number") public objectiveTarget: number;
  @type("boolean") public objectiveCompleted: boolean;
  @type("boolean") public objectiveRewardGranted: boolean;
  // Core 0.15 -- second concurrent objective slot, mirroring the 8
  // fields above exactly (same duplicated-field pattern already used
  // for the primary/secondary/tertiary skill-slot cooldowns).
  @type("boolean") public hasObjective2: boolean;
  @type("string") public objectiveId2: string;
  @type("string") public objectiveLabel2: string;
  @type("string") public objectiveDescriptionKey2: string;
  @type("number") public objectiveCurrent2: number;
  @type("number") public objectiveTarget2: number;
  @type("boolean") public objectiveCompleted2: boolean;
  @type("boolean") public objectiveRewardGranted2: boolean;
  @type("string") public completedObjectiveIds: string;
  @type("string") public completedObjectiveTitles: string;
  @type("boolean") public hasCorpse: boolean;
  @type("number") public corpseX: number;
  @type("number") public corpseY: number;
  // Core 0.1 -- id of the server-persisted `Corpse` DB row backing the
  // in-memory corpse marker above, so recovery can resolve/delete the
  // right record. Empty string = no DB-backed corpse (marker not yet
  // persisted, or already recovered).
  @type("string") public corpseId: string;
  // Core 0.2 -- server-owned active status effects (bleed/slow/stun/burn),
  // flattened as "type:expiresAtMs:magnitude:nextTickAtMs" entries joined
  // by "|". Empty string = no active effects. See
  // `./statusEffects.ts` for the engine that reads/writes this field;
  // the client only ever reads it for a visual indicator.
  @type("string") public statusEffects: string;

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
    this.pathWaypoints = "";
    this.hasPendingAction = false;
    this.pendingActionType = "";
    this.pendingTargetId = "";
    this.pendingTargetX = x;
    this.pendingTargetY = y;
    this.nextDodgeAt = 0;
    // Milestone 0.3 -- initialize the 4-slot flask belt to "empty, no
    // effect" for a fresh presence entry. `buildTownPlayerPresence` /
    // `buildCombatPlayerPresence` populate the real per-slot state from
    // the character's equipped items + persisted charges right after
    // construction, mirroring how mana/skill ranks are set below.
    this.flaskBelt = EMPTY_FLASK_BELT;
    // Core 0.1 Foundation -- default to an empty pool; `buildTownPlayerPresence`
    // / `buildCombatPlayerPresence` set the real mana/maxMana/skillPoints/
    // rank values right after construction, mirroring the flask pattern above.
    this.mana = 0;
    this.maxMana = 0;
    this.skillPoints = 0;
    this.primarySkillRank = 1;
    this.secondarySkillRank = 1;
    this.tertiarySkillRank = 1;
    this.nextSkillSlotAt = 0;
    this.nextTertiarySkillSlotAt = 0;
    this.nextPrimarySkillSlotAt = 0;
    this.hasObjective = false;
    this.objectiveId = "";
    this.objectiveLabel = "";
    this.objectiveDescriptionKey = "";
    this.objectiveCurrent = 0;
    this.objectiveTarget = 0;
    this.objectiveCompleted = false;
    this.objectiveRewardGranted = false;
    this.hasObjective2 = false;
    this.objectiveId2 = "";
    this.objectiveLabel2 = "";
    this.objectiveDescriptionKey2 = "";
    this.objectiveCurrent2 = 0;
    this.objectiveTarget2 = 0;
    this.objectiveCompleted2 = false;
    this.objectiveRewardGranted2 = false;
    this.completedObjectiveIds = "";
    this.completedObjectiveTitles = "";
    this.hasCorpse = false;
    this.corpseX = 0;
    this.corpseY = 0;
    this.corpseId = "";
    this.statusEffects = "";
  }
}
