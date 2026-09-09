import type { RequestChatRejectedReason } from "@doomscrolls/shared";

// ---------------------------------------------------------------------------
// Core 0.29 -- Room-Local Chat.
//
// Server-side validator for `request_chat` client intents. Mirrors the
// shape of `validateDodgeIntent`:
//
//   - validates intent SHAPE (must look like RequestChatClientMessage)
//   - trims the text and validates it is non-empty
//   - validates the trimmed text does not exceed the length cap
//
// Out of scope (deferred to a later build, see docs/CORE_BUILD_0_29_PLAN.md):
//   - profanity / moderation filtering
//   - rich text / markup / links / chat commands
//
// This helper is intentionally generic across TownRoom and CombatRoom.
// It does NOT check rate limiting or room membership -- those are
// gated by the room handler using the player presence and the chat
// cooldown module, so this helper stays pure and side-effect free.
// ---------------------------------------------------------------------------

export const MAX_CHAT_MESSAGE_LENGTH = 240;

export interface ChatMessageValidationInput {
  /**
   * Raw, untrusted message payload as received from the client. The
   * validator only reads `type` and `text`; any other fields are
   * ignored.
   */
  readonly message: unknown;
}

export type ChatMessageValidationResult =
  | {
      readonly ok: true;
      readonly text: string;
    }
  | {
      readonly ok: false;
      readonly reason: RequestChatRejectedReason;
    };

interface RequestChatShape {
  readonly type: "request_chat" | "request_global_chat";
  readonly text: string;
}

export function validateChatMessage(
  input: ChatMessageValidationInput,
): ChatMessageValidationResult {
  return validateChatMessageShaped(input.message, "request_chat");
}

/**
 * Global-chat counterpart of {@link validateChatMessage}. Same trim /
 * non-empty / length-cap rules -- only the expected `type` differs, so
 * this shares the body rather than duplicating it.
 */
export function validateGlobalChatMessage(
  input: ChatMessageValidationInput,
): ChatMessageValidationResult {
  return validateChatMessageShaped(input.message, "request_global_chat");
}

function validateChatMessageShaped(
  message: unknown,
  expectedType: RequestChatShape["type"],
): ChatMessageValidationResult {
  if (!isRequestChatShaped(message, expectedType)) {
    return { ok: false, reason: "invalid_shape" };
  }

  const trimmed = message.text.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "empty_message" };
  }

  if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) {
    return { ok: false, reason: "message_too_long" };
  }

  return { ok: true, text: trimmed };
}

function isRequestChatShaped(
  value: unknown,
  expectedType: RequestChatShape["type"],
): value is RequestChatShape {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== expectedType) {
    return false;
  }
  if (typeof candidate.text !== "string") {
    return false;
  }
  return true;
}
