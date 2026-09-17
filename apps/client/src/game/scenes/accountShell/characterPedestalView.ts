import { t, type LocalizationKey } from "@doomscrolls/localization";
import type { CharacterSummary } from "@doomscrolls/shared";
import { formatMoneyCompact } from "@doomscrolls/shared";
import { resolvePlayerTint } from "../worldSession/classTint";
import { createButton } from "./accountShellDom";
import { hexColorToCss, theme } from "./theme";

export interface CharacterPedestalHandlers {
  readonly onEnterWorld: () => void;
  readonly onDeleteCharacter: (character: CharacterSummary) => void;
  readonly onCreateCharacter: () => void;
}

export function createCharacterPedestal(
  selectedCharacter: CharacterSummary | null,
  handlers: CharacterPedestalHandlers
): HTMLElement {
  const section = document.createElement("section");
  section.style.display = "flex";
  section.style.flexDirection = "column";
  section.style.alignItems = "stretch";
  section.style.gap = "16px";

  const pedestal = document.createElement("div");
  pedestal.style.flex = "1";
  pedestal.style.minHeight = "220px";
  pedestal.style.borderRadius = theme.radius.panel;
  pedestal.style.border = `1px solid ${theme.color.borderSubtle}`;
  pedestal.style.display = "flex";
  pedestal.style.flexDirection = "column";
  pedestal.style.alignItems = "center";
  pedestal.style.justifyContent = "center";
  pedestal.style.textAlign = "center";
  pedestal.style.padding = "24px";

  if (selectedCharacter === null) {
    pedestal.style.background = theme.color.cardBg;
    const empty = document.createElement("p");
    empty.textContent = t("world_entry.no_character_selected");
    empty.style.margin = "0";
    empty.style.color = theme.color.textMuted;
    pedestal.appendChild(empty);
  } else {
    const tint = resolvePlayerTint(selectedCharacter.classKey);
    const glowColor = hexColorToCss(tint.ringStrokeColor);
    const baseColor = hexColorToCss(tint.torsoColor);
    pedestal.style.background = `radial-gradient(ellipse at 50% 35%, ${glowColor}33 0%, ${baseColor}22 45%, rgba(13,10,8,0.94) 78%)`;

    const badge = document.createElement("div");
    badge.style.width = "96px";
    badge.style.height = "96px";
    badge.style.borderRadius = "50%";
    badge.style.marginBottom = "14px";
    badge.style.background = baseColor;
    badge.style.border = `3px solid ${glowColor}`;
    badge.style.boxShadow = `0 0 32px ${glowColor}77`;
    pedestal.appendChild(badge);

    const name = document.createElement("h2");
    name.textContent = selectedCharacter.characterName;
    name.style.margin = "0 0 4px";
    name.style.fontFamily = theme.font.heading;
    name.style.fontSize = "26px";
    name.style.color = theme.color.textHeading;
    pedestal.appendChild(name);

    const subtitle = document.createElement("p");
    subtitle.textContent = [
      t(`class.${selectedCharacter.classKey}.name` as LocalizationKey),
      `${t("character.level")} ${selectedCharacter.level}`,
      t(`zone.${selectedCharacter.currentZoneId}.name` as LocalizationKey)
    ].join(" · ");
    subtitle.style.margin = "0 0 10px";
    subtitle.style.color = theme.color.textSecondary;
    pedestal.appendChild(subtitle);

    const money = document.createElement("p");
    money.textContent = `${t("money.money_label")}: ${formatMoneyCompact(selectedCharacter.moneyCopper)}`;
    money.style.margin = "0";
    money.style.fontFamily = "monospace";
    money.style.fontSize = "13px";
    money.style.color = theme.color.textStat;
    pedestal.appendChild(money);
  }

  section.appendChild(pedestal);
  section.appendChild(createActionBar(selectedCharacter, handlers));

  const status = document.createElement("p");
  status.id = "doomscrolls-world-entry-status";
  status.style.margin = "0";
  status.style.minHeight = "16px";
  status.style.fontSize = "12px";
  status.style.color = theme.color.textSecondary;
  section.appendChild(status);

  return section;
}

function createActionBar(
  selectedCharacter: CharacterSummary | null,
  handlers: CharacterPedestalHandlers
): HTMLElement {
  const actionBar = document.createElement("div");
  actionBar.style.display = "flex";
  actionBar.style.gap = "10px";

  const enterWorldButton = createButton(t("world_entry.enter_world"));
  enterWorldButton.style.flex = "1";
  enterWorldButton.style.marginTop = "0";
  enterWorldButton.disabled = selectedCharacter === null;
  enterWorldButton.style.opacity = selectedCharacter === null ? "0.62" : "1";
  enterWorldButton.style.cursor = selectedCharacter === null ? "not-allowed" : "pointer";
  enterWorldButton.setAttribute("aria-describedby", "doomscrolls-world-entry-status");
  if (selectedCharacter !== null) {
    enterWorldButton.addEventListener("click", () => {
      handlers.onEnterWorld();
    });
  }
  actionBar.appendChild(enterWorldButton);

  const deleteButton = createButton(t("character.delete"), "danger");
  deleteButton.style.marginTop = "0";
  deleteButton.disabled = selectedCharacter === null;
  deleteButton.style.opacity = selectedCharacter === null ? "0.5" : "1";
  if (selectedCharacter !== null) {
    deleteButton.addEventListener("click", () => {
      handlers.onDeleteCharacter(selectedCharacter);
    });
  }
  actionBar.appendChild(deleteButton);

  const createButtonElement = createButton(t("character.create"), "ghost");
  createButtonElement.style.marginTop = "0";
  createButtonElement.addEventListener("click", () => {
    handlers.onCreateCharacter();
  });
  actionBar.appendChild(createButtonElement);

  return actionBar;
}
