import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import type {
  FlaskBeltSlotNumber,
  RequestUseFlaskSlotAcceptedServerMessage,
  RequestUseFlaskSlotRejectedServerMessage,
  RoomState as DoomscrollsRoomState,
} from "@doomscrolls/shared";

import { t } from "@doomscrolls/localization";

import {
  registerFlaskSlotResponseListeners,
  sendFlaskSlotIntent,
} from "../../../net/flaskBeltIntentClient";
import { shouldIgnoreWorldSessionCombatHotkey } from "./worldSessionCombatHotkeyFocus";

// ---------------------------------------------------------------------------
// Milestone 0.3 -- 4-Slot Flask Belt input. Binds hotkeys 1-4 to
// activation requests for belt slots 1-4, replacing the old single 'Q'
// healing-flask binding. One shared handler covers all four slots
// (mirrors how the 3 skill slots share `request_use_skill_slot`).
// ---------------------------------------------------------------------------

const SLOT_KEY_CODES: readonly { readonly slot: FlaskBeltSlotNumber; readonly phaserKey: number; readonly digit: string }[] = [
  { slot: 1, phaserKey: Phaser.Input.Keyboard.KeyCodes.ONE, digit: "1" },
  { slot: 2, phaserKey: Phaser.Input.Keyboard.KeyCodes.TWO, digit: "2" },
  { slot: 3, phaserKey: Phaser.Input.Keyboard.KeyCodes.THREE, digit: "3" },
  { slot: 4, phaserKey: Phaser.Input.Keyboard.KeyCodes.FOUR, digit: "4" },
];

export interface WorldSessionFlaskBeltInputCallbacks {
  readonly onFlaskSentFeedback: (message: string) => void;
  readonly onFlaskAcceptedFeedback: (message: RequestUseFlaskSlotAcceptedServerMessage) => void;
  readonly onFlaskRejectedFeedback: (message: RequestUseFlaskSlotRejectedServerMessage) => void;
}

export interface WorldSessionFlaskBeltInput {
  readonly destroy: () => void;
}

export function attachWorldSessionFlaskBeltInput(
  scene: Phaser.Scene,
  room: Room<DoomscrollsRoomState>,
  callbacks: WorldSessionFlaskBeltInputCallbacks,
): WorldSessionFlaskBeltInput {
  const sendFlask = (slot: FlaskBeltSlotNumber): void => {
    if (shouldIgnoreWorldSessionCombatHotkey()) {
      return;
    }

    const result = sendFlaskSlotIntent(room, slot);
    if (result.dispatched) {
      callbacks.onFlaskSentFeedback(t("world_area.flask_sent", { slot }));
    }
  };

  const keyboard = scene.input.keyboard;
  const phaserKeys: Phaser.Input.Keyboard.Key[] = [];
  const phaserKeyHandlers: (() => void)[] = [];

  if (keyboard !== null) {
    for (const entry of SLOT_KEY_CODES) {
      const key = keyboard.addKey(entry.phaserKey);
      const handler = (): void => sendFlask(entry.slot);
      key.on("down", handler);
      phaserKeys.push(key);
      phaserKeyHandlers.push(handler);
    }
  }

  const handleWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }
    const entry = SLOT_KEY_CODES.find((candidate) => event.code === `Digit${candidate.digit}` || event.key === candidate.digit);
    if (entry === undefined) {
      return;
    }
    sendFlask(entry.slot);
  };

  window.addEventListener("keydown", handleWindowKeyDown);

  registerFlaskSlotResponseListeners(room, {
    onAccepted: (message) => {
      callbacks.onFlaskAcceptedFeedback(message);
    },
    onRejected: (message) => {
      callbacks.onFlaskRejectedFeedback(message);
    },
  });

  return {
    destroy: () => {
      phaserKeys.forEach((key, index) => key.off("down", phaserKeyHandlers[index]));
      window.removeEventListener("keydown", handleWindowKeyDown);
    },
  };
}
