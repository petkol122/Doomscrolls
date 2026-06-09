import type { Room } from "@colyseus/sdk";
import type {
  DamageAppliedServerMessage,
  EnemyAttackResolvedServerMessage,
  EnemyAttackTelegraphServerMessage,
  RequestAttackAcceptedServerMessage,
  RequestAttackClientMessage,
  RequestAttackRejectedServerMessage,
  RoomState,
} from "@doomscrolls/shared";

export type SendAttackIntentResult =
  | { readonly dispatched: true }
  | { readonly dispatched: false; readonly reason: "no_room" | "room_not_joined" | "invalid_target" };

export function sendAttackIntent(
  room: Room<RoomState> | null | undefined,
  targetEnemyId: string,
): SendAttackIntentResult {
  if (!room) {
    return { dispatched: false, reason: "no_room" };
  }
  if (room.connection?.isOpen !== true) {
    return { dispatched: false, reason: "room_not_joined" };
  }
  if (typeof targetEnemyId !== "string" || targetEnemyId.length === 0) {
    return { dispatched: false, reason: "invalid_target" };
  }

  const message: RequestAttackClientMessage = {
    type: "request_attack",
    targetEnemyId,
  };

  room.send(message.type, message);
  return { dispatched: true };
}

export function registerAttackResponseListeners(
  room: Room<RoomState>,
  callbacks: {
    readonly onAccepted: (message: RequestAttackAcceptedServerMessage) => void;
    readonly onRejected: (message: RequestAttackRejectedServerMessage) => void;
    readonly onDamageApplied?: (message: DamageAppliedServerMessage) => void;
    // Task 094 - server-owned enemy attack telegraph warning.
    readonly onEnemyAttackTelegraph?: (message: EnemyAttackTelegraphServerMessage) => void;
    readonly onEnemyAttackResolved?: (message: EnemyAttackResolvedServerMessage) => void;
  },
): void {
  room.onMessage("request_attack_accepted", (raw: unknown) => {
    if (!isRequestAttackAcceptedServerMessage(raw)) {
      return;
    }
    callbacks.onAccepted(raw);
  });

  room.onMessage("request_attack_rejected", (raw: unknown) => {
    if (!isRequestAttackRejectedServerMessage(raw)) {
      return;
    }
    callbacks.onRejected(raw);
  });

  room.onMessage("damage_applied", (raw: unknown) => {
    if (!isDamageAppliedServerMessage(raw)) {
      return;
    }
    callbacks.onDamageApplied?.(raw);
  });

  room.onMessage("enemy_attack_telegraph", (raw: unknown) => {
    if (!isEnemyAttackTelegraphServerMessage(raw)) {
      return;
    }
    callbacks.onEnemyAttackTelegraph?.(raw);
  });

  room.onMessage("enemy_attack_resolved", (raw: unknown) => {
    if (!isEnemyAttackResolvedServerMessage(raw)) {
      return;
    }
    callbacks.onEnemyAttackResolved?.(raw);
  });
}

function isRequestAttackAcceptedServerMessage(
  value: unknown,
): value is RequestAttackAcceptedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "request_attack_accepted" &&
    typeof candidate.targetEnemyId === "string"
  );
}

function isRequestAttackRejectedServerMessage(
  value: unknown,
): value is RequestAttackRejectedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.type !== "request_attack_rejected") {
    return false;
  }
  if (typeof candidate.reason !== "string") {
    return false;
  }
  if (
    candidate.targetEnemyId !== undefined &&
    typeof candidate.targetEnemyId !== "string"
  ) {
    return false;
  }
  return true;
}

function isDamageAppliedServerMessage(
  value: unknown,
): value is DamageAppliedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "damage_applied" &&
    typeof candidate.targetEntityId === "string" &&
    typeof candidate.damage === "number" &&
    typeof candidate.remainingHp === "number" &&
    (candidate.sourceEntityId === undefined || typeof candidate.sourceEntityId === "string")
  );
}
function isEnemyAttackTelegraphServerMessage(
  value: unknown,
): value is EnemyAttackTelegraphServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "enemy_attack_telegraph" &&
    typeof candidate.enemyId === "string" &&
    typeof candidate.targetEntityId === "string" &&
    typeof candidate.windupMs === "number" &&
    (candidate.attackKind === "normal" || candidate.attackKind === "heavy")
  );
}

function isEnemyAttackResolvedServerMessage(
  value: unknown,
): value is EnemyAttackResolvedServerMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "enemy_attack_resolved"
    && typeof candidate.enemyId === "string"
    && typeof candidate.targetEntityId === "string"
    && (candidate.outcome === "hit" || candidate.outcome === "miss")
    && (candidate.attackKind === "normal" || candidate.attackKind === "heavy")
    && (candidate.damage === undefined || typeof candidate.damage === "number")
    && (candidate.remainingHp === undefined || typeof candidate.remainingHp === "number")
  );
}
