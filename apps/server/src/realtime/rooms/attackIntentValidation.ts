import type { EnemyPresence } from "@doomscrolls/shared";

import type { PlayerPresence } from "./PlayerPresence";
import type { TownRoomState } from "./TownRoomState";

export const BASIC_ATTACK_RANGE = 64;

export type AttackIntentRejectedReason =
  | "player_not_ready"
  | "enemy_not_found"
  | "out_of_range";

export type AttackIntentValidationResult =
  | {
      readonly ok: true;
      readonly enemy: EnemyPresence;
      readonly distance: number;
    }
  | {
      readonly ok: false;
      readonly reason: AttackIntentRejectedReason;
    };

export function validateAttackIntent(
  state: TownRoomState,
  player: PlayerPresence | undefined,
  targetEnemyId: string,
): AttackIntentValidationResult {
  if (player === undefined) {
    return { ok: false, reason: "player_not_ready" };
  }

  if (typeof targetEnemyId !== "string" || targetEnemyId.length === 0) {
    return { ok: false, reason: "enemy_not_found" };
  }

  const enemy = state.enemies.get(targetEnemyId);
  if (enemy === undefined) {
    return { ok: false, reason: "enemy_not_found" };
  }

  const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
  if (distance > BASIC_ATTACK_RANGE) {
    return { ok: false, reason: "out_of_range" };
  }

  return { ok: true, enemy, distance };
}