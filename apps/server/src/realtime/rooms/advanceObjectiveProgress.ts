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
 * Core 0.15 -- two concurrent objective slots.
 *
 * `PlayerPresence` carries two full, parallel sets of the 8 objective
 * fields below (slot 1: the original unsuffixed names; slot 2: the same
 * names with a `2` suffix) -- the same duplicated-field pattern this
 * codebase already uses for skill-slot cooldowns
 * (`nextSkillSlotAt`/`nextTertiarySkillSlotAt`/`nextPrimarySkillSlotAt`),
 * not a generic array. `readObjectiveSlot`/`writeObjectiveSlot` below
 * are the only new plumbing this requires: every existing function in
 * this file keeps operating on a single, slot-agnostic 8-field shape,
 * and callers snapshot the right slot in, then write it back out.
 */
export type ObjectiveSlot = 1 | 2;

export interface ObjectiveSlotFields {
  hasObjective: boolean;
  objectiveId: string;
  objectiveLabel: string;
  objectiveDescriptionKey: string;
  objectiveCurrent: number;
  objectiveTarget: number;
  objectiveCompleted: boolean;
  objectiveRewardGranted: boolean;
}

type ObjectiveSlotPlayer = ObjectiveSlotFields & {
  hasObjective2: boolean;
  objectiveId2: string;
  objectiveLabel2: string;
  objectiveDescriptionKey2: string;
  objectiveCurrent2: number;
  objectiveTarget2: number;
  objectiveCompleted2: boolean;
  objectiveRewardGranted2: boolean;
};

export function readObjectiveSlot(player: ObjectiveSlotPlayer, slot: ObjectiveSlot): ObjectiveSlotFields {
  return slot === 1
    ? {
      hasObjective: player.hasObjective,
      objectiveId: player.objectiveId,
      objectiveLabel: player.objectiveLabel,
      objectiveDescriptionKey: player.objectiveDescriptionKey,
      objectiveCurrent: player.objectiveCurrent,
      objectiveTarget: player.objectiveTarget,
      objectiveCompleted: player.objectiveCompleted,
      objectiveRewardGranted: player.objectiveRewardGranted,
    }
    : {
      hasObjective: player.hasObjective2,
      objectiveId: player.objectiveId2,
      objectiveLabel: player.objectiveLabel2,
      objectiveDescriptionKey: player.objectiveDescriptionKey2,
      objectiveCurrent: player.objectiveCurrent2,
      objectiveTarget: player.objectiveTarget2,
      objectiveCompleted: player.objectiveCompleted2,
      objectiveRewardGranted: player.objectiveRewardGranted2,
    };
}

export function writeObjectiveSlot(player: ObjectiveSlotPlayer, slot: ObjectiveSlot, fields: ObjectiveSlotFields): void {
  if (slot === 1) {
    player.hasObjective = fields.hasObjective;
    player.objectiveId = fields.objectiveId;
    player.objectiveLabel = fields.objectiveLabel;
    player.objectiveDescriptionKey = fields.objectiveDescriptionKey;
    player.objectiveCurrent = fields.objectiveCurrent;
    player.objectiveTarget = fields.objectiveTarget;
    player.objectiveCompleted = fields.objectiveCompleted;
    player.objectiveRewardGranted = fields.objectiveRewardGranted;
    return;
  }
  player.hasObjective2 = fields.hasObjective;
  player.objectiveId2 = fields.objectiveId;
  player.objectiveLabel2 = fields.objectiveLabel;
  player.objectiveDescriptionKey2 = fields.objectiveDescriptionKey;
  player.objectiveCurrent2 = fields.objectiveCurrent;
  player.objectiveTarget2 = fields.objectiveTarget;
  player.objectiveCompleted2 = fields.objectiveCompleted;
  player.objectiveRewardGranted2 = fields.objectiveRewardGranted;
}

/**
 * Objective progress update — operates on a single slot's snapshot.
 *
 * Callers now loop over both objective slots (see `readObjectiveSlot`/
 * `writeObjectiveSlot` above) so a kill can advance either or both
 * concurrently active objectives; this function itself is unchanged
 * and remains slot-agnostic. Completion flag and reward granting are
 * handled separately by the notice board turn-in handler; this
 * function ONLY increments progress and returns the new state so the
 * caller can send `objective_updated` and persist it.
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

/**
 * Core 0.15 -- kill-progress entry point for callers (CombatRoom's and
 * TownRoom's kill handlers) that must advance BOTH concurrent slots,
 * since either or both active objectives could target the killed
 * enemy. Wraps `advanceObjectiveProgress` per slot via
 * `readObjectiveSlot`/`writeObjectiveSlot` so that function itself
 * stays single-slot and unchanged. Returns one entry per slot whose
 * progress actually changed.
 */
export function advanceObjectiveProgressAllSlots(
  player: ObjectiveSlotPlayer & { readonly characterId: CharacterId },
  enemyId: string,
  onPersistUpdate?: (updated: {
    readonly characterId: CharacterId;
    readonly objectiveId: string;
    readonly currentProgress: number;
    readonly completed: boolean;
  }) => void,
): readonly {
  readonly slot: ObjectiveSlot;
  readonly objectiveId: string;
  readonly label: string;
  readonly descriptionKey: string;
  readonly current: number;
  readonly target: number;
  readonly completed: boolean;
}[] {
  const results: {
    slot: ObjectiveSlot;
    objectiveId: string;
    label: string;
    descriptionKey: string;
    current: number;
    target: number;
    completed: boolean;
  }[] = [];

  for (const slot of [1, 2] as const) {
    const snap = readObjectiveSlot(player, slot) as ObjectiveSlotFields & { characterId: CharacterId };
    snap.characterId = player.characterId;
    const progressResult = advanceObjectiveProgress(snap, enemyId, onPersistUpdate);
    if (progressResult !== undefined && progressResult.changed) {
      writeObjectiveSlot(player, slot, snap);
      results.push({ slot, ...progressResult });
    }
  }

  return results;
}