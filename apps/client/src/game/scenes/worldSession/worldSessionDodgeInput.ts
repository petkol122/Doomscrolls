import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";

import { t } from "@doomscrolls/localization";

import {
  sendDodgeIntent,
  registerDodgeResponseListeners,
} from "../../../net/dodgeIntentClient";
import { shouldIgnoreWorldSessionCombatHotkey } from "./worldSessionCombatHotkeyFocus";

// ---------------------------------------------------------------------------
// Task 095 -- World Session Dodge Input.
//
// Tiny, isolated module that wires the Spacebar to a server-authoritative
// dodge intent in the world session scene. The module owns the keyboard
// listener lifetime, the last-known movement direction, the room message
// listeners, and the safe UI feedback callbacks.
//
// The module does NOT:
//   - mutate any server state
//   - decide whether the dodge is valid (the server is authoritative)
//   - read mouse or pointer input
//   - render any UI of its own (it only forwards safe text messages
//     back to caller-supplied feedback callbacks)
//
// The "last movement direction" is the unit vector from the player's
// server-synced position to the last click target stored by the world
// area view. If there is no last click target, the module returns a
// safe "no direction" notice and does not send anything.
// ---------------------------------------------------------------------------

// Task 246 -- the input module forwards the typed reason, not just text.
//   - onDodgeSentFeedback         -> dispatched
//   - onDodgeConfirmedFeedback    -> server accepted
//   - onDodgeCooldownFeedback     -> server reason "dodge_on_cooldown"
//   - onDodgeDownedFeedback       -> server reason "player_downed"
//   - onDodgeNoDirectionFeedback  -> client could not derive a direction
//   - onDodgeRejectedFeedback     -> generic server rejection or send failure
export interface WorldSessionDodgeInputCallbacks {
  readonly onDodgeSentFeedback: (message: string) => void;
  readonly onDodgeConfirmedFeedback: (message: string) => void;
  readonly onDodgeCooldownFeedback: (message: string) => void;
  readonly onDodgeDownedFeedback: (message: string) => void;
  readonly onDodgeNoDirectionFeedback: (message: string) => void;
  readonly onDodgeRejectedFeedback: (message: string) => void;
}

export interface LastClickTargetProvider {
  readonly getLastClickTarget: () => { readonly x: number; readonly y: number } | null;
  readonly getSelfPosition: () => { readonly x: number; readonly y: number } | null;
}

export interface WorldSessionDodgeInput {
  readonly handleDodgePressed: () => void;
  readonly destroy: () => void;
}

/**
 * Compute a unit (or zero) direction from `self` to `target`.
 * Returns `{x: 0, y: 0}` when the target equals the player or
 * when the input is not finite.
 */
export function computeUnitDirection(
  self: { readonly x: number; readonly y: number },
  target: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } {
  const dx = target.x - self.x;
  const dy = target.y - self.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 0) {
    return { x: 0, y: 0 };
  }
  return { x: dx / length, y: dy / length };
}

export function attachWorldSessionDodgeInput(
  scene: Phaser.Scene,
  room: Room<DoomscrollsRoomState>,
  provider: LastClickTargetProvider,
  callbacks: WorldSessionDodgeInputCallbacks,
): WorldSessionDodgeInput {
  const sendDodge = (): void => {
    if (shouldIgnoreWorldSessionCombatHotkey()) {
      return;
    }

    const self = provider.getSelfPosition();
    const target = provider.getLastClickTarget();
    if (self === null || target === null) {
      callbacks.onDodgeNoDirectionFeedback(t("world_area.dodge_no_direction"));
      return;
    }
    const dir = computeUnitDirection(self, target);
    if (dir.x === 0 && dir.y === 0) {
      callbacks.onDodgeNoDirectionFeedback(t("world_area.dodge_no_direction"));
      return;
    }
    const result = sendDodgeIntent(room, dir.x, dir.y);
    if (result.dispatched) {
      callbacks.onDodgeSentFeedback(t("world_area.dodge_sent"));
    } else {
      callbacks.onDodgeRejectedFeedback(t("world_area.dodge_unavailable"));
    }
  };

  // Listen for keyboard space. Phaser's keyboard plugin is already
  // enabled in the world session scene via the global input manager.
  const keyboard = scene.input.keyboard;
  let spaceKey: Phaser.Input.Keyboard.Key | null = null;
  let handleSpaceKeyDown: (() => void) | null = null;
  let handleWindowKeyDown: ((event: KeyboardEvent) => void) | null = null;
  if (keyboard !== null) {
    spaceKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    handleSpaceKeyDown = () => {
      sendDodge();
    };
    spaceKey.on("down", handleSpaceKeyDown);
  }

  handleWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }
    if (event.key !== " ") {
      return;
    }
    sendDodge();
  };

  window.addEventListener("keydown", handleWindowKeyDown);

  // Register server response listeners once; they live for the
  // lifetime of the room and are torn down when the scene shuts down.
  registerDodgeResponseListeners(room, {
    onAccepted: () => {
      callbacks.onDodgeConfirmedFeedback(t("world_area.dodge_confirmed"));
    },
    onRejected: (message) => {
      if (message.reason === "dodge_on_cooldown") {
        callbacks.onDodgeCooldownFeedback(t("world_area.dodge_on_cooldown"));
        return;
      }
      if (message.reason === "player_downed") {
        callbacks.onDodgeDownedFeedback(t("world_area.dodge_downed"));
        return;
      }
      // Server stays authoritative; any other reason maps to a safe
      // generic rejection. Server must never leak Prisma/stack details.
      callbacks.onDodgeRejectedFeedback(t("world_area.dodge_unavailable"));
    },
  });

  return {
    handleDodgePressed: sendDodge,
    destroy: () => {
      if (spaceKey !== null && handleSpaceKeyDown !== null) {
        spaceKey.off("down", handleSpaceKeyDown);
      }
      if (handleWindowKeyDown !== null) {
        window.removeEventListener("keydown", handleWindowKeyDown);
      }
    },
  };
}
