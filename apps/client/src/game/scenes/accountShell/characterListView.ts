import { t } from "@doomscrolls/localization";
import type { CharacterId, CharacterSummary } from "@doomscrolls/shared";
import { createButton } from "./accountShellDom";
// Money formatting lives in @doomscrolls/shared (server-owned / shared contract).
// The client must not reimplement gold/silver/copper breakdown ad hoc.
import { formatMoneyCompact } from "@doomscrolls/shared";

export function createCharacterList(
  characters: readonly CharacterSummary[],
  selectedCharacterId: CharacterId | null,
  onSelectCharacter: (id: CharacterId) => void
): HTMLElement {
  const section = document.createElement("section");
  section.style.margin = "18px 0 22px";

  const title = document.createElement("h2");
  title.textContent = t("character.list");
  title.style.margin = "0 0 12px";
  title.style.fontFamily = "Georgia, serif";
  title.style.fontSize = "24px";
  section.appendChild(title);

  if (characters.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = t("auth.no_characters");
    empty.style.margin = "0";
    empty.style.color = "#a88d63";
    section.appendChild(empty);
    return section;
  }

  const list = document.createElement("ul");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "10px";
  list.style.margin = "0";
  list.style.padding = "0";
  list.style.listStyle = "none";

  for (const character of characters) {
    list.appendChild(
      createCharacterListItem(character, selectedCharacterId, onSelectCharacter)
    );
  }

  section.appendChild(list);
  return section;
}

function createCharacterListItem(
  character: CharacterSummary,
  selectedCharacterId: CharacterId | null,
  onSelectCharacter: (id: CharacterId) => void
): HTMLElement {
  const isSelected = character.id === selectedCharacterId;
  const item = document.createElement("li");
  item.style.display = "flex";
  item.style.alignItems = "center";
  item.style.justifyContent = "space-between";
  item.style.gap = "14px";
  item.style.padding = "12px";
  item.style.border = isSelected ? "1px solid #b9d49a" : "1px solid #3d3324";
  item.style.borderRadius = "8px";
  item.style.background = isSelected ? "rgba(46, 60, 31, 0.72)" : "rgba(25, 19, 14, 0.9)";

  const content = document.createElement("div");
  content.style.minWidth = "0";
  content.style.flex = "1";

  const name = document.createElement("strong");
  name.textContent = isSelected ? `${character.characterName} ✓` : character.characterName;
  name.style.display = "block";
  name.style.marginBottom = "6px";
  name.style.color = "#ffe6bd";
  content.appendChild(name);

  const details = document.createElement("p");
  details.textContent = [
    `${t("character.origin")}: ${t(`origin.${character.originKey}.name`)}`,
    `${t("character.class")}: ${t(`class.${character.classKey}.name`)}`,
    `${t("character.level")}: ${character.level}`
  ].join(" · ");
  details.style.margin = "0";
  details.style.color = "#c7ad84";
  content.appendChild(details);

  const money = document.createElement("p");
  money.textContent = `${t("money.money_label")}: ${formatMoneyCompact(character.moneyCopper)}`;
  money.style.margin = "4px 0 0";
  money.style.color = "#e0c88a";
  money.style.fontFamily = "monospace";
  money.style.fontSize = "12px";
  content.appendChild(money);
  item.appendChild(content);

  const selectButton = createButton(t("character.select"));
  selectButton.style.marginTop = "0";
  selectButton.disabled = isSelected;
  selectButton.style.cursor = isSelected ? "default" : "pointer";
  selectButton.style.opacity = isSelected ? "0.72" : "1";
  selectButton.setAttribute("aria-pressed", String(isSelected));
  selectButton.addEventListener("click", () => {
    onSelectCharacter(character.id);
  });
  item.appendChild(selectButton);

  return item;
}
