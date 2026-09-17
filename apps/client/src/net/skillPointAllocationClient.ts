import type { Room } from "@colyseus/sdk";
import type {
  RequestAllocateSkillPointAcceptedServerMessage,
  RequestAllocateSkillPointClientMessage,
  RequestAllocateSkillPointRejectedServerMessage,
  RoomState,
} from "@doomscrolls/shared";

export type SendAllocateSkillPointResult =
  | { readonly dispatched: true }
  | { readonly dispatched: false; readonly reason: "no_room" | "room_not_joined" };

export function sendAllocateSkillPointIntent(
  room: Room<RoomState> | null | undefined,
  slot: "primary" | "secondary" | "tertiary",
): SendAllocateSkillPointResult {
  if (!room) {
    return { dispatched: false, reason: "no_room" };
  }
  if (room.connection?.isOpen !== true) {
    return { dispatched: false, reason: "room_not_joined" };
  }

  const message: RequestAllocateSkillPointClientMessage = {
    type: "request_allocate_skill_point",
    slot,
  };
  room.send(message.type, message);
  return { dispatched: true };
}

export function registerAllocateSkillPointResponseListeners(
  room: Room<RoomState>,
  callbacks: {
    readonly onAccepted: (message: RequestAllocateSkillPointAcceptedServerMessage) => void;
    readonly onRejected: (message: RequestAllocateSkillPointRejectedServerMessage) => void;
  },
): void {
  room.onMessage("request_allocate_skill_point_accepted", (raw: unknown) => {
    if (!isAccepted(raw)) {
      return;
    }
    callbacks.onAccepted(raw);
  });

  room.onMessage("request_allocate_skill_point_rejected", (raw: unknown) => {
    if (!isRejected(raw)) {
      return;
    }
    callbacks.onRejected(raw);
  });
}

function isSkillSlot(value: unknown): value is "primary" | "secondary" | "tertiary" {
  return value === "primary" || value === "secondary" || value === "tertiary";
}

function isAccepted(value: unknown): value is RequestAllocateSkillPointAcceptedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.type === "request_allocate_skill_point_accepted"
    && isSkillSlot(candidate.slot)
    && typeof candidate.skillId === "string"
    && typeof candidate.newRank === "number"
    && typeof candidate.remainingSkillPoints === "number";
}

function isRejected(value: unknown): value is RequestAllocateSkillPointRejectedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.type === "request_allocate_skill_point_rejected"
    && isSkillSlot(candidate.slot)
    && typeof candidate.reason === "string";
}
