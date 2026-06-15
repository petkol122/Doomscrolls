/**
 * Client-side helper to extract player presence from a TownRoom Colyseus state.
 *
 * The shared `RoomState` interface does not include `playerPresence` because
 * that property is specific to the Colyseus `TownRoomState` schema.  At
 * runtime the room's `.state` *is* the schema object, so we can safely reach
 * `playerPresence` when it exists.
 *
 * This module isolates the schema‑aware access so callers don't need to
 * import Colyseus schema types directly.
 *
 * Task 022.2 — Client Presence Display Types Only.
 * Task 023.3 — Client Spawn Point Display Helper Only.
 * Task 025   — Client Position Read/Display Helper Only.
 */

import type {
  CharacterId,
  PlayerPosition,
  SpawnPointId,
} from "@doomscrolls/shared";
import type { ObjectiveId } from "@doomscrolls/content";
import { contentRegistry } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PlayerPresenceEntry {
  readonly sessionId: string;
  readonly characterId: CharacterId;
  readonly displayName: string;
  readonly level?: number;
  readonly xp?: number;
  readonly lifeState?: "alive" | "downed";
  readonly hp?: number;
  readonly maxHp?: number;
  /**
   * Spawn point id assigned to the player by the server, when present.
   * Optional because older / partial state objects may not carry the field
   * yet; callers must treat absence as "unknown", not as "no spawn".
   */
  readonly spawnPointId?: SpawnPointId;
  /**
   * Server-synced world position.
   * Optional because older / partial state objects may not carry the field
   * yet; callers must treat absence as "unknown", not as "no position".
   * This is still not full gameplay movement — no animation, pathing,
   * collision, or interpolation is implied by this display helper.
   */
  readonly position?: PlayerPosition;
// Task 207 -- server-owned deferred action target kind for this
// player, when present. Used by the client to show a small "Moving
// to loot / interact / attack" approach label above the local player
// placeholder while the player is walking toward a queued target.
// The server still owns the action; the client only reads this for
// transient display.
  readonly pendingActionType?: "attack" | "interact" | "pickup";
  /**
   * Server-synced runtime movement speed for this player, when present.
   * Optional because older / partial state objects may not carry the field
   * yet; callers must treat absence as "unknown", not as zero speed.
   */
  readonly movementSpeed?: number;
  /**
   * Server-owned basic healing flask charges count, when present.
   * Optional because older / partial state objects may not carry the field
   * yet; callers must treat absence as "unknown".
   */
  readonly flaskCharges?: number;
  readonly maxFlaskCharges?: number;
  readonly nextSkillSlotAt?: number;
  readonly objective?: {
    readonly id: string;
    readonly label: string;
    readonly descriptionKey?: string;
    readonly current: number;
    readonly target: number;
    readonly completed: boolean;
    readonly xpReward?: number;
    readonly copperReward?: number;
    /** Human-readable enemy target name(s) resolved from content, e.g. "Trashboar Runt" or "Trashboar Brute" */
    readonly targetEnemyLabel?: string | undefined;
  };
  readonly hasObjective?: boolean;
  readonly objectiveRewardGranted?: boolean;
  readonly hasCorpse?: boolean;
  readonly corpsePosition?: PlayerPosition;
}

export interface TownRoomPresence {
  readonly connectedPlayerCount: number;
  readonly players: readonly PlayerPresenceEntry[];
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Extract player presence from a TownRoom Colyseus schema state.
 *
 * Returns `null` when the state has no `playerPresence` property (i.e. it is
 * not a TownRoom state or the field has not been synchronised yet).
 */
export function getTownRoomPresence(
  state: Record<string, unknown>,
): TownRoomPresence | null {
  const pp = state.playerPresence;

  if (pp === undefined || pp === null) {
    return null;
  }

  const players: PlayerPresenceEntry[] = [];
  for (const value of iteratePresenceEntries(pp)) {
    const baseEntry: PlayerPresenceEntry = {
      sessionId: String(value.sessionId ?? ""),
      characterId: (value.characterId ?? "") as CharacterId,
      displayName: String(value.displayName ?? ""),
    };

    const withSpawn = applyOptionalSpawnPoint(baseEntry, value);
    const withProgression = applyOptionalProgression(withSpawn, value);
    const withLifeState = applyOptionalLifeState(withProgression, value);
    const withVitality = applyOptionalVitality(withLifeState, value);
    const withPendingAction = applyOptionalPendingAction(withVitality, value);
    const withPosition = applyOptionalPosition(withPendingAction, value);
    const withMovementSpeed = applyOptionalMovementSpeed(withPosition, value);
    const withFlask = applyOptionalFlaskState(withMovementSpeed, value);
    const withSkillSlot = applyOptionalSkillSlotCooldown(withFlask, value);
    const withObjective = applyOptionalObjective(withSkillSlot, value);
    const withCorpse = applyOptionalCorpse(withObjective, value);
    players.push(withCorpse);
  }

  return {
    connectedPlayerCount: players.length,
    players,
  };
}

export function getCurrentPlayerPresence(
  state: Record<string, unknown>,
  sessionId: string,
): PlayerPresenceEntry | null {
  const presence = getTownRoomPresence(state);
  if (presence === null) {
    return null;
  }

  return presence.players.find((player) => player.sessionId === sessionId) ?? null;
}

function iteratePresenceEntries(source: unknown): readonly Record<string, unknown>[] {
  if (source === null || source === undefined) {
    return [];
  }

  const mapLike = source as {
    forEach?: (fn: (value: unknown, key: string) => void) => void;
    values?: () => IterableIterator<unknown>;
  };

  if (typeof mapLike.forEach === "function") {
    const entries: Record<string, unknown>[] = [];
    mapLike.forEach((value) => {
      if (isRecord(value)) {
        entries.push(value);
      }
    });
    return entries;
  }

  if (typeof mapLike.values === "function") {
    const entries: Record<string, unknown>[] = [];
    for (const value of mapLike.values()) {
      if (isRecord(value)) {
        entries.push(value);
      }
    }
    return entries;
  }

  if (isRecord(source)) {
    return Object.values(source).filter(isRecord);
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function applyOptionalProgression(
  entry: PlayerPresenceEntry,
  value: Record<string, unknown>,
): PlayerPresenceEntry {
  const rawLevel = value.level;
  const rawXp = value.xp;
  if (typeof rawLevel !== "number" || typeof rawXp !== "number") {
    return entry;
  }
  if (!Number.isFinite(rawLevel) || !Number.isFinite(rawXp)) {
    return entry;
  }
  return {
    ...entry,
    level: Math.max(1, Math.floor(rawLevel)),
    xp: Math.max(0, Math.floor(rawXp)),
  };
}

function applyOptionalLifeState(
  entry: PlayerPresenceEntry,
  value: Record<string, unknown>,
): PlayerPresenceEntry {
  const rawLifeState = value.lifeState;
  if (rawLifeState !== "alive" && rawLifeState !== "downed") {
    return entry;
  }
  return { ...entry, lifeState: rawLifeState };
}

function applyOptionalVitality(
  entry: PlayerPresenceEntry,
  value: Record<string, unknown>,
): PlayerPresenceEntry {
  const rawHp = value.hp;
  const rawMaxHp = value.maxHp;
  if (
    typeof rawHp !== "number" ||
    typeof rawMaxHp !== "number" ||
    !Number.isFinite(rawHp) ||
    !Number.isFinite(rawMaxHp)
  ) {
    return entry;
  }

  return {
    ...entry,
    hp: Math.max(0, rawHp),
    maxHp: Math.max(0, rawMaxHp),
  };
}

function applyOptionalSpawnPoint(
  entry: PlayerPresenceEntry,
  value: Record<string, unknown>,
): PlayerPresenceEntry {
  const rawSpawnPointId = value.spawnPointId;
  if (typeof rawSpawnPointId !== "string" || rawSpawnPointId.length === 0) {
    return entry;
  }
  return {
    ...entry,
    spawnPointId: rawSpawnPointId as SpawnPointId,
  };
}

// Task 207 -- extract the server-owned deferred action kind for
// this player, when present. The local UI uses this to show a
// transient "Moving to ..." label above the player placeholder while
// the player is walking toward a queued target. The client only
// reads this for display; the server still owns the action outcome.
function applyOptionalPendingAction(
  entry: PlayerPresenceEntry,
  value: Record<string, unknown>,
): PlayerPresenceEntry {
  const hasPending = value.hasPendingAction === true;
  const rawType = value.pendingActionType;
  if (!hasPending) {
    return entry;
  }
  if (rawType !== "attack" && rawType !== "interact" && rawType !== "pickup") {
    return entry;
  }
  return { ...entry, pendingActionType: rawType };
}

function applyOptionalPosition(
  entry: PlayerPresenceEntry,
  value: Record<string, unknown>,
): PlayerPresenceEntry {
  const rawX = value.x;
  const rawY = value.y;
  if (typeof rawX !== "number" || typeof rawY !== "number") {
    return entry;
  }
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
    return entry;
  }
  const position: PlayerPosition = { x: rawX, y: rawY };
  return { ...entry, position };
}

function applyOptionalMovementSpeed(
  entry: PlayerPresenceEntry,
  value: Record<string, unknown>,
): PlayerPresenceEntry {
  const rawMovementSpeed = value.movementSpeed;
  if (typeof rawMovementSpeed !== "number") {
    return entry;
  }
  if (!Number.isFinite(rawMovementSpeed) || rawMovementSpeed <= 0) {
    return entry;
  }
  return { ...entry, movementSpeed: rawMovementSpeed };
}

function applyOptionalFlaskState(
  entry: PlayerPresenceEntry,
  value: Record<string, unknown>,
): PlayerPresenceEntry {
  const rawCharges = value.flaskCharges;
  const rawMax = value.maxFlaskCharges;
  if (typeof rawCharges !== "number" || typeof rawMax !== "number") {
    return entry;
  }
  if (!Number.isFinite(rawCharges) || !Number.isFinite(rawMax)) {
    return entry;
  }
  return {
    ...entry,
    flaskCharges: Math.max(0, rawCharges),
    maxFlaskCharges: Math.max(0, rawMax),
  };
}

function applyOptionalSkillSlotCooldown(
  entry: PlayerPresenceEntry,
  value: Record<string, unknown>,
): PlayerPresenceEntry {
  const rawNextSkillSlotAt = value.nextSkillSlotAt;
  if (typeof rawNextSkillSlotAt !== "number" || !Number.isFinite(rawNextSkillSlotAt)) {
    return entry;
  }
  return {
    ...entry,
    nextSkillSlotAt: Math.max(0, rawNextSkillSlotAt),
  };
}

function applyOptionalCorpse(
  entry: PlayerPresenceEntry,
  value: Record<string, unknown>,
): PlayerPresenceEntry {
  if (value.hasCorpse === true) {
    const rawX = value.corpseX;
    const rawY = value.corpseY;
    if (typeof rawX === "number" && typeof rawY === "number" && Number.isFinite(rawX) && Number.isFinite(rawY)) {
      return { ...entry, hasCorpse: true, corpsePosition: { x: rawX, y: rawY } };
    }
    return { ...entry, hasCorpse: true };
  }
  return entry;
}

function applyOptionalObjective(
  entry: PlayerPresenceEntry,
  value: Record<string, unknown>,
): PlayerPresenceEntry {
  const hasObjective = value.hasObjective === true;
  const objectiveRewardGranted = value.objectiveRewardGranted === true;

  if (!hasObjective) {
    return {
      ...entry,
      hasObjective: false,
      objectiveRewardGranted,
    };
  }

  const rawId = value.objectiveId;
  const rawLabel = value.objectiveLabel;
  const rawDescriptionKey = value.objectiveDescriptionKey;
  const rawCurrent = value.objectiveCurrent;
  const rawTarget = value.objectiveTarget;
  const rawCompleted = value.objectiveCompleted;

  if (
    typeof rawId !== "string" || rawId.length === 0
    || typeof rawLabel !== "string"
    || typeof rawCurrent !== "number"
    || typeof rawTarget !== "number"
    || typeof rawCompleted !== "boolean"
    || !Number.isFinite(rawCurrent)
    || !Number.isFinite(rawTarget)
  ) {
    return {
      ...entry,
      hasObjective: true,
      objectiveRewardGranted,
    };
  }

  // Look up content to get rewards (for completed objective display)
  // and to resolve target enemy label for HUD feedback.
  // Cast rawId to ObjectiveId for the content registry lookup
  const objectiveId = rawId as ObjectiveId;
  const content = contentRegistry?.objectives?.get?.(objectiveId);
  const xpReward = content?.xpReward;
  const copperReward = content?.copperReward;

  // Resolve human-readable target enemy label(s) from content.
  // If the objective targets multiple enemies, combine their names.
  let targetEnemyLabel: string | undefined;
  if (content !== undefined && content.targetEnemyIds.length > 0) {
    const enemyNames = content.targetEnemyIds.map((eid) => {
      const enemyDef = contentRegistry?.enemies?.get?.(eid);
      if (enemyDef !== undefined) {
        try {
          return t(enemyDef.nameKey);
        } catch {
          return eid;
        }
      }
      return eid;
    });
    targetEnemyLabel = enemyNames.length === 1
      ? enemyNames[0]
      : enemyNames.join(" / ");
  }

  return {
    ...entry,
    hasObjective: true,
    objectiveRewardGranted,
    objective: {
      id: rawId,
      label: rawLabel,
      ...(typeof rawDescriptionKey === "string" && rawDescriptionKey.length > 0
        ? { descriptionKey: rawDescriptionKey }
        : {}),
      current: Math.max(0, Math.floor(rawCurrent)),
      target: Math.max(1, Math.floor(rawTarget)),
      completed: rawCompleted,
      ...(xpReward !== undefined && { xpReward }),
      ...(copperReward !== undefined && { copperReward }),
      targetEnemyLabel,
    },
  };
}
