import type { TownRoomState } from "./TownRoomState";

/**
 * Task 057 — Interactable Object Foundation Batch
 *
 * Validate an interact request.
 * Simple distance check: player must be within ~50 units of the object.
 */
export interface InteractValidationResult {
  readonly ok: boolean;
  readonly reason?: "object_not_found" | "out_of_range" | "invalid_shape" | "player_downed";
  readonly message?: string;
}

const INTERACT_DISTANCE = 50;

export function validateInteractIntent(
  state: TownRoomState,
  playerX: number,
  playerY: number,
  objectId: string,
  playerLifeState?: string,
): InteractValidationResult {
  if (playerLifeState !== undefined && playerLifeState !== "alive") {
    return { ok: false, reason: "player_downed" };
  }

  if (typeof objectId !== "string" || objectId.length === 0) {
    return { ok: false, reason: "invalid_shape" };
  }

  const interactable = state.interactables.get(objectId);
  if (!interactable) {
    return { ok: false, reason: "object_not_found" };
  }

  const dx = interactable.x - playerX;
  const dy = interactable.y - playerY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > INTERACT_DISTANCE) {
    return { ok: false, reason: "out_of_range" };
  }

  return { ok: true };
}

/**
 * Get a safe response message for an interactable object.
 * Currently hardcoded. Future: read from content definitions.
 */
export function getInteractableResponseMessage(objectId: string): string {
  const responses: Record<string, string> = {
    nightmarket_notice_board: "The notice board hums quietly.",
  };
  return responses[objectId] ?? "You interact with the object.";
}
