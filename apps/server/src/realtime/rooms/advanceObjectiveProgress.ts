import type { CharacterId } from "@doomscrolls/shared";
import { contentRegistry } from "@doomscrolls/content";
import type { ObjectiveId } from "@doomscrolls/content";
import type { EnemyContentDefinition } from "@doomscrolls/content";

/**
 * The content registry enemy collection expects an `EnemyContentDefinition["id"]`
 * as its lookup key. We alias it here to avoid inlining the cast.
 */
type ContentEnemyId = EnemyContentDefinition["id"];

/**
 * Objective progress update — single-objective foundation only.
 *
 * This is a temporary, minimal approach to track kill progress against
 * the active notice board objective. It is NOT the final quest system:
 *
 *  - Only one objective may be active at a time.
 *  - No quest journal, no multi-objective support, no turn-in UI.
 *  - Completion flag and reward granting are handled separately by
 *    a later task; this function ONLY increments progress and sends
 *    the `objective_updated` message so the HUD stays synced.
 *
 * Once the final quest system is implemented, this module should be
 * replaced by a generic objective manager that supports multiple
 * active objectives, quest chains, dynamic conditions, and persistence.
 *
 * Task 333D — Accepts an optional `onPersistUpdate` callback that is
 * called after the in-memory progress has been advanced. The caller
 * (TownRoom) must use this to persist the new state to the database
 * so progress survives reconnect/rejoin. The callback is fire-and-forget
 * from the caller's perspective; the caller must not await it in the
 * hot path.
 */
export function advanceObjectiveProgress(
  player: {
    readonly characterId: CharacterId;
    hasObjective: boolean;
    objectiveId: string;
    objectiveLabel: string;
    objectiveDescriptionKey: string;
    objectiveCurrent: number;
    objectiveTarget: number;
    objectiveCompleted: boolean;
    objectiveRewardGranted: boolean;
  },
  enemyId: string,
  /**
   * Optional fire-and-forget persistence callback. Called after the
   * in-memory player objective state has been mutated so the caller
   * can persist the new progress to the database.
   */
  onPersistUpdate?: (updated: {
    readonly characterId: CharacterId;
    readonly objectiveId: string;
    readonly currentProgress: number;
    readonly completed: boolean;
  }) => void,
): {
  readonly changed: boolean;
  readonly objectiveId: string;
  readonly label: string;
  readonly descriptionKey: string;
  readonly current: number;
  readonly target: number;
  readonly completed: boolean;
} | undefined {
  // No active objective → nothing to advance.
  if (player.objectiveRewardGranted || player.objectiveId.length === 0) {
    return undefined;
  }

  const activeObjective = contentRegistry.objectives.get(player.objectiveId as ObjectiveId);
  if (activeObjective === undefined) {
    return undefined;
  }

  // Kill does not match the objective target enemy type → ignore.
  if (!activeObjective.targetEnemyIds.includes(enemyId as ContentEnemyId)) {
    return undefined;
  }

  // Clamped increment.
  const nextCurrent = Math.min(player.objectiveTarget, player.objectiveCurrent + 1);
  player.objectiveCurrent = nextCurrent;

  // Clamp reached → set completed flag so the HUD can show "ready to
  // turn in", but do NOT grant rewards or mark rewardGranted yet.
  // Completion/turn-in and reward logic is deferred to a later task.
  if (nextCurrent >= player.objectiveTarget) {
    player.objectiveCompleted = true;
  }

  // Task 333D — Fire the optional persistence callback so the database
  // is kept in sync with the in-memory state. The caller is responsible
  // for providing the callback and handling any async persistence.
  if (onPersistUpdate !== undefined) {
    onPersistUpdate({
      characterId: player.characterId,
      objectiveId: player.objectiveId,
      currentProgress: player.objectiveCurrent,
      completed: player.objectiveCompleted,
    });
  }

  return {
    changed: true,
    objectiveId: player.objectiveId,
    label: player.objectiveLabel,
    descriptionKey: player.objectiveDescriptionKey,
    current: player.objectiveCurrent,
    target: player.objectiveTarget,
    completed: player.objectiveCompleted,
  };
}