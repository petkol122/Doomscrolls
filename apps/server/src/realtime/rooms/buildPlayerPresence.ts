import { contentRegistry } from "@doomscrolls/content";
import type { SpawnPointContentDefinition, SpawnPointContentId } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";
import type { CharacterClassKey, CharacterId, ZoneId } from "@doomscrolls/shared";
import { PlayerPresence } from "./PlayerPresence";
import { DEFAULT_TOWN_SPAWN_POINT_ID } from "./resolveTownSpawnPoint";
import { resolvePlayerInitialPosition } from "./validateCharacterLocation";
import { writeObjectiveSlot, type ObjectiveSlot } from "./advanceObjectiveProgress";
import { resolveMaxMana } from "./manaRegen";

export interface PersistedObjectiveState {
  readonly objectiveId: string;
  readonly currentProgress: number;
  readonly requiredProgress: number;
  readonly completed: boolean;
  readonly rewardGranted: boolean;
}

export interface BuildTownPlayerPresenceInput {
  readonly sessionId: string;
  readonly characterId: CharacterId;
  readonly displayName: string;
  readonly classKey: CharacterClassKey;
  readonly level: number;
  readonly xp: number;
  readonly resolvedZoneId: ZoneId;
  readonly hp: number;
  readonly maxHp: number;
  readonly movementSpeed: number;
  readonly attackCooldownMs: number;
  readonly damage: number;
  readonly armor: number;
  /**
   * Core 0.1 Foundation -- the joined character's `mind` primary stat,
   * used to derive `maxMana`. Mana always starts full on join/respawn.
   */
  readonly mind: number;
  /** Core 0.1 Foundation -- persisted unallocated skill points and skill-slot ranks. */
  readonly skillPoints: number;
  readonly primarySkillRank: number;
  readonly secondarySkillRank: number;
  readonly tertiarySkillRank: number;
  readonly restoredLocationZoneId: string | undefined;
  readonly restoredLocationX: number | undefined;
  readonly restoredLocationY: number | undefined;
  /**
   * Optional persisted objective state for the character.
   * When provided, the PlayerPresence objective fields are populated from
   * this persisted state so progress, completion and reward-granted status
   * survive reconnects. Undefined means no objective is in progress.
   */
  readonly objectiveState?: PersistedObjectiveState | undefined;
  /**
   * Core 0.15 -- persisted state for the second concurrent objective
   * slot, restored the same way as `objectiveState` above.
   */
  readonly objectiveState2?: PersistedObjectiveState | undefined;
  /**
   * Task 351 — Completed-and-rewarded objective history for the quest book.
   * Populated from DB on join so completed objectives survive reconnect
   * and room handoff.
   */
  readonly completedObjectives?: readonly {
    readonly objectiveId: string;
  }[];
}

/**
 * Builds a TownRoom PlayerPresence using the resolved content spawn point,
 * while restoring a previously persisted location when it is valid for the
 * current zone bounds.
 */
export function buildTownPlayerPresence(
  input: BuildTownPlayerPresenceInput,
): PlayerPresence {
  const spawnPoint = resolveTownSpawnPointDefinition(input.resolvedZoneId);
  const initialPosition = resolvePlayerInitialPosition({
    resolvedZoneId: input.resolvedZoneId,
    spawnPointX: spawnPoint.x,
    spawnPointY: spawnPoint.y,
    restoredLocationZoneId: input.restoredLocationZoneId,
    restoredLocationX: input.restoredLocationX,
    restoredLocationY: input.restoredLocationY,
  });

  const presence = new PlayerPresence(
    input.sessionId,
    input.characterId,
    input.displayName,
    input.classKey,
    input.level,
    input.xp,
    spawnPoint.spawnPointId,
    input.hp,
    input.maxHp,
    initialPosition.x,
    initialPosition.y,
    input.movementSpeed,
    input.attackCooldownMs,
    input.damage,
    input.armor,
  );
  // Milestone 0.3 -- the flask belt starts empty (constructor default);
  // the caller (TownRoom.onJoin) populates it from the character's
  // equipped items + persisted charges via `syncFlaskBeltFromEquipment`
  // right after this presence is built, once the equipped-items lookup
  // resolves.

  // Core 0.1 Foundation -- Mana/Resource System. Always full on join,
  // never restored from a persisted partial value (see `PlayerPresence`
  // field comment for why nothing is persisted).
  presence.maxMana = resolveMaxMana(input.mind);
  presence.mana = presence.maxMana;

  // Core 0.1 Foundation -- Skill Point Allocation. Restored from the
  // character's persisted totals.
  presence.skillPoints = Math.max(0, Math.floor(input.skillPoints));
  presence.primarySkillRank = Math.max(1, Math.floor(input.primarySkillRank));
  presence.secondarySkillRank = Math.max(1, Math.floor(input.secondarySkillRank));
  presence.tertiarySkillRank = Math.max(1, Math.floor(input.tertiarySkillRank));

  // Task 333D / Core 0.15 — Restore persisted objective state onto the
  // presence entry (both concurrent slots) so progress, completion and
  // reward-granted status survive reconnects. When no persisted state
  // exists for a slot, it defaults to the no-objective state set by the
  // PlayerPresence constructor.
  applyPersistedObjectiveSlot(presence, 1, input.objectiveState);
  applyPersistedObjectiveSlot(presence, 2, input.objectiveState2);

  // Task 351 — Populate completed objective history from persisted data.
  // The client resolves titles from content; this builds comma-separated
  // ID and title strings so the quest book section can display history
  // after reconnect and room handoff.
  if (input.completedObjectives !== undefined && input.completedObjectives.length > 0) {
    const ids: string[] = [];
    const titles: string[] = [];
    for (const entry of input.completedObjectives) {
      const contentDef = contentRegistry.objectives.get(entry.objectiveId as never);
      ids.push(entry.objectiveId);
      titles.push(contentDef !== undefined ? t(contentDef.titleKey) : entry.objectiveId);
    }
    presence.completedObjectiveIds = ids.join(",");
    presence.completedObjectiveTitles = titles.join(",");
  }

  return presence;
}

/**
 * Core 0.15 -- shared by both objective slots. Writes persisted state
 * (or leaves the slot at its constructor-default no-objective state
 * when `persisted` is undefined) via the same `writeObjectiveSlot`
 * helper the runtime handlers use, so restore and runtime writes stay
 * in sync.
 */
export function applyPersistedObjectiveSlot(
  presence: PlayerPresence,
  slot: ObjectiveSlot,
  persisted: PersistedObjectiveState | undefined,
): void {
  if (persisted === undefined) {
    return;
  }
  const contentDef = contentRegistry.objectives.get(persisted.objectiveId as never);
  if (contentDef === undefined) {
    return;
  }
  writeObjectiveSlot(presence, slot, {
    hasObjective: true,
    objectiveId: persisted.objectiveId,
    objectiveLabel: contentDef.titleKey, // key, resolved client-side
    objectiveDescriptionKey: contentDef.descriptionKey,
    objectiveCurrent: persisted.currentProgress,
    objectiveTarget: persisted.requiredProgress,
    objectiveCompleted: persisted.completed,
    objectiveRewardGranted: persisted.rewardGranted,
  });
}

/**
 * Milestone 0.2 -- only `namesti_republiky` has its own registered
 * `SpawnPointContentDefinition` today. Every other town zone (Pilsen
 * Namesti, the Cathedral interior, and now Pilsen Bory) is only ever
 * entered via a `zone_transition` door or a waypoint, both of which
 * already land the player at a fixed, content-independent position
 * (see `TownRoom.ts`'s `ZONE_TRANSITION_DEFAULT_SPAWN_X/Y`). A fresh
 * join into one of those zones (e.g. after a zone-transition handoff)
 * reuses that same fallback instead of hard-failing for lack of a
 * bespoke spawn point.
 */
const SECONDARY_ZONE_DEFAULT_SPAWN_X = 300;
const SECONDARY_ZONE_DEFAULT_SPAWN_Y = 300;

function resolveTownSpawnPointDefinition(
  resolvedZoneId: ZoneId,
): Pick<SpawnPointContentDefinition, "spawnPointId" | "x" | "y"> {
  const definition = contentRegistry.spawnPoints.get(
    DEFAULT_TOWN_SPAWN_POINT_ID as SpawnPointContentId,
  );

  if (definition === undefined) {
    throw new Error(
      `Missing spawn point content definition: ${DEFAULT_TOWN_SPAWN_POINT_ID}`,
    );
  }

  if (definition.zoneId !== resolvedZoneId) {
    return {
      spawnPointId: definition.spawnPointId,
      x: SECONDARY_ZONE_DEFAULT_SPAWN_X,
      y: SECONDARY_ZONE_DEFAULT_SPAWN_Y,
    };
  }

  return definition;
}
