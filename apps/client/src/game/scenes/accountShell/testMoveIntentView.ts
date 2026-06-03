import { t } from "@doomscrolls/localization";
import type { Room } from "@colyseus/sdk";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import {
  sendMovementIntent,
  type SendMovementIntentResult
} from "../../../net/movementIntentClient";
import { createButton } from "./accountShellDom";

// ---------------------------------------------------------------------------
// Test movement intent UI (Task 027 — Client Movement Intent UI Stub Batch)
//
// This module is intentionally tiny and isolated from AccountShellScene.
// It owns a single dev-only button that sends one hardcoded, well-formed
// `request_move` intent through the already-joined Colyseus room using the
// `sendMovementIntent()` helper. It does NOT:
//
//   - read mouse / pointer / keyboard input
//   - know about maps, collision, pathfinding or movement simulation
//   - update any local or server-side player position
//   - pretend movement happened
//
// The button is purely a developer affordance to verify that the network
// contract from Task 026 wires up end-to-end through the client UI. The
// server only validates intent shape and range; it does not move the
// player. Feedback is intentionally short and safe.
// ---------------------------------------------------------------------------

/**
 * Hardcoded test target used by the dev button. Chosen to be a generic
 * "somewhere inside the room" value that passes the temporary default
 * movement intent bounds and is not equal to the spawn point.
 */
const TEST_MOVE_TARGET_X = 420;
const TEST_MOVE_TARGET_Y = 320;

export interface TestMoveIntentButtonElements {
  readonly container: HTMLElement;
  readonly status: HTMLElement;
}

/**
 * Create the dev-only "Send test move intent" button + a small status
 * line. The caller is expected to append `container` to a section that
 * is only visible after Enter World (so the button never appears before
 * a room has been joined).
 */
export function createTestMoveIntentButton(
  room: Room<DoomscrollsRoomState> | null
): TestMoveIntentButtonElements {
  const container = document.createElement("div");
  container.style.marginTop = "12px";

  const status = document.createElement("p");
  status.style.margin = "6px 0 0";
  status.style.fontSize = "13px";
  status.style.color = "#a88d63";

  const button = createButton("Send test move intent");
  button.setAttribute("aria-describedby", "doomscrolls-test-move-intent-status");
  button.addEventListener("click", () => {
    const result: SendMovementIntentResult = sendMovementIntent(
      room,
      TEST_MOVE_TARGET_X,
      TEST_MOVE_TARGET_Y
    );
    applyResult(result, status);
  });

  container.appendChild(button);
  status.id = "doomscrolls-test-move-intent-status";
  status.textContent = t("world_entry.test_move_intent_idle");
  container.appendChild(status);

  return { container, status };
}

function applyResult(
  result: SendMovementIntentResult,
  status: HTMLElement
): void {
  if (result.dispatched) {
    status.textContent = t("world_entry.test_move_intent_sent");
    status.style.color = "#b9d49a";
    return;
  }
  status.textContent = t("world_entry.test_move_intent_error");
  status.style.color = "#ff9c8a";
}
