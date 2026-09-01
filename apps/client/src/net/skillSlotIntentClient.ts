import type { Room } from "@colyseus/sdk";
import type {
  RequestUseSkillSlotAcceptedServerMessage,
  RequestUseSkillSlotClientMessage,
  RequestUseSkillSlotRejectedServerMessage,
  RoomState,
} from "@doomscrolls/shared";

export type SendSkillSlotIntentResult =
  | { readonly dispatched: true }
  | { readonly dispatched: false; readonly reason: "no_room" | "room_not_joined" | "no_target" };

export function sendSkillSlotIntent(
  room: Room<RoomState> | null | undefined,
  slot: "secondary" | "tertiary",
  targetEnemyId?: string,
): SendSkillSlotIntentResult {
  if (!room) {
    return { dispatched: false, reason: "no_room" };
  }
  if (room.connection?.isOpen !== true) {
    return { dispatched: false, reason: "room_not_joined" };
  }
  if (typeof targetEnemyId !== "string" || targetEnemyId.length === 0) {
    return { dispatched: false, reason: "no_target" };
  }

  const message: RequestUseSkillSlotClientMessage = {
    type: "request_use_skill_slot",
    slot,
    targetEnemyId,
  };

  room.send(message.type, message);
  return { dispatched: true };
}

export function registerSkillSlotResponseListeners(
  room: Room<RoomState>,
  callbacks: {
    readonly onAccepted: (message: RequestUseSkillSlotAcceptedServerMessage) => void;
    readonly onRejected: (message: RequestUseSkillSlotRejectedServerMessage) => void;
  },
): void {
  room.onMessage("request_use_skill_slot_accepted", (raw: unknown) => {
    if (!isAccepted(raw)) {
      return;
    }
    callbacks.onAccepted(raw);
  });

  room.onMessage("request_use_skill_slot_rejected", (raw: unknown) => {
    if (!isRejected(raw)) {
      return;
    }
    callbacks.onRejected(raw);
  });
}

function isSkillSlot(value: unknown): value is "secondary" | "tertiary" {
  return value === "secondary" || value === "tertiary";
}

function isAccepted(value: unknown): value is RequestUseSkillSlotAcceptedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.type === "request_use_skill_slot_accepted" && isSkillSlot(candidate.slot);
}

function isRejected(value: unknown): value is RequestUseSkillSlotRejectedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.type === "request_use_skill_slot_rejected"
    && isSkillSlot(candidate.slot)
    && typeof candidate.reason === "string";
}