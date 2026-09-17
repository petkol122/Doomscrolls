import { t, type LocalizationKey } from "@doomscrolls/localization";
import type { CharacterId, CharacterSummary } from "@doomscrolls/shared";
import { theme } from "./theme";

export function createCharacterRoster(
  characters: readonly CharacterSummary[],
  selectedCharacterId: CharacterId | null,
  onSelectCharacter: (id: CharacterId) => void
): HTMLElement {
  const section = document.createElement("section");
  section.style.display = "flex";
  section.style.flexDirection = "column";
  section.style.minHeight = "0";

  const title = document.createElement("h2");
  title.textContent = t("character.list");
  title.style.margin = "0 0 10px";
  title.style.fontFamily = theme.font.heading;
  title.style.fontSize = "20px";
  title.style.color = theme.color.textHeading;
  section.appendChild(title);

  if (characters.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = t("auth.no_characters");
    empty.style.margin = "0";
    empty.style.color = theme.color.textMuted;
    section.appendChild(empty);
    return section;
  }

  const list = document.createElement("ul");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "8px";
  list.style.margin = "0";
  list.style.padding = "0";
  list.style.listStyle = "none";
  list.style.overflowY = "auto";
  list.style.paddingRight = "4px";

  for (const character of characters) {
    list.appendChild(createRosterRow(character, selectedCharacterId === character.id, onSelectCharacter));
  }

  section.appendChild(list);
  return section;
}

function createRosterRow(
  character: CharacterSummary,
  isSelected: boolean,
  onSelectCharacter: (id: CharacterId) => void
): HTMLElement {
  const row = document.createElement("li");

  const button = document.createElement("button");
  button.type = "button";
  button.style.width = "100%";
  button.style.textAlign = "left";
  button.style.padding = "10px 12px";
  button.style.border = `1px solid ${isSelected ? theme.color.borderSelected : theme.color.borderSubtle}`;
  button.style.borderRadius = theme.radius.control;
  button.style.background = isSelected ? theme.color.cardBgSelected : theme.color.cardBg;
  button.style.cursor = "pointer";
  button.style.font = "inherit";
  button.style.transition = "border-color 120ms ease, background 120ms ease";
  button.setAttribute("aria-pressed", String(isSelected));

  const name = document.createElement("strong");
  name.textContent = isSelected ? `${character.characterName} ✓` : character.characterName;
  name.style.display = "block";
  name.style.marginBottom = "4px";
  name.style.color = theme.color.textHeading;
  button.appendChild(name);

  const details = document.createElement("p");
  details.textContent = [
    t(`class.${character.classKey}.name` as LocalizationKey),
    `${t("character.level")} ${character.level}`,
    t(`zone.${character.currentZoneId}.name` as LocalizationKey)
  ].join(" · ");
  details.style.margin = "0";
  details.style.fontSize = "12px";
  details.style.color = theme.color.textSecondary;
  button.appendChild(details);

  button.addEventListener("click", () => {
    onSelectCharacter(character.id);
  });

  row.appendChild(button);
  return row;
}
