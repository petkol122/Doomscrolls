/**
 * Core 0.1 Foundation — Skill Point Allocation.
 *
 * A lightweight floating modal listing the player's class skills
 * (primary/secondary/tertiary slots), their current rank and mana
 * cost, and an "Allocate" button per skill that spends one
 * unallocated skill point. The server is the sole authority for
 * whether a point is available and how a rank increases damage; this
 * view only reflects synced presence state and forwards the player's
 * intent via `onAllocate`. Toggled by the 'K' hotkey (see
 * WorldSessionScene.ts) and the Micro Menu's Skills button, both of
 * which call the same `toggle()`.
 *
 * Core 0.1 UI Overhaul Phase 2 -- built on the shared `createWindowChrome`
 * (draggableWindow.ts) instead of a bespoke fixed div, so it gets an
 * opaque, bordered frame, a real title bar drag handle, a working close
 * button, and click-to-front z-ordering like every other window -- this
 * is what fixes the old version's clash with the Inventory panel
 * (both were pinned to the same top-right corner).
 */
import { contentRegistry } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";
import type { CharacterClassKey } from "@doomscrolls/shared";
import { createWindowChrome } from "./draggableWindow";

export type SkillTreeSlotId = "primary" | "secondary" | "tertiary";

export interface WorldSessionSkillTreeState {
  readonly classKey: CharacterClassKey | undefined;
  readonly skillPoints: number;
  readonly primarySkillRank: number;
  readonly secondarySkillRank: number;
  readonly tertiarySkillRank: number;
}

export interface WorldSessionSkillTreeView {
  readonly root: HTMLElement;
  readonly isOpen: () => boolean;
  readonly toggle: () => void;
  readonly hide: () => void;
  readonly update: (state: WorldSessionSkillTreeState) => void;
  readonly destroy: () => void;
}

const SLOTS: readonly SkillTreeSlotId[] = ["primary", "secondary", "tertiary"];

export function createWorldSessionSkillTreeView(
  onAllocate: (slot: SkillTreeSlotId) => void,
): WorldSessionSkillTreeView {
  const chrome = createWindowChrome({
    title: t("skill_panel.title" as never),
    onClose: () => hide(),
    left: "auto",
    top: "96px",
    width: "300px",
  });
  const root = chrome.root;
  root.style.right = "24px";
  chrome.setVisible(false);
  root.style.fontFamily = "monospace";

  const pointsLine = document.createElement("div");
  pointsLine.style.color = "#c46a3a";
  pointsLine.style.fontSize = "12px";
  pointsLine.style.fontWeight = "bold";
  pointsLine.style.marginBottom = "8px";
  chrome.body.appendChild(pointsLine);

  const body = document.createElement("div");
  body.style.display = "grid";
  body.style.gap = "8px";
  chrome.body.appendChild(body);

  document.body.appendChild(root);

  let latestState: WorldSessionSkillTreeState | null = null;

  function hide(): void {
    chrome.setVisible(false);
  }

  function isOpen(): boolean {
    return !root.hidden;
  }

  function toggle(): void {
    chrome.setVisible(root.hidden);
    if (!root.hidden && latestState !== null) {
      render(latestState);
    }
  }

  function resolveSlotSkillId(classKey: CharacterClassKey, slot: SkillTreeSlotId): string | undefined {
    const classDefinition = contentRegistry.classes.get(classKey);
    if (classDefinition === undefined) {
      return undefined;
    }
    return slot === "primary"
      ? classDefinition.startingSkillId
      : slot === "secondary"
        ? classDefinition.secondarySkillId
        : classDefinition.tertiarySkillId;
  }

  function resolveSlotRank(state: WorldSessionSkillTreeState, slot: SkillTreeSlotId): number {
    return slot === "primary"
      ? state.primarySkillRank
      : slot === "secondary"
        ? state.secondarySkillRank
        : state.tertiarySkillRank;
  }

  function render(state: WorldSessionSkillTreeState): void {
    pointsLine.textContent = `${t("skill_panel.points_available" as never)}: ${String(state.skillPoints)}`;
    body.innerHTML = "";

    if (state.classKey === undefined) {
      const empty = document.createElement("div");
      empty.textContent = t("skill_panel.no_class" as never);
      empty.style.cssText = "color: #a88d63; font-size: 11px;";
      body.appendChild(empty);
      return;
    }

    for (const slot of SLOTS) {
      const skillId = resolveSlotSkillId(state.classKey, slot);
      if (skillId === undefined) {
        continue;
      }
      const skillDefinition = contentRegistry.skills.get(skillId as never);
      if (skillDefinition === undefined) {
        continue;
      }
      const rank = resolveSlotRank(state, slot);
      const isMaxed = rank >= skillDefinition.maxRank;
      const canAllocate = state.skillPoints > 0 && !isMaxed;

      const row = document.createElement("div");
      row.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid #3c3122; padding-top: 6px;";

      const info = document.createElement("div");
      info.style.cssText = "display: grid; gap: 2px;";
      const nameLine = document.createElement("div");
      nameLine.textContent = `${t(skillDefinition.nameKey as never)} (${t(`skill_panel.slot_${slot}` as never)})`;
      nameLine.style.cssText = "color: #d8c6a3; font-size: 12px; font-weight: bold;";
      info.appendChild(nameLine);
      const detailLine = document.createElement("div");
      detailLine.textContent = `${t("skill_panel.rank" as never)} ${String(rank)}/${String(skillDefinition.maxRank)} • ${t("skill_panel.mana_cost" as never)}: ${String(skillDefinition.manaCost)}`;
      detailLine.style.cssText = "color: #8a7a5c; font-size: 10px;";
      info.appendChild(detailLine);
      row.appendChild(info);

      const allocateButton = document.createElement("button");
      allocateButton.textContent = isMaxed ? t("skill_panel.maxed" as never) : t("skill_panel.allocate" as never);
      allocateButton.disabled = !canAllocate;
      allocateButton.style.cssText = `
        background: ${canAllocate ? "#6e2f1f" : "#2a2218"};
        color: ${canAllocate ? "#f3e2c4" : "#6f6352"};
        border: 1px solid #3c3122; border-radius: 6px;
        padding: 4px 10px; font-size: 11px; font-family: monospace;
        cursor: ${canAllocate ? "pointer" : "not-allowed"};
      `;
      if (canAllocate) {
        allocateButton.addEventListener("click", () => onAllocate(slot));
      }
      row.appendChild(allocateButton);

      body.appendChild(row);
    }
  }

  function update(state: WorldSessionSkillTreeState): void {
    latestState = state;
    if (isOpen()) {
      render(state);
    }
  }

  function destroy(): void {
    root.remove();
  }

  return { root, isOpen, toggle, hide, update, destroy };
}
