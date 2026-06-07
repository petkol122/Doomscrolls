import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import type {
  RequestUseHealingFlaskAcceptedServerMessage,
  RequestUseHealingFlaskRejectedServerMessage,
  RoomState as DoomscrollsRoomState,
} from "@doomscrolls/shared";

import { t } from "@doomscrolls/localization";

import {
  registerHealingFlaskResponseListeners,
  sendHealingFlaskIntent,
} from "../../../net/healingFlaskIntentClient";
import { shouldIgnoreWorldSessionCombatHotkey } from "./worldSessionCombatHotkeyFocus";

export interface WorldSessionHealingFlaskInputCallbacks {
  readonly onFlaskSentFeedback: (message: string) => void;
  readonly onFlaskAcceptedFeedback: (message: RequestUseHealingFlaskAcceptedServerMessage) => void;
  readonly onFlaskRejectedFeedback: (message: RequestUseHealingFlaskRejectedServerMessage) => void;
}

export interface WorldSessionHealingFlaskInput {
  readonly destroy: () => void;
}

export function attachWorldSessionHealingFlaskInput(
  scene: Phaser.Scene,
  room: Room<DoomscrollsRoomState>,
  callbacks: WorldSessionHealingFlaskInputCallbacks,
): WorldSessionHealingFlaskInput {
  const sendFlask = (): void => {
    if (shouldIgnoreWorldSessionCombatHotkey()) {
      return;
    }

    const result = sendHealingFlaskIntent(room);
    if (result.dispatched) {
      callbacks.onFlaskSentFeedback(t("world_area.flask_sent"));
    }
  };

  const keyboard = scene.input.keyboard;
  let qKey: Phaser.Input.Keyboard.Key | null = null;
  let handleWindowKeyDown: ((event: KeyboardEvent) => void) | null = null;

  if (keyboard !== null) {
    qKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    qKey.on("down", sendFlask);
  }

  handleWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }
    const isQKey = event.code === "KeyQ"
      || event.key === "q"
      || event.key === "Q";
    if (!isQKey) {
      return;
    }
    sendFlask();
  };

  window.addEventListener("keydown", handleWindowKeyDown);

  registerHealingFlaskResponseListeners(room, {
    onAccepted: (message) => {
      callbacks.onFlaskAcceptedFeedback(message);
    },
    onRejected: (message) => {
      callbacks.onFlaskRejectedFeedback(message);
    },
  });

  return {
    destroy: () => {
      if (qKey !== null) {
        qKey.off("down", sendFlask);
      }
      if (handleWindowKeyDown !== null) {
        window.removeEventListener("keydown", handleWindowKeyDown);
      }
    },
  };
}