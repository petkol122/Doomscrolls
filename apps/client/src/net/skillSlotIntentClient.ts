import type { Room } from "@colyseus/sdk";
import type {
  RequestUseSkillSlotAcceptedServerMessage,
  RequestUseSkillSlotClientMessage,
  RequestUseSkillSlotRejectedServerMessage,
  RoomState,
} from "@doomscrolls/shared";

export type SendSkillSlotIntentResult =
  | { readonly dispatched: true }
  | { readonly dispatched: false; readonly reason: "no_room" | "room_not_joined" };

export function sendSkillSlotIntent(
  room: Room<RoomState> | null | undefined,
): SendSkillSlotIntentResult {
  if (!room) {
    return { dispatched: false, reason: "no_room" };
  }
  if (room.connection?.isOpen !== true) {
    return { dispatched: false, reason: "room_not_joined" };
  }

  const message: RequestUseSkillSlotClientMessage = {
    type: "request_use_skill_slot",
    slot: "secondary",
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

function isAccepted(value: unknown): value is RequestUseSkillSlotAcceptedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.type === "request_use_skill_slot_accepted" && candidate.slot === "secondary";
}

function isRejected(value: unknown): value is RequestUseSkillSlotRejectedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.type === "request_use_skill_slot_rejected"
    && candidate.slot === "secondary"
    && typeof candidate.reason === "string";
}