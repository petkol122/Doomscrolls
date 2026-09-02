import { contentRegistry } from "@doomscrolls/content";
import type { SpawnPointContentDefinition, SpawnPointContentId } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";
import type { CharacterClassKey, CharacterId, ZoneId } from "@doomscrolls/shared";
import { PlayerPresence } from "./PlayerPresence";
import { NIGHTMARKET_DEFAULT_SPAWN_POINT_ID } from "./resolveTownSpawnPoint";
import { resolvePlayerInitialPosition } from "./validateCharacterLocation";
import { restoreFlaskToFull } from "./healingFlaskConfig";
import { writeObjectiveSlot, type ObjectiveSlot } from "./advanceObjectiveProgress";

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
  readonly restoredFlaskCharges: number | undefined;
  readonly movementSpeed: number;
  readonly attackCooldownMs: number;
  readonly damage: number;
  readonly armor: number;
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
  // Restore the flask baseline before applying persisted state.
  // `restoreFlaskToFull` intentionally sets `maxFlaskCharges` (3) and
  // `nextFlaskAt` (0) as a side-effect, even though `flaskCharges` is
  // then overridden by the persisted value below. This ensures the
  // Colyseus schema always has a valid max-flask-cap baseline for HUD
  // rendering, regardless of whether persisted state exists.
  restoreFlaskToFull(presence);
  const restoredFlaskCharges = Number.isFinite(input.restoredFlaskCharges)
    ? Math.floor(input.restoredFlaskCharges ?? 0)
    : presence.maxFlaskCharges;
  presence.flaskCharges = Math.min(
    presence.maxFlaskCharges,
    Math.max(0, restoredFlaskCharges),
  );

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

function resolveTownSpawnPointDefinition(
  resolvedZoneId: ZoneId,
): SpawnPointContentDefinition {
  const definition = contentRegistry.spawnPoints.get(
    NIGHTMARKET_DEFAULT_SPAWN_POINT_ID as SpawnPointContentId,
  );

  if (definition === undefined) {
    throw new Error(
      `Missing spawn point content definition: ${NIGHTMARKET_DEFAULT_SPAWN_POINT_ID}`,
    );
  }

  if (definition.zoneId !== resolvedZoneId) {
    throw new Error(
      `Spawn point ${definition.id} is not bound to resolved zone ${resolvedZoneId}.`,
    );
  }

  return definition;
}
