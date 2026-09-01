import type { Room } from "@colyseus/sdk";
import type {
  DeferredActionQueuedServerMessage,
  RoomState,
  InteractResponseServerMessage,
  ObjectiveUpdatedServerMessage,
} from "@doomscrolls/shared";

export type AvailableObjectiveEntry = {
  readonly objectiveId: string;
  readonly titleKey: string;
  readonly descriptionKey: string;
};

/**
 * Task 057 — Interactable Object Foundation Batch
 *
 * Register listeners for interact responses from the server.
 * Display response messages safely to the player.
 */
export function registerInteractResponseListener(
  room: Room<RoomState>,
  onResponse: (message: string, objectId?: string, availableObjectives?: readonly AvailableObjectiveEntry[]) => void,
  onObjectiveUpdated?: (message: ObjectiveUpdatedServerMessage) => void,
): void {
  room.onMessage("interact_response", (raw: unknown) => {
    const msg = raw as Partial<InteractResponseServerMessage> | null;
    if (!msg || typeof msg.message !== "string") {
      return;
    }
    const availableObjectives = Array.isArray(msg.availableObjectives)
      ? (msg.availableObjectives as readonly AvailableObjectiveEntry[])
      : undefined;
    onResponse(msg.message, msg.objectId, availableObjectives);
  });

  room.onMessage("deferred_action_queued", (raw: unknown) => {
    const msg = raw as Partial<DeferredActionQueuedServerMessage> | null;
    if (!msg || typeof msg.message !== "string") {
      return;
    }
    onResponse(msg.message);
  });

  room.onMessage("objective_updated", (raw: unknown) => {
    const msg = raw as Partial<ObjectiveUpdatedServerMessage> | null;
    if (
      !msg
      || msg.type !== "objective_updated"
      || typeof msg.objectiveId !== "string"
      || typeof msg.label !== "string"
      || typeof msg.current !== "number"
      || typeof msg.target !== "number"
      || typeof msg.completed !== "boolean"
    ) {
      return;
    }
    onObjectiveUpdated?.({
      type: "objective_updated",
      objectiveId: msg.objectiveId,
      label: msg.label,
      ...(typeof msg.descriptionKey === "string" && msg.descriptionKey.length > 0
        ? { descriptionKey: msg.descriptionKey }
        : {}),
      current: msg.current,
      target: msg.target,
      completed: msg.completed,
      ...(typeof msg.readyToTurnIn === "boolean"
        ? { readyToTurnIn: msg.readyToTurnIn }
        : {}),
      ...(typeof msg.xpReward === "number"
        ? { xpReward: msg.xpReward }
        : {}),
      ...(typeof msg.copperReward === "number"
        ? { copperReward: msg.copperReward }
        : {}),
    });
  });
}
