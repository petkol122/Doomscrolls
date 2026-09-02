import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import type {
  RequestUseSkillSlotAcceptedServerMessage,
  RequestUseSkillSlotRejectedServerMessage,
  RoomState as DoomscrollsRoomState,
} from "@doomscrolls/shared";

import { t } from "@doomscrolls/localization";

import { sendSkillSlotIntent } from "../../../net/skillSlotIntentClient";
import { shouldIgnoreWorldSessionCombatHotkey } from "./worldSessionCombatHotkeyFocus";

// ---------------------------------------------------------------------------
// Core 0.14 -- World Session Primary Skill Input (Heavy Strike).
//
// Mirrors worldSessionSkillTertiaryInput.ts exactly: a small,
// self-contained module owning one keyboard hotkey (`1`) and forwarding
// a server-authoritative intent. Like the tertiary slot, this targets
// whatever enemy is already hovered/selected and relies on transient
// feedback notices only -- no persistent HUD cooldown card, the same
// reduced footprint tertiary uses.
//
// `request_use_skill_slot_accepted`/`_rejected` are a single Colyseus
// message type shared by all three skill slots. Only one
// `room.onMessage` registration exists (owned by WorldSessionScene, for
// the secondary slot); this module does NOT register its own, since a
// second registration for the same message type would silently
// replace or conflict with the first. Instead, WorldSessionScene's
// existing listener routes slot === "primary" responses into
// `handleAccepted`/`handleRejected` below.
// ---------------------------------------------------------------------------

export interface WorldSessionSkillPrimaryTargetProvider {
  readonly getTargetEnemyId: () => string | null;
}

export interface WorldSessionSkillPrimaryInputCallbacks {
  readonly onSentFeedback: (message: string) => void;
  readonly onAcceptedFeedback: (message: RequestUseSkillSlotAcceptedServerMessage) => void;
  readonly onRejectedFeedback: (message: RequestUseSkillSlotRejectedServerMessage) => void;
}

export interface WorldSessionSkillPrimaryInput {
  readonly handleAccepted: (message: RequestUseSkillSlotAcceptedServerMessage) => void;
  readonly handleRejected: (message: RequestUseSkillSlotRejectedServerMessage) => void;
  readonly destroy: () => void;
}

export function attachWorldSessionSkillPrimaryInput(
  scene: Phaser.Scene,
  room: Room<DoomscrollsRoomState>,
  provider: WorldSessionSkillPrimaryTargetProvider,
  callbacks: WorldSessionSkillPrimaryInputCallbacks,
): WorldSessionSkillPrimaryInput {
  const sendSkill = (): void => {
    if (shouldIgnoreWorldSessionCombatHotkey()) {
      return;
    }

    const targetEnemyId = provider.getTargetEnemyId();
    if (targetEnemyId === null) {
      callbacks.onRejectedFeedback({
        type: "request_use_skill_slot_rejected",
        slot: "primary",
        reason: "enemy_not_found",
      });
      return;
    }

    const result = sendSkillSlotIntent(room, "primary", targetEnemyId);
    if (result.dispatched) {
      callbacks.onSentFeedback(t("world_area.skill_primary_sent"));
    }
  };

  const keyboard = scene.input.keyboard;
  let oneKey: Phaser.Input.Keyboard.Key | null = null;
  let handleWindowKeyDown: ((event: KeyboardEvent) => void) | null = null;

  if (keyboard !== null) {
    oneKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    oneKey.on("down", sendSkill);
  }

  handleWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }
    const isOneKey = event.code === "Digit1" || event.key === "1";
    if (!isOneKey) {
      return;
    }
    sendSkill();
  };

  window.addEventListener("keydown", handleWindowKeyDown);

  return {
    handleAccepted: (message) => {
      callbacks.onAcceptedFeedback(message);
    },
    handleRejected: (message) => {
      callbacks.onRejectedFeedback(message);
    },
    destroy: () => {
      if (oneKey !== null) {
        oneKey.off("down", sendSkill);
      }
      if (handleWindowKeyDown !== null) {
        window.removeEventListener("keydown", handleWindowKeyDown);
      }
    },
  };
}
