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
// Core 0.7 -- World Session Tertiary Skill Input (Bone Splinter).
//
// Mirrors the dodge/flask input modules (worldSessionDodgeInput.ts,
// worldSessionHealingFlaskInput.ts): a small, self-contained module that
// owns one keyboard hotkey and forwards a server-authoritative intent.
// Unlike the secondary skill slot (right-click on an enemy, with a
// persistent HUD cooldown card), the tertiary slot targets whatever
// enemy is already hovered/selected for the secondary slot's targeting
// hint and relies on transient feedback notices only -- the same
// footprint as dodge/flask, appropriate for a small second skill
// rather than a second full HUD subsystem.
//
// `request_use_skill_slot_accepted`/`_rejected` are a single Colyseus
// message type shared by both skill slots. Only one `room.onMessage`
// registration exists for each (owned by WorldSessionScene, for the
// secondary slot); this module does NOT register its own, since a
// second registration for the same message type would silently
// replace or conflict with the first. Instead, WorldSessionScene's
// existing listener routes slot === "tertiary" responses into
// `handleAccepted`/`handleRejected` below.
// ---------------------------------------------------------------------------

export interface WorldSessionSkillTertiaryTargetProvider {
  readonly getTargetEnemyId: () => string | null;
}

export interface WorldSessionSkillTertiaryInputCallbacks {
  readonly onSentFeedback: (message: string) => void;
  readonly onAcceptedFeedback: (message: RequestUseSkillSlotAcceptedServerMessage) => void;
  readonly onRejectedFeedback: (message: RequestUseSkillSlotRejectedServerMessage) => void;
}

export interface WorldSessionSkillTertiaryInput {
  readonly handleAccepted: (message: RequestUseSkillSlotAcceptedServerMessage) => void;
  readonly handleRejected: (message: RequestUseSkillSlotRejectedServerMessage) => void;
  readonly destroy: () => void;
}

export function attachWorldSessionSkillTertiaryInput(
  scene: Phaser.Scene,
  room: Room<DoomscrollsRoomState>,
  provider: WorldSessionSkillTertiaryTargetProvider,
  callbacks: WorldSessionSkillTertiaryInputCallbacks,
): WorldSessionSkillTertiaryInput {
  const sendSkill = (): void => {
    if (shouldIgnoreWorldSessionCombatHotkey()) {
      return;
    }

    const targetEnemyId = provider.getTargetEnemyId();
    if (targetEnemyId === null) {
      callbacks.onRejectedFeedback({
        type: "request_use_skill_slot_rejected",
        slot: "tertiary",
        reason: "enemy_not_found",
      });
      return;
    }

    const result = sendSkillSlotIntent(room, "tertiary", targetEnemyId);
    if (result.dispatched) {
      callbacks.onSentFeedback(t("world_area.skill_tertiary_sent"));
    }
  };

  const keyboard = scene.input.keyboard;
  let eKey: Phaser.Input.Keyboard.Key | null = null;
  let handleWindowKeyDown: ((event: KeyboardEvent) => void) | null = null;

  if (keyboard !== null) {
    eKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    eKey.on("down", sendSkill);
  }

  handleWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }
    const isEKey = event.code === "KeyE" || event.key === "e" || event.key === "E";
    if (!isEKey) {
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
      if (eKey !== null) {
        eKey.off("down", sendSkill);
      }
      if (handleWindowKeyDown !== null) {
        window.removeEventListener("keydown", handleWindowKeyDown);
      }
    },
  };
}
