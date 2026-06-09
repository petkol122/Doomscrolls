import type { CharacterId, SpawnPointId, ZoneId } from "@doomscrolls/shared";
import { PlayerPresence } from "./PlayerPresence";
import { isPositionInsideZoneBounds } from "./validateCharacterLocation";
import { restoreFlaskToFull } from "./healingFlaskConfig";

export interface BuildCombatPlayerPresenceInput {
  readonly sessionId: string;
  readonly characterId: CharacterId;
  readonly displayName: string;
  readonly level: number;
  readonly xp: number;
  readonly resolvedZoneId: ZoneId;
  readonly hp: number;
  readonly maxHp: number;
  readonly restoredFlaskCharges: number | undefined;
  readonly movementSpeed: number;
  readonly attackCooldownMs: number;
  readonly restoredLocationZoneId: string | undefined;
  readonly restoredLocationX: number | undefined;
  readonly restoredLocationY: number | undefined;
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
    input.restoredLocationX !== undefined &&
    input.restoredLocationY !== undefined &&
    Number.isFinite(input.restoredLocationX) &&
    Number.isFinite(input.restoredLocationY) &&
    isPositionInsideZoneBounds(
      restoredZoneId,
      input.restoredLocationX,
      input.restoredLocationY,
    );

  const initialX = hasRestoredPosition ? (input.restoredLocationX as number) : 0;
  const initialY = hasRestoredPosition ? (input.restoredLocationY as number) : 0;

  const presence = new PlayerPresence(
    input.sessionId,
    input.characterId,
    input.displayName,
    input.level,
    input.xp,
    EMPTY_SPAWN_POINT_ID,
    input.hp,
    input.maxHp,
    initialX,
    initialY,
    input.movementSpeed,
    input.attackCooldownMs,
  );
  restoreFlaskToFull(presence);
  const restoredFlaskCharges = Number.isFinite(input.restoredFlaskCharges)
    ? Math.floor(input.restoredFlaskCharges ?? 0)
    : presence.maxFlaskCharges;
  presence.flaskCharges = Math.min(
    presence.maxFlaskCharges,
    Math.max(0, restoredFlaskCharges),
  );
  return presence;
}
