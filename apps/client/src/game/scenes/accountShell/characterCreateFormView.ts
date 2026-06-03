import { t } from "@doomscrolls/localization";
import type { OriginKey, CharacterClassKey } from "@doomscrolls/shared";
import { createInput, createFixedOptionSelect, createButton as makeButton } from "./accountShellDom";

const CORE_0_1_ORIGIN_ID = "sewer_dweller" satisfies OriginKey;
const CORE_0_1_CLASS_ID = "gravewalker" satisfies CharacterClassKey;

export interface CharacterCreateFormElements {
  readonly status: HTMLParagraphElement;
  readonly characterName: HTMLInputElement;
  readonly origin: HTMLSelectElement;
  readonly characterClass: HTMLSelectElement;
  readonly createButton: HTMLButtonElement;
}

export function createCharacterCreateForm(
  onSubmit: (elements: CharacterCreateFormElements) => void
): HTMLElement {
  const section = document.createElement("section");
  section.style.margin = "18px 0 22px";
  section.style.padding = "16px";
  section.style.border = "1px solid #3d3324";
  section.style.borderRadius = "8px";
  section.style.background = "rgba(18, 14, 11, 0.9)";

  const title = document.createElement("h2");
  title.textContent = t("character.create");
  title.style.margin = "0 0 12px";
  title.style.fontFamily = "Georgia, serif";
  title.style.fontSize = "24px";
  section.appendChild(title);

  const characterName = createInput(t("character.name"), "doomscrolls-character-name");
  const origin = createFixedOptionSelect(
    t("character.origin"),
    "doomscrolls-character-origin",
    CORE_0_1_ORIGIN_ID,
    t("origin.sewer_dweller.name")
  );
  const characterClass = createFixedOptionSelect(
    t("character.class"),
    "doomscrolls-character-class",
    CORE_0_1_CLASS_ID,
    t("class.gravewalker.name")
  );
  const createButton = makeButton(t("character.create"));

  const fields = document.createElement("div");
  fields.style.display = "grid";
  fields.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  fields.style.gap = "12px";
  fields.append(characterName.wrapper, origin.wrapper, characterClass.wrapper);
  section.appendChild(fields);
  section.appendChild(createButton);

  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.style.minHeight = "22px";
  status.style.margin = "12px 0 0";
  status.style.color = "#d8c6a3";
  section.appendChild(status);

  const elements: CharacterCreateFormElements = {
    status,
    characterName: characterName.input,
    origin: origin.select,
    characterClass: characterClass.select,
    createButton
  };

  createButton.addEventListener("click", () => {
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
  elements.status.style.color = tone === "error" ? "#ff9c8a" : "#d8c6a3";
}
