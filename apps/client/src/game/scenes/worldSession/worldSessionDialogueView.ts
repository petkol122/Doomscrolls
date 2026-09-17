/**
 * Core 0.1 — Persistent Quest & Dialogue System foundation.
 *
 * Simple NPC dialogue overlay shown when interacting with a
 * quest-giving interactable (or a notice board). Shows the quest
 * giver's dialogue line plus quest choices appropriate to the
 * character's current persisted status for that quest: "Accept Quest"
 * (not yet accepted), "Complete Quest" (accepted, ready to turn in), or
 * just "Close" (already completed). The view never decides quest
 * state itself -- it only reflects `questInfo` as sent by the server
 * and forwards the player's choice via the injected callbacks, which
 * the scene wires to `request_accept_quest` / `request_complete_quest`
 * room messages.
 */
import { t } from "@doomscrolls/localization";

export interface DialogueQuestInfo {
  readonly questId: string;
  readonly status: "available" | "accepted" | "completed";
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly xpReward: number;
  readonly copperReward: number;
}

export interface WorldSessionDialogueView {
  readonly show: (message: string, questInfo: DialogueQuestInfo) => void;
  readonly hide: () => void;
  readonly destroy: () => void;
}

export interface WorldSessionDialogueViewOptions {
  readonly onAcceptQuest: (questId: string) => void;
  readonly onCompleteQuest: (questId: string) => void;
}

export function createWorldSessionDialogueView(
  options: WorldSessionDialogueViewOptions,
): WorldSessionDialogueView {
  let panelElement: HTMLDivElement | null = null;

  const hide = (): void => {
    if (panelElement !== null) {
      panelElement.remove();
      panelElement = null;
    }
  };

  const show = (message: string, questInfo: DialogueQuestInfo): void => {
    hide();

    // Modal backdrop, matching townServiceInteractionPanel's convention:
    // capture-phase pointerdown/mousedown/contextmenu stoppers so a click
    // in the dialogue never leaks to the Phaser canvas as a movement
    // intent, while Close/choice buttons still rely on bubble-phase click.
    const backdrop = document.createElement("div");
    backdrop.style.cssText = `
      position: fixed; inset: 0; z-index: 20000;
      background: rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
    `;
    const stopWorldInput = (event: Event): void => {
      event.stopPropagation();
      if (event.cancelable) {
        event.preventDefault();
      }
    };
    backdrop.addEventListener("pointerdown", stopWorldInput, { capture: true });
    backdrop.addEventListener("mousedown", stopWorldInput, { capture: true });
    backdrop.addEventListener("contextmenu", stopWorldInput, { capture: true });

    const card = document.createElement("div");
    card.style.cssText = `
      background: #10181a; border: 1px solid #2f5a5a; border-radius: 10px;
      padding: 20px 24px; min-width: 320px; max-width: 420px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.7);
      display: grid; gap: 12px;
    `;

    const nameLine = document.createElement("div");
    nameLine.textContent = t(questInfo.titleKey as never);
    nameLine.style.cssText = "color: #c8e6e6; font-size: 16px; font-weight: bold;";
    card.appendChild(nameLine);

    const sep = document.createElement("div");
    sep.style.cssText = "height: 1px; background: #1f4a4a;";
    card.appendChild(sep);

    const dialogueLine = document.createElement("div");
    dialogueLine.textContent = message;
    dialogueLine.style.cssText = "color: #d8c6a3; font-size: 13px; font-style: italic;";
    card.appendChild(dialogueLine);

    if (questInfo.status !== "completed" && (questInfo.xpReward > 0 || questInfo.copperReward > 0)) {
      const rewardLine = document.createElement("div");
      const rewardParts: string[] = [];
      if (questInfo.xpReward > 0) rewardParts.push(`${questInfo.xpReward} XP`);
      if (questInfo.copperReward > 0) rewardParts.push(`${questInfo.copperReward}c`);
      rewardLine.textContent = `Reward: ${rewardParts.join(", ")}`;
      rewardLine.style.cssText = "color: #7fb5b5; font-size: 11px;";
      card.appendChild(rewardLine);
    }

    const buttonRow = document.createElement("div");
    buttonRow.style.cssText = "display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;";

    const makeButton = (label: string): HTMLButtonElement => {
      const button = document.createElement("button");
      button.textContent = label;
      button.style.cssText = `
        padding: 6px 14px; font-size: 12px;
        background: #1a2628; border: 1px solid #2f5a5a; border-radius: 6px;
        color: #c8e6e6; cursor: pointer;
      `;
      return button;
    };

    if (questInfo.status === "available") {
      const acceptBtn = makeButton("Accept Quest");
      acceptBtn.addEventListener("click", () => {
        options.onAcceptQuest(questInfo.questId);
      });
      buttonRow.appendChild(acceptBtn);
    } else if (questInfo.status === "accepted") {
      const completeBtn = makeButton("Complete Quest");
      completeBtn.addEventListener("click", () => {
        options.onCompleteQuest(questInfo.questId);
      });
      buttonRow.appendChild(completeBtn);
    }

    const closeBtn = makeButton("Close");
    closeBtn.addEventListener("click", () => {
      hide();
    });
    buttonRow.appendChild(closeBtn);
    card.appendChild(buttonRow);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    panelElement = backdrop;

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        hide();
      }
    });
  };

  const destroy = (): void => {
    hide();
  };

  return { show, hide, destroy };
}
