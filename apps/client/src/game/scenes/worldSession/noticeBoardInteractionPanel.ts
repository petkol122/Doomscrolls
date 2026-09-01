/**
 * Task 348 — Notice Board Objective Catalog Panel
 *
 * Displays available objectives from the notice board when the
 * player has no active objective. Each objective shows title,
 * description, and a select button to start it.
 *
 * UI styling is placeholder-level and consistent with the current
 * world-session overlay style.
 */

import { t } from "@doomscrolls/localization";
import { createButton } from "../accountShell/accountShellDom";
import { makeInteractive, makePassive } from "./worldSessionPointerEvents";

export interface NoticeBoardObjectiveChoice {
  readonly objectiveId: string;
  readonly titleKey: string;
  readonly descriptionKey: string;
}

export interface NoticeBoardInteractionPanel {
  show: (
    message: string,
    objectives: readonly NoticeBoardObjectiveChoice[],
  ) => void;
  hide: () => void;
  destroy: () => void;
}

function createCardSection(): HTMLElement {
  const section = document.createElement("section");
  section.style.border = "1px solid #31271c";
  section.style.borderRadius = "8px";
  section.style.background = "rgba(12, 10, 8, 0.88)";
  section.style.padding = "0";
  section.style.margin = "0";
  return section;
}

/**
 * Create a floating notice board interaction panel.
 *
 * The panel overlays the bottom-left of the world session view
 * and shows available objectives with a "Start" button for each.
 */
export function createNoticeBoardInteractionPanel(
  onSelectObjective: (objectiveId: string) => void,
): NoticeBoardInteractionPanel {
  const root = document.createElement("div");
  makePassive(root);
  root.style.position = "fixed";
  root.style.bottom = "80px";
  root.style.left = "16px";
  root.style.zIndex = "2000";
  root.style.display = "none";
  root.style.flexDirection = "column";
  root.style.gap = "6px";
  root.style.maxWidth = "320px";
  root.style.width = "min(320px, calc(100vw - 32px))";

  const card = createCardSection();
  makeInteractive(card);

  const titleBar = document.createElement("div");
  titleBar.style.display = "flex";
  titleBar.style.alignItems = "center";
  titleBar.style.justifyContent = "space-between";
  titleBar.style.padding = "8px 10px 4px";

  const title = document.createElement("div");
  title.textContent = t("objective.panel.title" as never);
  title.style.fontSize = "13px";
  title.style.fontWeight = "bold";
  title.style.color = "#d8c6a3";
  titleBar.appendChild(title);

  const closeBtn = document.createElement("span");
  closeBtn.textContent = "✕";
  closeBtn.style.color = "#a88d63";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontSize = "14px";
  closeBtn.style.fontWeight = "bold";
  closeBtn.style.padding = "0 4px";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    root.style.display = "none";
  });
  makeInteractive(closeBtn);
  titleBar.appendChild(closeBtn);
  card.appendChild(titleBar);

  const messageLine = document.createElement("div");
  messageLine.style.padding = "0 10px 6px";
  messageLine.style.fontSize = "11px";
  messageLine.style.color = "#a88d63";
  messageLine.style.fontStyle = "italic";
  card.appendChild(messageLine);

  const objectiveList = document.createElement("div");
  objectiveList.style.display = "grid";
  objectiveList.style.gap = "8px";
  objectiveList.style.padding = "0 10px 10px";
  card.appendChild(objectiveList);

  root.appendChild(card);
  document.body.appendChild(root);

  return {
    show: (
      message: string,
      objectives: readonly NoticeBoardObjectiveChoice[],
    ): void => {
      messageLine.textContent = message;
      objectiveList.replaceChildren();

      if (objectives.length === 0) {
        const emptyLine = document.createElement("div");
        emptyLine.textContent = t("objective.no_more_notices" as never);
        emptyLine.style.fontSize = "11px";
        emptyLine.style.color = "#7a5f4a";
        objectiveList.appendChild(emptyLine);
      }

      for (const obj of objectives) {
        const row = document.createElement("div");
        row.style.display = "grid";
        row.style.gap = "4px";
        row.style.padding = "8px 10px";
        row.style.border = "1px solid #3c3122";
        row.style.borderRadius = "8px";
        row.style.background = "rgba(20, 15, 10, 0.88)";

        const titleLabel = document.createElement("div");
        titleLabel.textContent = t(obj.titleKey as never);
        titleLabel.style.fontSize = "12px";
        titleLabel.style.fontWeight = "bold";
        titleLabel.style.color = "#f0ddbb";
        row.appendChild(titleLabel);

        const descLabel = document.createElement("div");
        descLabel.textContent = t(obj.descriptionKey as never);
        descLabel.style.fontSize = "10px";
        descLabel.style.color = "#a88d63";
        descLabel.style.fontStyle = "italic";
        row.appendChild(descLabel);

        const selectBtn = createButton("Start");
        selectBtn.style.width = "auto";
        selectBtn.style.justifySelf = "start";
        selectBtn.style.padding = "4px 12px";
        selectBtn.style.fontSize = "11px";
        selectBtn.style.marginTop = "4px";
        selectBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectObjective(obj.objectiveId);
        });
        makeInteractive(selectBtn);
        row.appendChild(selectBtn);

        objectiveList.appendChild(row);
      }

      root.style.display = "flex";
    },
    hide: (): void => {
      root.style.display = "none";
    },
    destroy: (): void => {
      root.remove();
    },
  };
}