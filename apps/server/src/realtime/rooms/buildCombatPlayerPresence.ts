import { contentRegistry } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";
import type { CharacterClassKey, CharacterId, SpawnPointId, ZoneId } from "@doomscrolls/shared";
import { PlayerPresence } from "./PlayerPresence";
import { isPositionInsideZoneBounds } from "./validateCharacterLocation";
import { restoreFlaskToFull } from "./healingFlaskConfig";
import { COMBAT_SPAWN_BOX } from "./initializeCombatEnemies";
import { applyPersistedObjectiveSlot, type PersistedObjectiveState } from "./buildPlayerPresence";

export interface BuildCombatPlayerPresenceInput {
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
  readonly objectiveState?: PersistedObjectiveState | undefined;
  /** Core 0.15 -- second concurrent objective slot, mirrors objectiveState. */
  readonly objectiveState2?: PersistedObjectiveState | undefined;
  readonly completedObjectives?: readonly {
    readonly objectiveId: string;
  }[];
}

const EMPTY_SPAWN_POINT_ID = "" as SpawnPointId;

/**
 * Builds a minimal CombatRoom PlayerPresence for the foundation.
 *
 * Task 263 scope: thin helper that mirrors the *shape* of
 * `buildTownPlayerPresence()` so the CombatRoom file can stay a thin
 * Colyseus shell. It deliberately does NOT resolve a combat spawn
 * point — none exists in content yet (see Task 262). Instead it
 * restores a previously persisted location if it is valid for the
 * resolved zone, and otherwise falls back to a deterministic
 * zone-bounds center.
 *
 * Future dedicated tasks (Task 264+) are expected to add a real
 * combat spawn point to content and replace this helper's spawn
 * logic with a shared spawn-point resolver, not duplicate `TownRoom`.
 *
 * The presence is otherwise structurally identical to the town one
 * (same schema, same flask restoration rule) so the existing client
 * presence reader can be reused once a combat join succeeds.
 */
export function buildCombatPlayerPresence(
  input: BuildCombatPlayerPresenceInput,
): PlayerPresence {
  const restoredZoneId = input.restoredLocationZoneId as ZoneId | undefined;
  const hasRestoredPosition =
    restoredZoneId !== undefined &&
    // The restored position must belong to the zone actually being
    // joined, not merely satisfy *some* zone's bounds. Without this,
    // a stale/mismatched (zoneId, x, y) triple -- e.g. a nightmarket
    // position left behind by a room the player has since left --
    // could pass the bounds check below purely by numeric coincidence
    // (nightmarket's bounds are far larger than any combat zone's) and
    // be used as a combat-zone spawn point anyway. Mirrors the same
    // zone-match guard `resolvePlayerInitialPosition` already applies
    // for TownRoom's own restoration.
    restoredZoneId === input.resolvedZoneId &&
    input.restoredLocationX !== undefined &&
    input.restoredLocationY !== undefined &&
    Number.isFinite(input.restoredLocationX) &&
    Number.isFinite(input.restoredLocationY) &&
    isPositionInsideZoneBounds(
      restoredZoneId,
      input.restoredLocationX,
      input.restoredLocationY,
    );

  // Fallback lands inside the zone's own safe interior box (the same
  // one respawn already uses), not the raw (0, 0) zone corner -- a
  // bare corner has no guarantee of being real, walkable floor.
  const initialX = hasRestoredPosition
    ? (input.restoredLocationX as number)
    : Math.round((COMBAT_SPAWN_BOX.minX + COMBAT_SPAWN_BOX.maxX) / 2);
  const initialY = hasRestoredPosition
    ? (input.restoredLocationY as number)
    : Math.round((COMBAT_SPAWN_BOX.minY + COMBAT_SPAWN_BOX.maxY) / 2);

  const presence = new PlayerPresence(
    input.sessionId,
    input.characterId,
    input.displayName,
    input.classKey,
    input.level,
    input.xp,
    EMPTY_SPAWN_POINT_ID,
    input.hp,
    input.maxHp,
    initialX,
    initialY,
    input.movementSpeed,
    input.attackCooldownMs,
    input.damage,
    input.armor,
  );
  restoreFlaskToFull(presence);
  const restoredFlaskCharges = Number.isFinite(input.restoredFlaskCharges)
    ? Math.floor(input.restoredFlaskCharges ?? 0)
    : presence.maxFlaskCharges;
  presence.flaskCharges = Math.min(
    presence.maxFlaskCharges,
    Math.max(0, restoredFlaskCharges),
  );

  applyPersistedObjectiveSlot(presence, 1, input.objectiveState);
  applyPersistedObjectiveSlot(presence, 2, input.objectiveState2);

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
