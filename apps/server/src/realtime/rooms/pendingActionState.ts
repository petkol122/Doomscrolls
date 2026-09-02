import type { PlayerPresence } from "./PlayerPresence";

export type PendingActionType = "attack" | "interact" | "pickup" | "skill_primary" | "skill_secondary" | "skill_tertiary" | "corpse_interact" | "zone_transition";

export interface PendingActionTarget {
  readonly type: PendingActionType;
  readonly targetId: string;
  readonly targetX: number;
  readonly targetY: number;
}

export function setPendingAction(
  player: PlayerPresence,
  pending: PendingActionTarget,
): void {
  player.hasPendingAction = true;
  player.pendingActionType = pending.type;
  player.pendingTargetId = pending.targetId;
  player.pendingTargetX = pending.targetX;
  player.pendingTargetY = pending.targetY;
}

export function clearPendingAction(player: PlayerPresence): void {
  player.hasPendingAction = false;
  player.pendingActionType = "";
  player.pendingTargetId = "";
  player.pendingTargetX = player.x;
  player.pendingTargetY = player.y;
}