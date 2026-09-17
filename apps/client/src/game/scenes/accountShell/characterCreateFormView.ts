import { contentRegistry } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";
import type { CharacterClassKey, CharacterSummary, OriginKey } from "@doomscrolls/shared";
import { createButton as makeButton, createInput, setInputError } from "./accountShellDom";
import { theme } from "./theme";

const CORE_0_1_ORIGIN_ID = "sewer_dweller" satisfies OriginKey;

// Core 0.9 -- both classes available under sewer_dweller today; a second
// origin is out of scope for this build (see docs/CORE_BUILD_0_9_PLAN.md).
const CLASS_DEFINITIONS = contentRegistry.classes.all;

const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 16;
const NAME_PATTERN = /^[A-Za-z0-9]+$/;

// Client-only cosmetic hints (icon glyph + role tag) -- same pattern as
// classTint.ts's CLASS_TINTS: presentation data, not game content.
const CLASS_PRESENTATION: Readonly<Record<CharacterClassKey, { readonly icon: string; readonly role: string }>> = {
  gravewalker: { icon: "💀", role: "DPS" },
  ironclad: { icon: "🛡️", role: "Tank" },
  netrunner: { icon: "🖥️", role: "DoT" },
  street_alchemist: { icon: "⚗️", role: "Support" }
};

export interface CharacterCreateFormElements {
  readonly status: HTMLParagraphElement;
  readonly characterName: HTMLInputElement;
  readonly origin: HTMLSelectElement;
  readonly characterClass: HTMLSelectElement;
  readonly createButton: HTMLButtonElement;
}

export function createCharacterCreateForm(
  existingCharacters: readonly CharacterSummary[],
  onSubmit: (elements: CharacterCreateFormElements) => void,
  onCancel: () => void
): HTMLElement {
  const section = document.createElement("section");
  section.style.display = "flex";
  section.style.flexDirection = "column";
  section.style.gap = "4px";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";

  const title = document.createElement("h2");
  title.textContent = t("character.create");
  title.style.margin = "0 0 12px";
  title.style.fontFamily = theme.font.heading;
  title.style.fontSize = "24px";
  title.style.color = theme.color.textHeading;
  header.appendChild(title);

  const cancelButton = makeButton(t("character.delete_cancel"), "ghost");
  cancelButton.style.marginTop = "0";
  cancelButton.addEventListener("click", onCancel);
  header.appendChild(cancelButton);

  section.appendChild(header);

  const characterName = createInput(t("character.name"), "doomscrolls-character-name");
  characterName.wrapper.style.maxWidth = "320px";
  section.appendChild(characterName.wrapper);

  const origin: { readonly select: HTMLSelectElement } = { select: document.createElement("select") };
  origin.select.id = "doomscrolls-character-origin";
  origin.select.style.display = "none";
  const originOption = document.createElement("option");
  originOption.value = CORE_0_1_ORIGIN_ID;
  originOption.textContent = t("origin.sewer_dweller.name");
  origin.select.appendChild(originOption);
  section.appendChild(origin.select);

  const classLabel = document.createElement("p");
  classLabel.textContent = t("character.class");
  classLabel.style.margin = "12px 0 8px";
  classLabel.style.fontSize = "14px";
  classLabel.style.color = theme.color.textBody;
  section.appendChild(classLabel);

  const characterClass = document.createElement("select");
  characterClass.id = "doomscrolls-character-class";
  characterClass.style.display = "none";
  for (const classDefinition of CLASS_DEFINITIONS) {
    const option = document.createElement("option");
    option.value = classDefinition.id;
    characterClass.appendChild(option);
  }
  characterClass.value = CLASS_DEFINITIONS[0]?.id ?? "";
  section.appendChild(characterClass);

  const classCards = document.createElement("div");
  classCards.style.display = "grid";
  classCards.style.gridTemplateColumns = "repeat(auto-fit, minmax(220px, 1fr))";
  classCards.style.gap = "10px";
  classCards.style.marginBottom = "12px";

  const cardsByClassId = new Map<string, HTMLElement>();

  const applySelectedCardStyles = (selectedClassId: string): void => {
    for (const [classId, card] of cardsByClassId) {
      const isSelected = classId === selectedClassId;
      card.style.border = `1px solid ${isSelected ? theme.color.borderSelected : theme.color.borderSubtle}`;
      card.style.background = isSelected ? theme.color.cardBgSelected : theme.color.cardBg;
    }
  };

  for (const classDefinition of CLASS_DEFINITIONS) {
    const presentation = CLASS_PRESENTATION[classDefinition.id];
    const card = document.createElement("button");
    card.type = "button";
    card.style.textAlign = "left";
    card.style.padding = "12px";
    card.style.borderRadius = theme.radius.control;
    card.style.cursor = "pointer";
    card.style.font = "inherit";
    card.style.color = theme.color.textBody;

    const heading = document.createElement("div");
    heading.style.display = "flex";
    heading.style.alignItems = "center";
    heading.style.gap = "8px";
    heading.style.marginBottom = "6px";

    const icon = document.createElement("span");
    icon.textContent = presentation.icon;
    icon.style.fontSize = "22px";
    heading.appendChild(icon);

    const name = document.createElement("strong");
    name.textContent = t(classDefinition.nameKey);
    name.style.color = theme.color.textHeading;
    heading.appendChild(name);

    const role = document.createElement("span");
    role.textContent = presentation.role;
    role.style.marginLeft = "auto";
    role.style.padding = "2px 8px";
    role.style.borderRadius = "999px";
    role.style.border = `1px solid ${theme.color.borderSubtle}`;
    role.style.fontSize = "11px";
    role.style.color = theme.color.textStat;
    heading.appendChild(role);

    card.appendChild(heading);

    const description = document.createElement("p");
    description.textContent = t(classDefinition.descriptionKey);
    description.style.margin = "0 0 8px";
    description.style.fontSize = "12px";
    description.style.color = theme.color.textSecondary;
    card.appendChild(description);

    const stats = document.createElement("p");
    stats.textContent = [
      `${t("stat.power")} ${classDefinition.baseStats.power}`,
      `${t("stat.speed")} ${classDefinition.baseStats.speed}`,
      `${t("stat.mind")} ${classDefinition.baseStats.mind}`,
      `${t("stat.toughness")} ${classDefinition.baseStats.toughness}`
    ].join(" · ");
    stats.style.margin = "0";
    stats.style.fontFamily = "monospace";
    stats.style.fontSize = "12px";
    stats.style.color = theme.color.textStat;
    card.appendChild(stats);

    card.addEventListener("click", () => {
      characterClass.value = classDefinition.id;
      applySelectedCardStyles(classDefinition.id);
    });

    cardsByClassId.set(classDefinition.id, card);
    classCards.appendChild(card);
  }

  applySelectedCardStyles(characterClass.value);
  section.appendChild(classCards);

  const takenNames = new Set(existingCharacters.map((character) => character.characterName.toLowerCase()));

  const validateNameLive = (): boolean => {
    const value = characterName.input.value.trim();
    if (value === "") {
      setInputError(characterName.input, characterName.errorLine, "");
      return false;
    }
    if (value.length < NAME_MIN_LENGTH || value.length > NAME_MAX_LENGTH) {
      setInputError(
        characterName.input,
        characterName.errorLine,
        t("error.invalid_character_create_input")
      );
      return false;
    }
    if (!NAME_PATTERN.test(value)) {
      setInputError(
        characterName.input,
        characterName.errorLine,
        t("error.invalid_character_create_input")
      );
      return false;
    }
    if (takenNames.has(value.toLowerCase())) {
      setInputError(characterName.input, characterName.errorLine, t("error.duplicate_character_name"));
      return false;
    }
    setInputError(characterName.input, characterName.errorLine, "");
    return true;
  };

  characterName.input.addEventListener("input", validateNameLive);

  const createButton = makeButton(t("character.create"));
  createButton.style.maxWidth = "220px";
  section.appendChild(createButton);

  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.style.minHeight = "22px";
  status.style.margin = "8px 0 0";
  status.style.color = theme.color.textBody;
  section.appendChild(status);

  const elements: CharacterCreateFormElements = {
    status,
    characterName: characterName.input,
    origin: origin.select,
    characterClass,
    createButton
  };

  createButton.addEventListener("click", () => {
    if (!validateNameLive()) {
      return;
    }
    onSubmit(elements);
  });

  return section;
}

export function setCreateStatus(
  elements: CharacterCreateFormElements,
  message: string,
  tone: "error" | "info"
): void {
  elements.status.textContent = message;
  elements.status.style.color = tone === "error" ? theme.color.textError : theme.color.textBody;
}
